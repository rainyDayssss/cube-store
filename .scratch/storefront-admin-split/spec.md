# Storefront/Admin Split — own URLs, guest-only storefront

Status: ready-for-agent

## Problem Statement

The storefront header renders an auth block on every public page: a "Sign in" button for guests, and a "Hey, email · Dashboard · Logout" block for signed-in Admins browsing the store. The user intends to host the public storefront and the admin dashboard as separate deployments with their own URLs, so the login entry point should not exist on the public side at all — the storefront should be a pure guest surface, and the Admin should reach the dashboard only through its own URL.

## Solution

The storefront becomes fully auth-free: every auth UI element is removed from all public pages (header desktop slot and mobile drawer), and the now-dead auth button components are deleted. The repo stays a single codebase (per ADR-0006's *repo* decision), but it is prepared to deploy as **two deployments from the same code**, switched by one environment variable (`NEXT_PUBLIC_APP_MODE`):

- **Storefront deployment** (`NEXT_PUBLIC_APP_MODE="storefront"`): serves the public pages only; `/admin` and `/auth/*` return **404** as if they don't exist.
- **Admin deployment** (`NEXT_PUBLIC_APP_MODE="admin"`): serves only `/admin` and `/auth/*`; every other path (including `/`) returns **404** — full isolation both ways.
- **Unset** (current development / single-deployment): today's behavior, nothing changes.

The routing rule lives in one small pure function next to the session proxy so it is unit-testable without a browser or a live Supabase project. The architectural decision is recorded in a new ADR (0007) that revises ADR-0006's "deploy as one unit" consequence.

## User Stories

1. As a Customer, I want no "Sign in" button anywhere on the storefront, so that the public experience is purely about browsing and ordering.
2. As a Customer, I want no admin chrome (email greeting, Dashboard link, Logout) on storefront pages even when an Admin is signed in, so that the storefront looks like any other guest-facing shop.
3. As a Customer, I want the storefront header to keep search, navigation, and the Cart, so that removing auth doesn't cost me any storefront functionality.
4. As an Admin, I want to reach the dashboard through its own URL, so that I manage the store without the storefront exposing the admin entry point.
5. As an Admin, I want the admin deployment to serve only the dashboard and the auth pages, so that admin traffic never touches the storefront surface.
6. As an Admin, I want a visit to the admin host root (`/`) to return 404, so that the two hosts are completely disjoint surfaces.
7. As an Admin, I want to sign in at `/auth/login` on the admin host and be redirected into `/admin` as today, so that the existing auth flow keeps working unchanged.
8. As an Admin, I want the unauthenticated `/admin` → `/auth/login` redirect preserved on the admin host, so that the dashboard stays gated by the `role: admin` claim (ADR-0001).
9. As a store operator, I want a request to `/admin` or `/auth/login` on the *storefront* host to return 404, so that the login surface is unreachable from the public URL.
10. As a store operator, I want each deployment to pick its behavior with a single environment variable, so that the split is declarative and easy to configure.
11. As a developer, I want the routing behavior to be inert when the variable is unset, so that local development and the current single deployment are unaffected.
12. As a developer, I want the routing decision testable as a pure function, so that the 404/allow behavior is covered by the unit suite like the rest of the store logic.
13. As a developer, I want the dead auth components removed rather than left unreachable, so that the storefront codebase carries no unused auth UI.
14. As a developer, I want the split decision recorded in an ADR, so that a future reader understands why one repo ships two disjoint surfaces.
15. As a developer, I want the storefront header's `hasEnvVars` warning slot removed, so that no auth-related conditional remains on the public side.

## Implementation Decisions

- **Same repo, two deployments (ADR-0007).** The repo and its service layer stay unified (ADR-0006's repo decision stands); only the *deployment topology* changes — two builds from the same code, one Supabase project. This deliberately does not revive ADR-0005's two-repo plan: splitting repos would duplicate the store service layer, migrations, shadcn components, and docs for no isolation benefit, since both halves share one database and one checkout/order lifecycle seam.
- **Deployment switch: `NEXT_PUBLIC_APP_MODE`.** Reads `"storefront"`, `"admin"`, or unset. Unset ⇒ current behavior preserved exactly. The env var is public (build-time inlined) so it can also gate any client-side surface if ever needed.
- **Storefront mode.** Paths starting with `/admin` or `/auth` return 404. Everything else passes through unchanged.
- **Admin mode.** Every path except `/admin` and `/auth` prefixes returns 404 — including `/`. The existing proxy logic that redirects unauthenticated `/admin` requests to `/auth/login` continues to run for the allowed prefixes.
- **404 mechanics.** The middleware returns a 404 response for blocked paths rather than rewriting or redirecting, so the storefront genuinely has no admin surface and the admin host genuinely has no storefront surface. Static assets (`_next/*`, images, favicon) are already excluded by the root proxy matcher and remain untouched.
- **Pure routing seam.** The rule is a single exported pure function — `routeMode(pathname, appMode) → "allow" | "block"` — colocated with the session proxy. The proxy calls it; the tests call it directly. No new module boundary, no state, no I/O: one testable decision point for the whole feature.
- **Storefront header.** Both auth renderings are removed: the desktop slot and the mobile drawer child. The header keeps brand, navigation, search, and the Cart badge, and the `hasEnvVars` conditional block (which only ever guarded the auth slot) goes with it.
- **Storefront drawer.** The unused `children` slot is removed from the drawer component, together with its now-empty bottom section.
- **Dead code removal.** `auth-button.tsx` (no longer rendered anywhere) and `site-header.tsx` (already unimported, and would break the build once `AuthButton` is deleted) are deleted. `logout-button.tsx` is kept — the admin navigation still uses it.
- **Untouched surface.** Admin pages, auth pages and forms (login / forgot-password / update-password / confirm), the admin navigation, `admin-gate`, RLS policies, migrations, and the Supabase clients all remain exactly as they are. The admin experience after login is byte-for-byte identical.
- **ADR-0007.** A new decision record documents the env-var mechanism, the two-404 behavior, and why same-repo-two-deployments beats two repos (ADR-0005) and one host (ADR-0006's deployment consequence). It supersedes the "deploy as one unit" consequence of ADR-0006 and cross-references ADR-0001 (auth reserved for Admins) and ADR-0004 (RLS unchanged).

## Testing Decisions

- **What makes a good test:** tests exercise the *external behavior* of the routing rule — given a pathname and an app mode, is the request allowed or blocked? They do not inspect middleware internals, cookies, or React rendering.
- **Module tested — the single seam:** the pure `routeMode(pathname, appMode)` function. It returns a verdict for the four behavioral cases: storefront mode blocks `/admin` and `/auth/*`; admin mode blocks everything except those prefixes (including `/`); unset mode blocks nothing; and public storefront paths always pass in every mode.
- **Prior art:** the repo's existing Vitest suite (`lib/store/**/*.test.ts`) tests external service behavior without a browser or live Supabase. These tests are simpler — pure input/output, no mock Supabase client required — but follow the same runner, style, and `node` environment.
- **UI changes are validated by typecheck and build**, matching the repo's existing convention of not unit-testing React components; the routing rule is where the feature's behavior is locked by tests.

## Out of Scope

- Creating the actual two deployments, domains, DNS, or host configuration — the spec prepares the code; hosting is a deploy-time step.
- Moving `/admin` to a different path or renaming auth routes.
- Changing the `role: admin` claim mechanism, the auth flow, or any RLS policy.
- Any change to the storefront's catalog, Cart, or checkout behavior.
- Redirecting the admin host root (`/`) to `/admin` — the chosen design 404s it for full isolation (a one-line deviation if ever desired).
- Customer accounts or any Customer-facing authentication.

## Further Notes

- The ADR to be created is `docs/adr/0007-same-repo-two-deployments.md` (0006 currently ends the series).
- Env var to document in `.env.example` / README once deployments are stood up: `NEXT_PUBLIC_APP_MODE=storefront|admin` (optional; unset keeps single-deployment behavior).
- Deployment sketch for later: two Vercel (or Node) projects from the same repo — storefront project sets `NEXT_PUBLIC_APP_MODE="storefront"`, admin project sets `"admin"` — both pointing at the same Supabase project and sharing the `NEXT_PUBLIC_SUPABASE_*` variables.
- Vocabulary per `CONTEXT.md`: the "Sign in" button serves **Users**/**Admins**; removing it from the public pages does not touch the **Customer** experience. The storefront is guest-only by design (ADR-0001); this change makes the *deployment* match that design.
