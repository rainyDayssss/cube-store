# Cube Store — Storefront & Admin E-Commerce

Status: ready-for-agent

## Problem Statement

The project is a cleaned Next.js + Supabase starter shell — a placeholder homepage, working auth plumbing, and nothing else. The CubeTech assessment requires a complete e-commerce application: a public storefront where Customers can browse and place orders without creating an account, plus an authenticated Admin dashboard for managing the catalog and orders.

## Solution

A mobile-first storefront (Home, Product Catalog, Product Details, Cart, guest Checkout with confirmation modal and Order number) and an Admin dashboard (KPI overview, Product CRUD with image upload, Category CRUD with a deletion guard, Order lifecycle management with automatic stock restoration, Customer aggregates, and CSV export). Customers never need an account — checkout is guest-only — while Supabase Auth exists solely to gate `/admin` for Admins. All ordering rules follow the decisions recorded in `docs/adr/0001–0004` and the vocabulary in `CONTEXT.md`.

## User Stories

### Storefront

1. As a Customer, I want to see a branded home page with a hero promotional banner, a featured Category grid, and featured Products, so that I can discover what's on offer.
2. As a Customer, I want to browse all Products in a responsive grid (2 columns mobile, 3 tablet, 4 desktop), so that I can find items on any device.
3. As a Customer, I want to search Products instantly by name, so that I can find a specific item quickly.
4. As a Customer, I want to filter the catalog by Category, so that I can narrow down what I'm browsing.
5. As a Customer, I want to sort Products by price (low to high / high to low), so that I can shop within my budget.
6. As a Customer, I want my search/filter/sort state and pagination preserved in the URL, so that a refresh doesn't lose my place.
7. As a Customer, I want a Product Details page with a high-res image, description, price, a stock availability badge, a quantity selector, and Related Products, so that I can decide whether to buy.
8. As a Customer, I want the quantity selector capped at the available stock, so that I cannot select more than is available.
9. As a Customer, I want to add Products to my Cart and open a Cart page, so that I can review my selection before ordering.
10. As a Customer, I want to change quantities and remove items in the Cart, with a subtotal and total breakdown, so that I can adjust my order.
11. As a Customer, I want my Cart to persist in my browser between visits, so that I don't lose my selection.
12. As a Customer, I want Cart quantities capped at current stock, so that I can't order more than is in stock.
13. As a Customer, I want a guest checkout form for my name, email, contact number, address, and notes, so that I can place an Order without an account.
14. As a Customer, I want to choose a payment method (COD, e-wallet, bank transfer) knowing it only records my choice and processes no payment, so that I can indicate how I intend to pay.
15. As a Customer, I want to submit my Order and see a confirmation modal with an order summary and my Order number, so that I know my order was placed.
16. As a Customer, I want my Cart cleared after a successful Order, so that I don't accidentally re-order the same items.
17. As a Customer, I want checkout to reject with a clear message when an item's stock changed since I added it to my Cart, so that I never pay for something that's gone.
18. As a Customer, I want stock deducted the moment my Order is placed, so that the last units of a Product aren't oversold.
19. As a Customer, I want out-of-stock Products badged clearly, so that I don't attempt to order unavailable items.
20. As a Customer, I want the app fully responsive on mobile, tablet, and desktop, so that I can shop from any device.

### Admin

21. As an Admin, I want to sign in with my Auth account, so that I can access the dashboard.
22. As a User without the admin role, I want to be redirected away from every admin page, so that I can't see management data.
23. As an Admin, I want to see six KPI cards (total Products, total Orders, pending Orders, completed Orders, total Customers, total sales), so that I can gauge the store at a glance.
24. As an Admin, I want to create, read, update, and delete Products, so that I can manage the catalog.
25. As an Admin, I want to upload a Product image directly to Storage with a preview and validation, so that Products look good.
26. As an Admin, I want to toggle a Product's status between active and inactive, so that I can control its visibility.
27. As an Admin, I want to search and filter Products by Category in the admin, so that I can manage a large catalog.
28. As an Admin, I want to create, rename, and delete Categories, so that I can organize the catalog.
29. As an Admin, I want the app to block deleting a Category that still has Products, showing a clear toast, so that Products are never orphaned.
30. As an Admin, I want to view Orders in a table and move them through the lifecycle (pending → confirmed → preparing → shipped → completed), so that I can manage fulfillment.
31. As an Admin, I want to cancel an Order from any state except completed, so that I can stop bad orders.
32. As an Admin, I want stock restored automatically when I cancel an Order, so that inventory stays accurate.
33. As an Admin, I want to export Orders to CSV, so that I can work with the data in spreadsheets.
34. As an Admin, I want to see Customers with their Order counts and total purchase amounts computed live, so that I understand my customer base.
35. As an Admin, I want to see Order totals and prices exactly as they were at purchase time, so that later price changes never distort history.

## Implementation Decisions

