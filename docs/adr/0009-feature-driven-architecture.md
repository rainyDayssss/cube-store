# Feature folders: organizing the codebase by business capability

The codebase is reorganized from a layered layout (`app/` routes, `components/` UI, `lib/store/` service logic — which split every business capability across three trees) into feature folders: each business capability becomes a self-contained module under `features/<feature>/` owning its UI components, server actions, business logic, and unit tests, while `app/` is reduced to thin route shells that compose features. Shared, cross-feature code stays put: `components/ui/` and the storefront shell (header, drawer, footer, theme-switcher) remain in `components/`, and `lib/supabase/`, `lib/testing/mock-supabase.ts` (the single shared mock), and `lib/utils.ts` remain in `lib/`. The storefront shell is deliberately not folded into any feature — it is rendered by every storefront route (catalog, cart, checkout) and already imports the cart badge, so owning it inside `catalog` would force cross-feature imports. The admin dashboard is one feature with sub-folders per manager (`categories`, `products`, `orders`, `customers`) rather than five top-level features, mirroring the existing `lib/store/admin/` seam.

Status: accepted

## Considered options

- **Feature-Sliced Design (strict app/pages/widgets/features/entities/shared layers)** — rejected: heavy import-rule machinery that over-restricts a solo/small project.
- **Deepen the current layered grouping** — rejected: keeps UI, logic, and shell split across three trees; no colocation benefit.
- **Feature folders for the service layer only** — rejected: leaves UI and logic split, capturing half the benefit.
- **Five separate admin features** — rejected: the dashboard is one bounded area; five features would multiply cross-feature import edges for no isolation gain.
- **Fold the storefront shell into `catalog`** — rejected after review: the shell is rendered by cart and checkout routes too; that would force those features to import from `catalog`.
- **Introduce a top-level `shared/` root** — rejected: renames shared layers for no functional gain; the existing `components/` + `lib/` names are kept.
- **Big-bang migration** — rejected: with 100 unit tests and ~40 files, moving one feature at a time keeps the suite green and isolates any breakage to a single feature.

## Consequences

- Business logic and tests colocate in `features/<feature>/lib/`; the "single testing seam" story shifts from *the `lib/store/` layer* to *the shared mock in `lib/testing/` that every feature's tests import*. Test count and behavior are unchanged — pure file moves and import rewrites, no logic edits.
- **Deliberate cross-feature type sharing.** The domain types are owned where the domain lives and imported by sibling features as needed (mostly type-only, erased at compile time): `catalog` owns `Product`/`Category`/`ProductStatus`/`CatalogSort` (and the shared `PRODUCT_COLUMNS` constant, imported at runtime by `admin` products), `checkout` owns `PaymentMethod`, `admin` owns `OrderStatus`/`CustomerSummary`. This is intentional — the features share one database and one domain model — so a future refactor should NOT duplicate these types per feature or "fix" the imports; extract them to a `lib/domain/` module only when the sharing grows beyond types.
- **The storefront shell is feature-aware, not neutral.** `components/` keeps the shared chrome, but `storefront-header`/`storefront-drawer` import `CartBadge` and the cart store from `features/cart/` — the shell is a consumer of features (app → components → features), not pure shared primitives. This is the trade-off that kept cart/checkout pages from importing catalog; accepted as-is.
- Server actions move into their feature — `features/checkout/actions.ts` and `features/admin/actions/<manager>.ts` (one actions folder per feature); `app/` pages become thin shells importing feature components. Routing, layouts, and the ADR-0007 route-mode split are untouched.
- Import paths change repo-wide (`@/components/...` → `@/features/...` for feature code), verified by `tsc` + ESLint after each feature move.
- The domain model in `CONTEXT.md` is unchanged: features are a code-structure concept, not domain language, so no new glossary terms.
