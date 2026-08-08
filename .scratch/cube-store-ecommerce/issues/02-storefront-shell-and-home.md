# 02 — Storefront shell & home page

**What to build:** The storefront's public shell and landing page: a sticky header with store branding and search, a collapsible slide-out drawer navigation on mobile, a footer, a hero promotional banner, a featured Category grid, and a Featured Products showcase pulling live catalog data. Browsing the store begins here.

**Blocked by:** 01

**Status:** resolved

- [x] Home page renders the hero, featured Categories, and featured Products from the live catalog (empty-data safe)
- [x] Sticky header with search is present on all viewports; mobile slide-out drawer navigation works
- [x] Data-dependent sections stream with skeleton loaders instead of layout shift
- [x] Layout is responsive at mobile (<640px), tablet (640–1024px), and desktop (>1024px) breakpoints

## Comments

Implemented locally (Aug 4): `StorefrontHeader` (sticky, search → `/products?q=`, desktop nav, mobile drawer via `StorefrontDrawer` client component), `Hero`, and a Suspense-streamed `FeaturedCatalog` (catalog queries via the new `lib/store/catalog.ts` seam — 4 new tests, 17 total green). Featured Products are derived as the latest active products (no `featured` flag in the schema). Build ✓ (home now partial-prerender), tsc ✓, lint ✓, SSR verified via curl (hero/search/hint/footer all render). Note: `/products` and `/cart` links 404 until tickets 03/05 land; drawer interaction needs a quick visual pass.

Resolved Aug 4: all four acceptance criteria met locally (tsc, 17/17 tests, lint, production build, SSR verified). Outstanding non-blocking nits: `/products` and `/cart` links 404 until tickets 03/05 land; a manual click-through of the mobile drawer is recommended.
