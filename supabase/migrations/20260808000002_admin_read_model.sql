-- Cube Store — admin read model (read side of tickets 07, 10, 11)
--
-- The admin surfaces each re-derived the same Orders↔Customers↔Items joins
-- and aggregates in TypeScript (listOrders, getOrderDetail, listCustomers,
-- getAdminKpis). This migration moves those derivations into the database so
-- they exist exactly once, in SQL:
--
--   order_summaries     — order-list rows with customer name/email + item count
--   order_details       — one row per order, line items as a jsonb array
--   customer_summaries  — customer rows with live order_count / total_spent
--   get_admin_kpis()    — the six dashboard aggregates in one round-trip
--
-- All views are `security_invoker`, so Postgres applies the invoking role's
-- RLS on the underlying tables (ADR-0004): Admin sessions see everything,
-- anyone else sees nothing — a plain view owned by the migration user would
-- otherwise bypass RLS and leak order data. SELECT is granted to
-- `authenticated` only, so the views are invisible to anon. The RPC is
-- `security definer` with an is_admin() guard — the same trust posture as
-- `transition_order_status`.

-- Order list rows: order + customer + item count, newest is presentation.
create view public.order_summaries
with (security_invoker = true) as
select
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.created_at,
  o.customer_id,
  c.full_name as customer_name,
  c.email as customer_email,
  coalesce(oi.items_count, 0) as items_count
from public.orders o
left join public.customers c on c.id = o.customer_id
left join (
  select order_id, sum(quantity)::int as items_count
  from public.order_items
  group by order_id
) oi on oi.order_id = o.id;

-- One row per order with its line items as a jsonb array. Product names come
-- from a left join so a Product deleted after purchase (order_items.product_id
-- set null) still shows as "Deleted product" — the label is derived here, in
-- the single place that builds the detail shape.
create view public.order_details
with (security_invoker = true) as
select
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.notes,
  o.created_at,
  o.delivery_address,
  o.payment_method,
  c.full_name as customer_name,
  c.email as customer_email,
  c.contact_number as customer_contact_number,
  coalesce(items.items, '[]'::jsonb) as items
from public.orders o
left join public.customers c on c.id = o.customer_id
left join (
  select
    oi.order_id,
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'product_name', coalesce(p.name, 'Deleted product'),
        'image_url', p.image_url,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price
      ) order by oi.created_at, oi.id
    ) as items
  from public.order_items oi
  left join public.products p on p.id = oi.product_id
  group by oi.order_id
) items on items.order_id = o.id;

-- Customer rows with live aggregates, computed at query time (never stored).
-- Cancelled Orders are excluded from BOTH the count and the total, matching
-- the ticket-11 rule the admin surfaces already shared.
create view public.customer_summaries
with (security_invoker = true) as
select
  c.id,
  c.full_name,
  c.email,
  c.contact_number,
  c.account_status,
  c.created_at,
  count(o.id) filter (where o.status <> 'cancelled')::int as order_count,
  coalesce(sum(o.total_amount) filter (where o.status <> 'cancelled'), 0) as total_spent
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;

-- The views are admin-read only: `security_invoker` enforces RLS per caller,
-- and `authenticated` is the only role that may SELECT them at all.
revoke all on public.order_summaries, public.order_details, public.customer_summaries from public;
grant select on public.order_summaries, public.order_details, public.customer_summaries to authenticated;

-- The six dashboard aggregates in one round-trip. SECURITY DEFINER bypasses
-- the RLS admin policies, so the `role: admin` claim is re-checked here —
-- exactly like `transition_order_status`.
create or replace function public.get_admin_kpis()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_kpis jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Admins only.');
  end if;

  select jsonb_build_object(
    'total_products', (select count(*) from public.products),
    'total_orders', (select count(*) from public.orders),
    'pending_orders', (select count(*) from public.orders where status = 'pending'),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'total_customers', (select count(*) from public.customers),
    -- Total sales = every order's snapshot total except cancelled ones
    -- (a cancelled Order is undone, ADR-0002).
    'total_sales', coalesce((select sum(total_amount) from public.orders where status <> 'cancelled'), 0)
  ) into v_kpis;

  return jsonb_build_object('ok', true, 'kpis', v_kpis);
end;
$$;

revoke all on function public.get_admin_kpis() from public;
grant execute on function public.get_admin_kpis() to authenticated;
