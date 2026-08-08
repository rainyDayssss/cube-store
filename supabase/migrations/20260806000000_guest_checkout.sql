-- Cube Store — guest checkout & order placement (ticket 06)
-- Adds the atomic order-placement seam called by the storefront:
--
--   place_order(full_name, email, contact_number, delivery_address,
--               payment_method, items jsonb, notes) -> jsonb
--
-- One transaction: row-locks and re-validates stock for every cart line
-- (ADR-0002), upserts the guest Customer by email (ADR-0001, no auth account),
-- inserts the Order + Order items with price snapshots (ADR-0003), deducts
-- stock, and allocates the sequential per-day ORD-YYYYMMDD-XXXX number.
-- It is SECURITY DEFINER so it may write past the anon INSERT-only RLS
-- (ADR-0004); the write path is only reachable through this validated RPC.
--
-- Returns jsonb: { ok, order_id, order_number, total_amount } on success, or
-- { ok: false, code, message, items? } on a rejected order. Any failure is
-- returned *before* a single write, so the database is never partially
-- modified (atomicity is structural, not exception-based).

-- Per-day order-number counter. `day` is the primary key, so concurrent
-- orders on the same day serialize on a single row lock and get distinct
-- sequential numbers.
create table if not exists public.order_number_counters (
  day date primary key,
  last_value integer not null default 0
);

-- The counter is internal state: anon/authenticated must never read or touch
-- it directly. RLS denies everyone (no policies) and the SECURITY DEFINER
-- function bypasses it to maintain the counter.
alter table public.order_number_counters enable row level security;
revoke all on public.order_number_counters from public;
revoke all on public.order_number_counters from anon, authenticated;

-- NOTE: `p_items` must come BEFORE the defaulted `p_notes` — Postgres rejects
-- non-default parameters after a defaulted one (error 42P13). Callers pass
-- arguments by name, so the order is invisible to them.
create or replace function public.place_order(
  p_full_name text,
  p_email text,
  p_contact_number text,
  p_delivery_address text,
  p_payment_method text,
  p_items jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_total numeric(10, 2) := 0;
  v_day_counter integer;
  v_attempt integer;
  v_item record;
  v_product public.products%rowtype;
  v_issues jsonb := '[]'::jsonb;
begin
  -- 1. Input validation -----------------------------------------------------
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION', 'message', 'Your cart is empty.');
  end if;

  if nullif(trim(p_full_name), '') is null
     or nullif(trim(p_email), '') is null
     or nullif(trim(p_contact_number), '') is null
     or nullif(trim(p_delivery_address), '') is null then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Name, email, contact number, and delivery address are required.');
  end if;

  if p_payment_method not in ('cod', 'ewallet', 'bank_transfer') then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Choose a valid payment method.');
  end if;

  if p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Enter a valid email address.');
  end if;

  -- The cart merges lines by product id, so a duplicate here means the caller
  -- is not the UI. Validating each line against the same stock independently
  -- would let two small lines sum past it, so reject duplicates outright.
  if jsonb_array_length(p_items) > 100 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Too many items in the cart.');
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
    group by product_id
    having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION',
      'message', 'Your cart contains the same product more than once.');
  end if;

  -- 2. Lock + re-validate every line BEFORE any write -----------------------
  -- Rows are FOR UPDATE so concurrent orders cannot oversell the same product
  -- (ADR-0002). A rejected line returns before a single insert/update, so the
  -- database is untouched on failure.
  for v_item in
    select product_id, quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity < 1 then
      return jsonb_build_object('ok', false, 'code', 'VALIDATION',
        'message', 'Each cart line needs a product id and a quantity of at least 1.');
    end if;

    -- NOTE: SELECT INTO leaves the target variable untouched when no row
    -- matches, so handle not-found before touching any v_product field.
    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE',
        'message', 'A product in your cart is no longer available.',
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', v_item.product_id,
          'name', 'Unavailable product',
          'requested', v_item.quantity
        )));
    end if;

    if v_product.status <> 'active' then
      return jsonb_build_object('ok', false, 'code', 'PRODUCT_UNAVAILABLE',
        'message', format('"%s" is no longer available.', v_product.name),
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', v_product.id,
          'name', v_product.name,
          'requested', v_item.quantity
        )));
    end if;

    if v_product.stock_quantity < v_item.quantity then
      v_issues := v_issues || jsonb_build_object(
        'product_id', v_product.id,
        'name', v_product.name,
        'available', v_product.stock_quantity,
        'requested', v_item.quantity
      );
    end if;

    v_total := v_total + v_product.price * v_item.quantity;
  end loop;

  if jsonb_array_length(v_issues) > 0 then
    return jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_STOCK',
      'message', 'Some items do not have enough stock. Review the highlighted lines and try again.',
      'items', v_issues);
  end if;

  -- 3. Customer upsert by email (guests have no account, ADR-0001) ----------
  insert into public.customers (full_name, email, contact_number)
  values (trim(p_full_name), lower(trim(p_email)), trim(p_contact_number))
  on conflict (email) do update
    set full_name = excluded.full_name,
        contact_number = excluded.contact_number
  returning id into v_customer_id;

  -- 4. Order number: per-day counter, retried on collision ------------------
  -- The counter increment sits OUTSIDE the exception block so a colliding
  -- order insert (a manually inserted row with the same number) rolls back
  -- only the insert, not the counter — the retry gets the next number.
  for v_attempt in 1..3 loop
    insert into public.order_number_counters (day, last_value)
    values (current_date, 1)
    on conflict (day) do update
      set last_value = public.order_number_counters.last_value + 1
    returning last_value into v_day_counter;

    v_order_number := 'ORD-' || to_char(current_date, 'YYYYMMDD')
      || '-' || lpad(v_day_counter::text, 4, '0');

    begin
      insert into public.orders (
        order_number, customer_id, delivery_address, payment_method,
        status, total_amount, notes
      )
      values (
        v_order_number, v_customer_id, trim(p_delivery_address),
        p_payment_method::public.payment_method, 'pending', v_total,
        nullif(trim(coalesce(p_notes, '')), '')
      )
      returning id into v_order_id;

      exit;
    exception
      when unique_violation then
        v_order_number := null; -- try the next counter value
    end;
  end loop;

  if v_order_number is null then
    raise exception 'Could not allocate a unique order number';
  end if;

  -- 5. Order items with price snapshots (ADR-0003) + stock deduction --------
  -- Rows are still locked from step 2, so they cannot disappear here; the
  -- guard is purely defensive.
  for v_item in
    select product_id, quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;

    if not found then
      raise exception 'Product % vanished during checkout', v_item.product_id;
    end if;

    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_item.quantity, v_product.price);

    update public.products
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_product.id;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total
  );
end;
$$;

-- RPC reachable by guests (anon) and signed-in Users; not by the public role.
-- Signature order: full_name, email, contact_number, delivery_address,
-- payment_method, items, notes.
revoke all on function public.place_order(text, text, text, text, text, jsonb, text) from public;
grant execute on function public.place_order(text, text, text, text, text, jsonb, text) to anon, authenticated;
