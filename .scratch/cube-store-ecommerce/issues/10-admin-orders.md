# 10 — Admin orders

**What to build:** Order management: an orders table listing every Order, moving each through the lifecycle (pending → confirmed → preparing → shipped → completed), cancelling from any state except completed with automatic stock restoration, and exporting the current view to CSV. Includes the `transitionOrderStatus` tests — the second half of the single testing seam.

**Blocked by:** 06, 07

**Status:** resolved

- [x] Orders list renders with status and order details; only valid lifecycle transitions are offered
- [x] Cancel is available from any state except completed; cancelling restores stock atomically (ADR-0002); completed Orders cannot be cancelled
- [x] CSV export produces a spreadsheet-compatible file of the current filtered view
- [x] `transitionOrderStatus` tests cover: valid forward moves, rejected invalid moves, and cancel-restores-stock

## Implementation notes

- **DB function** (`supabase/migrations/20260807000000_admin_order_transitions.sql`): `transition_order_status(order_id, new_status)` is SECURITY DEFINER, re-checks the `role: admin` claim (bypasses RLS), row-locks the Order, enforces the lifecycle (next step only; cancel from any state except completed; completed/cancelled are terminal), and restores stock for every line item inside the same transaction. The app's write path is the function so the guard + stock restore always apply together; a bare admin UPDATE is out of scope (trusted operator).
- **Store seam** (`lib/store/admin-orders.ts`): `listOrders` (status filter + search over number/name/email, customer + item-count merge), `getOrderDetail` (customer, items with product names, price snapshots), `transitionOrderStatus` RPC wrapper, `canTransition`/`nextTransitions` (the UI only offers legal moves; the function re-checks), `ordersToCsv` (BOM + RFC 4180 quoting).
- **UI**: `/admin/orders` — status filter chips with live counts (horizontal-scroll on mobile), search, table with status badges, per-row next-step button + confirm-before-cancel, CSV export of the current filtered view; `/admin/orders/[id]` — customer/delivery/payment details, items with snapshots, total, and the same transition actions (router.refresh after a move). Orders enabled in the admin sidebar.
- **Tests**: 21 new tests against the mock's faithful `transition_order_status` simulation — full forward walk, rejected skips/backwards/terminal/unknown moves, cancel restores stock exactly once (deleted-product lines skipped), list/detail merges, CSV escaping. → 92/92 green, tsc + lint clean.
- **To verify as Admin**: the migration must be applied to the project first (create the function in the SQL editor). Then on `/admin/orders`: move an order forward, cancel one and confirm stock returns on the product, export CSV, open an order detail.
