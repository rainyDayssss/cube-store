# Two applications, one database

Status: superseded by ADR-0006

Cube Store is split into two separate projects: the customer-facing storefront (this repo, `cube-store`) and an admin application (`cube-store-admin`, to be created at `D:\Fullstack Projects\CubeStore\cube-store-admin`). Both are independent Next.js apps deployed separately, but they share a single Supabase project — the same PostgreSQL database, storage bucket, and RLS policies. Chosen over a monorepo (decoupled codebases and independent deployments) and over separate databases (the admin app must manage exactly the catalog and orders the storefront sells; disconnected data would break the product). The storefront keeps its brand "Cube Store"; the admin project is named `cube-store-admin`.

## Consequences

- **Schema ownership moves to the admin repo.** Once `cube-store-admin` exists, its copy of `supabase/migrations/` (schema, RLS, storage, seed) and `verify-ticket-01.sql` is canonical; this repo's copy becomes reference-only and is removed at split time. Only one repo applies them, since both target the same project.
- **Auth leaves this repo.** Auth exists only to gate the admin, so when the admin repo is created the auth plumbing (`app/auth/*`, `app/protected/*`, auth forms/components, `proxy.ts`, Sign in / Sign up buttons) moves there in one pass. The storefront then becomes fully guest-only, matching ADR-0001.
- **Admin issues move trackers.** Issues 07–11 in `.scratch/cube-store-ecommerce/` (admin shell, categories, products, orders, customers) stay here only until the admin repo exists, then move to its tracker; the admin repo is seeded from the design already captured in this repo's spec and SRS.
- **Deployment.** Two Vercel projects (storefront + admin) point at one Supabase project.
- **RLS unchanged.** ADR-0004's posture holds for both apps — anon can SELECT the catalog and INSERT into order tables; Admins get full access via the `auth.jwt()` role claim.

## Considered options

- **Monorepo with two apps** — rejected: couples the codebases and tooling; the user wants the admin as its own project.
- **Separate Supabase projects** — rejected: the admin would manage a different dataset than the storefront sells.
- **Dedicated infra repo for migrations** — rejected: an extra repo nobody asked for; the admin repo owns the schema instead.
- **Splitting now vs. at admin creation** — the file moves are deferred; only this decision record is written today.
