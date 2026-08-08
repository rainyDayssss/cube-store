# Live updates via Supabase Realtime

Customers keep storefront tabs open and Admins keep the dashboard open; each should see the other's changes without a manual refresh. The storefront and admin are separate deployments sharing one Supabase project (ADR-0007), so the trigger must flow through Supabase: a client component subscribes to Postgres Changes on the tables the page renders and calls `router.refresh()` on each event, re-running the page's server components (which query per request). ADR-0010 shipped this as 10-second polling; Realtime replaces it — events fire only on actual changes, so there is no polling traffic and updates land within milliseconds, for a migration of one `alter publication` statement.

Status: accepted

## Considered options

- **Polling (ADR-0010)** — superseded. Correct but wasteful: every visible tab re-fetches every 10 seconds whether or not anything changed, and egress grows with open tabs × time — at sustained concurrent usage it approaches the free tier's 5 GB/month ceiling. Realtime fires only on change (a handful per day at this store's write volume), so its traffic is a rounding error of polling's.
- **`revalidatePath` from the admin Server Actions** — rejected: it cannot reach the storefront deployment (separate process, ADR-0007) and only affects future requests, never already-open tabs.
- **Realtime broadcast from the admin actions** — rejected: two sources of truth, and a writer inside a Postgres function (order-cancellation stock restore) would silently never broadcast.

## Consequences

- Customers see Admin catalog edits and stock changes within milliseconds; Admins see new orders, status moves, and customer aggregates the same way — across the two deployments.
- RLS decides who receives events: Postgres Changes only sends events a subscriber could SELECT. Anonymous tabs see only `products`/`categories` (world-readable, ADR-0004); Admin sessions see `orders`, `order_items`, and `customers` too. Role-based policies mean the default replica identity (primary-key-only old rows) suffices.
- Events are used purely as a trigger; payloads are ignored (`router.refresh()` re-runs the real queries).
- Hidden tabs drop change-driven refreshes (no wasted server re-renders) and catch up the instant they become visible.
- URL state (search, category, sort, page) survives `router.refresh()`, and client state (the `localStorage` cart, open forms, modals) is untouched.
- Free-tier headroom: 200 concurrent connections and 2M messages/month — a cube store uses a rounding error of either.
