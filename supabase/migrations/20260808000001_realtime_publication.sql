-- Live updates via Realtime (ADR-0011): publish catalog and order changes so
-- open storefront and admin tabs refresh without polling.
--
-- RLS decides who receives events: Postgres Changes only sends events a
-- subscriber could SELECT. Anonymous tabs see only products/categories (the
-- world-readable catalog, ADR-0004); Admin sessions see orders, order_items,
-- and customers too (full access via the role claim). The policies are
-- role-based, so the default replica identity (primary-key-only old rows)
-- suffices — and the client ignores event payloads entirely, using them
-- purely as a trigger to re-run its server queries.
alter publication supabase_realtime add table
  public.products,
  public.categories,
  public.orders,
  public.order_items,
  public.customers;
