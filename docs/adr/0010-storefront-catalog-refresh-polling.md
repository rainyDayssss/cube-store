# Storefront catalog refresh: polling

Customers keep storefront tabs open; when an Admin adds, edits, deletes, or toggles a Product (or an order cancellation restores stock), the open tab should show the change without a manual refresh. The storefront pages are all dynamic server components querying Supabase per request, and the storefront and admin are separate deployments sharing one Supabase project (ADR-0007) — so the trigger that says "the catalog changed" must flow through Supabase, and the re-render is a `router.refresh()` on the open tab, which re-runs every server component on the page (products, categories, stock badges, featured lists, category filter) in one shot. The trigger is polling: a `CatalogRefresh` client component mounted in `StorefrontHeader` re-fetches every 10 seconds while the tab is visible, pauses while it is hidden, and refreshes immediately when the tab becomes visible again.

Status: superseded by ADR-0011

## Considered options

- **Supabase Realtime (Postgres Changes)** — rejected for now: the "proper" near-instant answer, and the DB-as-source-of-truth would propagate every write path (product actions, the stock-restoring order-cancellation function, direct SQL) without extra wiring. Cost: a `supabase_realtime` publication migration, a new WebSocket runtime dependency, and RLS interplay on the subscription. Free-tier headroom (200 concurrent connections, 2M messages/mo) makes it viable whenever we want it — nothing about this decision blocks it.
- **`revalidatePath` from the admin Server Actions** — rejected: it only purges the cache of the process that calls it (the admin host, per ADR-0007), so it cannot reach the storefront deployment; and it only affects *future* requests, never already-open tabs. It also presupposes a cache to purge — these pages are dynamic (they read cookies via the server Supabase client), so every fresh request already hits Supabase. It stays in use for the admin's own pages, where it is correct.
- **Realtime broadcast from the admin actions** — rejected: two sources of truth (the write *and* the notification), and a writer that lives inside a Postgres function (order cancellation's stock restore) would silently never broadcast.

## Consequences

- Customers see Admin changes within one poll interval (≤ 10s) with no reload; returning to a tab shows current data immediately.
- Traffic is bounded by the number of *visible* storefront tabs; hidden tabs stop polling entirely.
- URL state (search, category, sort, page) is untouched by `router.refresh()`, so a refresh never resets a Customer's filters.
- A Product deleted or made inactive while a Customer sits on its detail page re-renders as the existing not-found state on the next tick; cart contents survive refresh (they live in `localStorage`) and checkout re-validates stock server-side anyway.
- Cart and checkout pages poll harmlessly too: `router.refresh()` re-renders server components without resetting client state, so the `localStorage` cart and an in-progress checkout form are untouched by a refresh.
- The polling interval is a single constant (`CATALOG_POLL_INTERVAL_MS`); swapping the trigger to Realtime later is isolated to the one `CatalogRefresh` component and its seam.
