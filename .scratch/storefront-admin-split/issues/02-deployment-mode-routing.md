# 02 — Deployment-mode routing: routeMode seam + 404 middleware

**What to build:** The same repo is able to deploy as two disjoint surfaces, switched by one environment variable (`NEXT_PUBLIC_APP_MODE`). The routing rule lives in one pure function — `routeMode(pathname, appMode) → "allow" | "block"` — colocated with the session proxy, and the proxy applies it. In storefront mode, `/admin` and `/auth/*` return 404 as if they don't exist. In admin mode, everything except `/admin` and `/auth` returns 404 (including the host root). With the variable unset, today's behavior is preserved byte-for-byte, including the unauthenticated `/admin` → `/auth/login` redirect.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] The pure routing function takes a pathname and an app mode and returns allow or block for every case: storefront mode blocks `/admin` and `/auth/*`; admin mode blocks everything else including `/`; unset mode blocks nothing; public storefront paths always pass in every mode
- [x] Unit tests cover those four behavioural cases (following the repo's existing Vitest style; no browser or live Supabase required)
- [x] The session proxy consults the routing function: blocked requests receive a 404 response; allowed requests flow through unchanged
- [x] Static assets (`_next/*`, images, favicon) are untouched — the existing proxy matcher behaviour is preserved
- [x] With the variable unset, all existing routing behavior is unchanged (including the admin login redirect); with it set, the storefront and admin hosts behave as isolated surfaces
- [x] `tsc`, lint, and the full test suite pass

## Comments

Implemented: `routeMode(pathname, appMode)` lives in the supabase module beside the session proxy — pure, no I/O, the single testing seam. The proxy consults it before any session work and returns `new NextResponse(null, { status: 404 })` for blocked paths (the Next.js-documented way to produce a real 404 from proxy; `notFound()` is not proxy-safe). 8 unit tests cover both modes, unset mode, unknown values (inert), and the `startsWith` lookalike edge. Verified: `tsc`, ESLint, 108 tests, and a production build all pass.

## Comments

- Spec: `.scratch/storefront-admin-split/spec.md` (User Stories 9–12; Implementation Decisions: deployment switch, storefront mode, admin mode, 404 mechanics, pure routing seam; Testing Decisions).
- Do not change admin pages, auth pages/forms, RLS, migrations, or the storefront UI — the UI strip is ticket 01, and these two are independent (may run in parallel).