- **Stack:** Next.js App Router (Server Components, Server Actions), Supabase (PostgreSQL, Storage, Auth), Zustand + Tailwind CSS, deployed on Vercel. The repo currently runs Next.js 16.2.12 (spec targets 15; no feature change required).
- **Guest checkout, Auth reserved for Admins (ADR-0001):** Checkout writes the `customers` row and order data directly with no account. The existing auth flow (sign-up / login / password reset already in the repo) is repurposed for Admins only. No customer account area, no "My Orders".
- **Admin identity:** A User becomes an Admin via the `role: admin` claim in Auth `app_metadata`. Every admin route group is gated server-side by checking that claim before rendering; the same claim drives RLS write policies. Non-admin Users are redirected away.
- **RLS posture (ADR-0004):** RLS enabled. `categories` and `products` are SELECT-able by anon (public catalog). `customers`, `orders`, and `order_items` allow anon INSERT only — guest checkout writes them, but anon has no SELECT. Admins get full access via the `auth.jwt()` claim. All order-table writes are validated server-side in Server Actions, never trusted from the client.
- **Checkout transaction (ADR-0002):** Placing an Order runs inside one transaction: re-validate `stock_quantity` for every line against the Cart contents, create the Customer + Order + Order items, decrement stock, and generate the Order number. Any failure rolls back the whole Order. Insufficient stock rejects with a per-item message.
- **Order numbers:** `ORD-YYYYMMDD-XXXX` where `XXXX` is a per-day counter computed inside the checkout transaction, with the `UNIQUE` constraint as the safety net and a bounded retry on collision.
- **Price snapshots (ADR-0003):** `unit_price` on order items and `total_amount` on the Order are denormalized copies of Product price at purchase time. Order and order_items rows are immutable after creation.
- **Order lifecycle:** `pending → confirmed → preparing → shipped → completed`, with `cancelled` as an alternative terminal state. Cancellation is Admin-only and reachable from any state except `completed`; cancelling restores stock (ADR-0002).
- **Product status:** `product_status` is `('active', 'inactive')` only. Out-of-stock is derived from `stock_quantity` (0 = out), not stored as a status; the storefront badge derives from it.
- **Record-only payments:** `payment_method` (`cod`, `ewallet`, `bank_transfer`) is metadata captured at checkout. No gateway, no payment_status field, no webhooks.
- **Images:** Products require an image (`image_url` NOT NULL) uploaded to a public Supabase Storage bucket, with Storage policies allowing writes only for Admins. Client-side validation (jpg/png/webp, ≤ 5MB) with server-side re-validation.
- **Cart:** Zustand store persisted to `localStorage`. Client-side only; quantities capped at stock. Stock is re-validated server-side at checkout — the client cap is UX, not a correctness guarantee.
- **Customer aggregates:** number of Orders and total purchase amount per Customer are computed at query time via relational joins, never stored (avoids desynchronization).
- **Category deletion guard:** `categories.id` is referenced by `products.category_id` with `ON DELETE RESTRICT`; the admin UI surfaces the resulting constraint failure as a friendly toast.
- **Schema:** enums `product_status` (active/inactive), `order_status`, `payment_method`, `customer_account_status`; tables `categories`, `products`, `customers`, `orders`, `order_items` as specified in `SRS.md` §05 (amended). A migration ships the schema plus all RLS policies.
- **CSV export:** Admin order table exports a spreadsheet-compatible CSV of the current filtered view.
- **Progressive loading:** Skeleton loaders via React Suspense / streaming for data-dependent sections.
- **No `/track-order`:** public order tracking is deferred (see `SRS.md` Revisions); the confirmation modal still shows the Order number.

## Testing Decisions

- **What makes a good test:** tests exercise the *external behavior* of the store service — the checkout contract (stock deducted atomically, stale stock rejected, prices snapshotted, unique sequential Order numbers) and the lifecycle contract (valid transitions enforced, cancel from any state except completed restores stock). They do not inspect implementation internals such as Zustand wiring or React rendering.
- **Module tested — the single seam:** a thin store service layer (`placeOrder`, `transitionOrderStatus`, catalog queries) that Server Actions and pages call. Tests run against a mocked Supabase client (or an in-memory fake implementing the same interface), so no live Supabase project, env vars, or browser is required.
- **Prior art:** none — the repo has no test infrastructure today; this spec introduces the first. The runner choice (e.g., Vitest) is an implementation detail left to the implementer.

## Out of Scope

- Public order tracking (`/track-order`) — deferred.
- Payment gateway integration and any notion of paid/unpaid.
- Customer accounts, "My Orders", or anything requiring Customer authentication.
- Inventory features beyond `stock_quantity` (variants, SKUs, bundles, low-stock alerts).
- Email notifications (order confirmation, shipping updates).
- i18n and multi-currency.
- Real-time/push order updates.
- Analytics beyond the six KPI cards.

## Further Notes

- Env vars required: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the admin bootstrap (setting `role: admin` on an Auth account) is a one-off Supabase dashboard/script step.
- Source of truth: `SRS.md` (with the Revisions section) for feature detail; `CONTEXT.md` for vocabulary; `docs/adr/0001–0004` for the locked decisions this spec must not contradict.
- The repo's existing auth pages and `proxy.ts` session plumbing are reused for the Admin side, not rebuilt.
