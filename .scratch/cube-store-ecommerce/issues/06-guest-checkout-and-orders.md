# 06 — Guest checkout & order placement

**What to build:** Guest checkout: a customer-information form (name, email, contact number, address, notes, payment method choice) submitted via a Server Action that calls `placeOrder` — one atomic transaction re-validating stock for every line, creating the Customer, Order, and order items, deducting stock, and generating the `ORD-YYYYMMDD-XXXX` Order number (per-day counter, unique-constrained, retried on collision). Success shows a confirmation modal with the order summary and Order number and clears the Cart; any insufficient-stock line rejects the whole Order with a clear per-item message. Prices are snapshotted onto the Order (ADR-0003), and payment is record-only. Includes the `placeOrder` tests — the single seam for ordering behaviour.

**Blocked by:** 05

**Status:** ready-for-human

- [x] `placeOrder` succeeds end-to-end: Customer + Order + items created, stock deducted, Order number sequential per day, prices snapshotted (ADR-0003)
- [x] `placeOrder` rejects atomically when any line's stock is insufficient — no partial writes, clear per-item error
- [x] Confirmation modal shows the summary and Order number; Cart cleared; no Customer account is created (guest checkout, ADR-0001)
- [x] Payment method is captured as record-only metadata (no gateway, no payment_status)
- [x] RLS allows anon checkout writes while blocking anon reads of order tables (ADR-0004)
- [x] Tests cover: success, stale-stock rejection, atomicity on failure, and Order-number uniqueness

**Review round applied:** duplicate cart lines rejected in the SQL (would otherwise bypass per-line stock checks); `order_number_counters` locked down (RLS on, revoked from anon/authenticated); SQL `VALIDATION` responses mapped in the seam; dead re-export removed; post-success page shows the empty state behind the modal. Fixed a live-found crash: `{ ...items }` produced an object of numeric keys for the modal snapshot — now `[...items]`.

**Live-verified against Supabase:** two real orders placed through the browser flow (`ORD-20260806-0001` and `-0002`, sequential per day), confirmation modal rendered with the order number and total, cart cleared after success, no console errors.
