# 01 — Database & test foundations

**What to build:** The project's data and test foundations: a migration creating the schema (categories, products, customers, orders, order_items; enums product_status active/inactive, order_status, payment_method, customer_account_status) with its constraints and RLS policies per ADR-0004; a public Storage bucket writable only by Admins; the admin role bootstrap; seed catalog data; and the test harness (runner + mocked Supabase client) that every later ticket's tests use.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Migration applies cleanly: all tables, enums, checks (price/stock/quantity), and `ON DELETE RESTRICT` on the Category → Product reference, exactly per SRS §05 (amended)
- [x] RLS per ADR-0004: anon can SELECT categories/products; anon has NO SELECT on customers/orders/order_items but CAN INSERT into them; an Admins (via the `auth.jwt()` role claim) has full access
- [x] Public Storage bucket exists: read by anyone, write/update/delete restricted to Admins
- [x] Seed catalog: several Categories and Products with images, mixed statuses and stock levels, including an out-of-stock Product
- [x] Test runner runs green with a mocked Supabase client harness that later tickets reuse
- [x] One-off admin bootstrap step (setting `role: admin` in Auth app_metadata) is documented

## Comments

Implemented locally (Aug 4): schema + seed migrations written under `supabase/migrations/` (RLS per ADR-0004, public `product-images` bucket with admin-write policies, 4 Categories + 11 Products incl. out-of-stock and inactive), Vitest added with `npm test`, and the mocked Supabase harness + 13 smoke tests under `lib/testing/` (range-comparison ops verified after a review-found inversion bug) — tests, lint, and production build all pass. Remaining to fully close: apply the migrations to a real Supabase project and verify RLS behaviour there.

Status set to `ready-for-human` Aug 4: criteria 1–4 (the migration, RLS, storage bucket, and seed) are written but unverified against a real database — applying `supabase/migrations/` to a Supabase project and confirming RLS per ADR-0004 is the remaining human step. Criteria 5–6 are complete.

Verification is now turnkey: `supabase/verify-ticket-01.sql` checks every criterion (tables/enums/constraints/FKs, RLS enabled + policies + behavioural anon/admin role checks, storage bucket + limits + policies, seed contents) and prints a PASS/FAIL report. Run it in the SQL editor after applying the migrations; boxes 1–4 get ticked once it reports all PASS.

Resolved Aug 6: migrations applied to the real Supabase project, and `verify-ticket-01.sql` ran with all 45 checks PASS (incl. the behavioural anon/admin RLS notices). Note: the verify script was fixed on the way — the Supabase SQL editor runs a pasted script as one implicit transaction, so the script's `begin/rollback` blocks rolled back the `_verify` temp table and broke the report (`relation "_verify" does not exist`). Removed all transaction-control statements and switched to session-level `set role`/`reset role`; the anon INSERT check now self-rolls-back via a PL/pgSQL exception. All six criteria ticked; ticket fully closed.
