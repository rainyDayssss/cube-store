# 03 — Product catalog grid

**What to build:** The product catalog page: a responsive 2/3/4-column grid with instant name search, a Category filter dropdown, price sorting (low → high / high → low), and pagination — with search, filter, sort, and page preserved in the URL so a browser refresh keeps the view. Product availability is derived from stock, never from status.

**Blocked by:** 01

**Status:** resolved

- [x] Grid lists active Products; availability (in-stock / out-of-stock) is derived from `stock_quantity`
- [x] Search, Category filter, and price sort work and compose together
- [x] Pagination and all filter state live in URL search params and survive refresh
- [x] Correct grid column counts per breakpoint (2 mobile, 3 tablet, 4 desktop); skeleton loaders while streaming

## Comments

Implemented locally (Aug 6): `app/products/page.tsx` (streaming, searchParams resolved inside `<Suspense>`), `components/catalog/` — a client `CatalogToolbar` (debounced instant search, category filter, price sort, all pushed to the URL, page reset on any filter change) and a server `CatalogGrid` (one scoped query per view: active-only, ilike name search, category filter, price sort, pagination with PostgREST `exact` count; unknown-category empty state; out-of-range pages clamped to the last page). `searchCatalog` added to the store seam with 7 new tests (search/filter/sort compose, pagination windows + totalPages, invalid-sort fallback, error/empty paths) — mock extended to support `select(..., { count: "exact" })`. 24/24 tests, tsc, lint all green.

Fixes beyond the ticket: `lib/supabase/proxy.ts` was redirecting ALL unauthenticated storefront routes to `/auth/login` (starter-kit default) — now only `/admin` is gated, per ADR-0001 (guests browse without accounts); `/protected` still self-guards server-side. Review round: moved `isValidSort` into `lib/store/catalog.ts` (it was in a `"use client"` file but called from a server component — runtime error caught in dev), fixed a stale-closure race in the debounced search (latest params read from a ref), added pageSize validation.

Live verification (dev server against the real Supabase project): base grid renders 10 products; `?category=does-not-exist` shows the not-found empty state; `?page=99` clamps to the last page; `?q=cube&sort=price-asc` returns the correct cheapest match. Outstanding for manual pass: a browser click-through of the debounced search + selects.

Resolved Aug 6: browser click-through confirmed — grid renders with live catalog data, debounced search filters as you type, category and sort selects update the URL and grid, and pagination links preserve filter state. Ticket fully closed.

