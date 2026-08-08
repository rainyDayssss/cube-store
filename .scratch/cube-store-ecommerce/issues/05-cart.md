# 05 — Cart

**What to build:** The shopping Cart: a Zustand store persisted to `localStorage`, adding from the product detail page, quantity updates capped at stock, item removal, and a Cart page with a subtotal and total breakdown. The Cart is a client-side selection only — it becomes an Order at checkout (ticket 06), which is where stock is actually enforced.

**Blocked by:** 04

**Status:** resolved

- [x] Adding from the detail page updates a Cart that persists across refreshes and visits (localStorage)
- [x] Quantities cannot exceed available stock; item removal works; subtotal and total recalculate
- [x] Clear empty-cart state shown
- [x] A success callback is exposed so checkout (ticket 06) can clear the Cart after a completed Order

## Comments

Implemented locally (Aug 6): `lib/store/cart.ts` — Zustand 5 store (`useCartStore`) persisted to localStorage via the `persist` middleware with a client-only storage guard (no-op on the server) and an `onRehydrateStorage` hydration flag so SSR never flashes a wrong badge/count. Actions: `addItem` (caps at the stock snapshot, increments existing lines, never above stock), `updateQuantity` (clamped to [1, stock]), `removeItem`, `clearCart` (the ticket 06 success seam), plus derived `cartCount`/`cartSubtotal` helpers. 8 new tests — 39/39 green, tsc ✓, lint ✓.

Wired in: `AddToCart` (ticket 04) now dispatches to the store with the selected quantity; a `CartBadge` client component shows a live unit count in the desktop header and the mobile drawer. `app/cart/page.tsx` + `components/cart/cart-view.tsx`: client-rendered line items (image, name, unit price, quantity stepper capped at stock, remove, line total), an order summary (Items count, shipping hint, Total), a clear empty-cart state with a browse link, and a Checkout button linking to `/checkout` (404 until ticket 06 lands). Note: `/checkout` is intentionally a dead link until ticket 06.

Browser-verified end-to-end against the real Supabase project: added the 3x3 Speed Cube from the detail page, the persisted cart showed the item with correct quantity and Total ($142.89 for 11 units — accumulated from repeated test clicks, within the 50-unit stock cap), and no console errors. Remaining for manual pass: a click-through confirming the badge updates and item removal.

Review round (Aug 6): guarded `addItem` against out-of-stock Products (no phantom zero-quantity lines), clamped `updateQuantity` to a minimum of 1 even when stock drops to 0 after adding, added `partialize` so only cart lines persist (the hydration flag is transient), replaced a redundant `items.find(...)!` in the cart list with direct iteration, swapped the awkward inline type for the exported `CartItem`, and removed the unreachable `CartViewSkeleton`/Suspense wrapper (CartView is a synchronous client component with its own hydration skeleton). 2 more tests for the stock guards — 41/41 green.

Resolved Aug 6: browser click-through confirmed — adding from a product page updates the cart and header badge, the cart persists across navigation/refresh, quantities stay capped at stock, item removal works, totals recalculate, and the empty state shows for an empty cart. Ticket fully closed.

