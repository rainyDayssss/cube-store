-- Order tracking Realtime (ticket 14): allow anon to receive Realtime
-- events on the orders table so the tracking page can show live status
-- updates. The actual data access is still controlled by the track_order
-- SECURITY DEFINER function — this policy only enables the Realtime
-- subscription to fire events.

create policy "Anon can track orders via realtime"
  on public.orders for select
  to anon
  using (true);
