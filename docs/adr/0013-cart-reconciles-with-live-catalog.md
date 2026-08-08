# Cart reconciles with the live Catalog

Cart lines hold snapshots (name, price, stock, image) taken when a Product was added. Checkout charges the live database price (ADR-0003), so an Admin price or stock change made while a Customer's cart was open could make the cart's shown total disagree with the total actually charged — and a deleted or retired Product would only surface as a confusing checkout error. Now that the Catalog is live on every storefront page (ADR-0011), the Cart refreshes itself too: a `reconcile(liveProducts)` operation on the Cart module re-fetches the current rows for the cart's product ids on mount (and when the tab becomes visible again), refreshes name/price/image/stock, clamps quantities to live stock, and flags Products that are gone or no longer active. Retired lines stay visible (flagged) so the Customer can see and remove them; they block checkout until removed, and checkout remains the authoritative backstop.

Status: accepted

## Considered options

- **Auto-remove unavailable lines** — rejected: silently dropping a Product a Customer chose to buy is worse than flagging it, and a Customer should see what is no longer available.
- **Reconcile only at checkout (server-side)** — already true via `place_order`, which rejects with per-item detail (ADR-0004); it gives no live feedback on the cart page itself.
- **Server-render the cart** — rejected: cart contents live in `localStorage` and are unknowable to the server components.

## Consequences

- The cart's shown totals match what checkout charges, as long as no change lands between the reconcile and the submit; `place_order` still re-validates stock and price as the trust boundary.
- Prices, stock caps, and retired flags update when the Customer opens the cart, returns to the tab, or — while the cart is open — whenever Realtime reports a catalog change (`catalog:changed`, ADR-0011).
- The reconcile logic is a pure, tested seam on the Cart module (`reconcileCart`); the fetch is thin client glue over the world-readable catalog (anon SELECT, ADR-0004).
