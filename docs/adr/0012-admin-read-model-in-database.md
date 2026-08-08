# Admin read model lives in the database

The admin surfaces each re-derived the same Orders↔Customers↔Items joins and aggregates in TypeScript: `listOrders` and `getOrderDetail` merged three queries in JS, `listCustomers` re-computed order counts/totals from a full orders scan, and the KPI dashboard downloaded every non-cancelled Order row just to sum it. Each copy had its own rule for what counts as a sale, so the numbers could drift apart. We moved those derivations into the database (migration 20260808000002): the `order_summaries`, `order_details`, and `customer_summaries` views, plus a `get_admin_kpis` RPC returning all six dashboard aggregates in one round-trip. The TS modules now shape queries and map columns only.

Status: accepted

## Considered options

- **Keep the JS merges** — rejected: three divergent re-derivations of the same joins and of the "totals exclude cancelled" rule, plus a fetch-all-to-sum for the KPI card.
- **Plain (definer-owned) views** — rejected: a view owned by the migration user bypasses RLS and would leak order data to anon. All views use `security_invoker = true`, so Postgres applies the invoking role's RLS (ADR-0004) — and SELECT is granted to `authenticated` only, so the views are invisible to anon entirely.
- **Reads via one big RPC** — rejected: PostgREST filters (status, search, pagination) apply naturally to views; an RPC would have re-implemented them.

## Consequences

- The joins and aggregates exist exactly once, in SQL; a rule change touches one migration, not three TS modules.
- The KPI dashboard is one round-trip instead of six queries (one of which downloaded every order row).
- The TS tests now pin mapping/filtering against view-shaped rows; the SQL itself is verified by `supabase/verify-read-model.sql` (structural + behavioral checks, matching `verify-ticket-01.sql`).
- `get_admin_kpis` is `security definer` with an `is_admin()` guard — the same trust posture as `transition_order_status` — and executes only for `authenticated`.
- Views are not in the `supabase_realtime` publication; Realtime events still flow from the base tables (ADR-0011), so the read model stays fresh automatically.
