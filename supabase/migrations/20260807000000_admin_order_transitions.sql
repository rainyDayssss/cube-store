-- Cube Store — admin order lifecycle (ticket 10)
-- Adds the atomic status-transition seam called by the admin dashboard:
--
--   transition_order_status(order_id uuid, new_status text) -> jsonb
--
-- One transaction that enforces the lifecycle contract (spec, Order lifecycle):
--   pending -> confirmed -> preparing -> shipped -> completed
-- with `cancelled` as an alternative terminal state reachable from ANY state
-- except `completed` (a completed Order is immutable). Cancelling restores
-- stock for every line item inside the same transaction (ADR-0002) — the
-- status change and the stock restore can never be observed apart.
--
-- SECURITY DEFINER: the order tables' RLS lets Admins manage them anyway, but
-- the app's write path always goes through this function so the lifecycle
-- guard and the stock restore apply to every transition the UI performs.
-- (A trusted Admin could still UPDATE status directly via the admin RLS policy
-- and skip the restore — that's out of scope; Admins are trusted operators.)
-- The Admin role claim is re-checked here because SECURITY DEFINER bypasses
-- the RLS admin policies.
--
-- Returns jsonb: { ok: true, status } on success, or { ok: false, message }.
-- Failures return *before* any write (atomicity is structural).

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_new_status text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  -- Admin-only: SECURITY DEFINER bypasses the RLS admin policies, so enforce
  -- the `role: admin` claim here. Guests and plain Users get a clear refusal.
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Admins only.');
  end if;

  -- Row-lock the Order so two concurrent transitions on it serialize instead
  -- of racing (e.g. two tabs both trying to cancel).
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'That order no longer exists.');
  end if;

  if p_new_status not in ('pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled') then
    return jsonb_build_object('ok', false, 'message', 'Unknown order status.');
  end if;

  if p_new_status = v_order.status::text then
    return jsonb_build_object('ok', false, 'message',
      format('Order is already %s.', v_order.status));
  end if;

  -- Terminal states (completed, cancelled) can never change again.
  if v_order.status in ('completed', 'cancelled') then
    return jsonb_build_object('ok', false, 'message',
      format('%s orders cannot be changed.', initcap(v_order.status::text)));
  end if;

  -- Any state except completed can be cancelled; otherwise the only legal move
  -- is the next step in the lifecycle (no skipping, no going backwards).
  if p_new_status <> 'cancelled' then
    if (case v_order.status
          when 'pending'   then 'confirmed'
          when 'confirmed' then 'preparing'
          when 'preparing' then 'shipped'
          when 'shipped'   then 'completed'
        end) <> p_new_status then
      return jsonb_build_object('ok', false, 'message',
        format('Cannot move an order from %s directly to %s.',
          v_order.status, p_new_status));
    end if;
  end if;

  -- Cancel restores stock (ADR-0002), in the same transaction as the status
  -- write. Lines whose product was later deleted (product_id set null by
  -- `on delete set null`) have nothing to restore and are skipped.
  if p_new_status = 'cancelled' then
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = v_order.id
        and product_id is not null
    loop
      update public.products
      set stock_quantity = stock_quantity + v_item.quantity
      where id = v_item.product_id;
    end loop;
  end if;

  update public.orders
  set status = p_new_status::public.order_status
  where id = v_order.id;

  return jsonb_build_object('ok', true, 'status', p_new_status);
end;
$$;

-- Admins only: guests (anon) must never transition orders. The authenticated
-- role may attempt the call; the in-function is_admin() check is the final
-- gate for signed-in Users without the claim.
revoke all on function public.transition_order_status(uuid, text) from public;
grant execute on function public.transition_order_status(uuid, text) to authenticated;
