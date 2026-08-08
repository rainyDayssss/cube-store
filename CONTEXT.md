# Cube Store

A Next.js + Supabase e-commerce storefront with guest checkout and an authenticated admin dashboard.

## Language

### People & roles

**Customer**:
A person who places an order without an account; their details are captured at checkout and stored in the `customers` table.
_Avoid_: Client, buyer, shopper, account holder

**User**:
An operator with a Supabase Auth account who manages the store through the admin dashboard. A Customer is never a User, and vice versa.
_Avoid_: Member, account holder

**Admin**:
A User whose Auth account carries the `role: admin` claim in `app_metadata`, granting access to `/admin`. The same claim drives RLS write policies.
_Avoid_: Operator, manager, staff

### Catalog

**Product**:
An item in the storefront catalog, belonging to a Category, with a price, a stock quantity, and a status of `active` or `inactive`. Whether it can be ordered is derived from `stock_quantity`, not stored on the product.
_Avoid_: Item, SKU, listing

**Category**:
A named grouping of products (`name`, `slug`). Protected from deletion while any Product references it.

**Product status**:
`active` (listed in the storefront) or `inactive` (hidden). Availability is not a status — it is derived from `stock_quantity` (0 = out of stock).
_Avoid_: Availability, stock state

**Product image**:
The single picture a Product must always have, re-encoded server-side to WebP (max 1600px, quality 80) and stored in the `product-images` bucket; the Storage object is removed with the Product (ADR-0008).
_Avoid_: Photo, thumbnail, artwork

**Cart**:
A customer's in-progress selection, held only in the browser (`localStorage`, Zustand). It becomes an Order only when checkout completes. Its lines reconcile against the live Catalog — prices and stock refresh, and retired Products get flagged for removal (ADR-0013).
_Avoid_: Basket, bag, selection

**Live sync**:
Pages updating without a manual refresh when the data they show changes: a Supabase Realtime (Postgres Changes) subscription per open tab triggers a re-render when catalog or order rows change (ADR-0011). The storefront watches the world-readable catalog; the admin watches orders, customers, and catalog alike. Hidden tabs drop refreshes and catch up the moment they become visible.
_Avoid_: Polling, manual refresh, realtime catalog

### Orders

**Order**:
A customer's purchase placed via guest checkout, identified by a unique order number. Stock is deducted atomically at placement; cancelling an order restores it.
_Avoid_: Purchase, transaction, sale

**Order status**:
The lifecycle `pending → confirmed → preparing → shipped → completed`. `cancelled` is an alternative terminal state, reachable by an Admin from any state except `completed`; only a cancellation restores stock.
_Avoid_: Stage, phase

**Order number**:
The unique human-readable identifier `ORD-YYYYMMDD-XXXX` generated at checkout (per-day counter, server-side).
_Avoid_: Tracking number, reference
