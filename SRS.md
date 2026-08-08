  System Architecture & Technical Specification | CubeTech E-Commerce

CT

CubeTech E-Commerce Assessment
==============================

Full-Stack Technical Specification

Spec 100% Locked Next.js 15 + Supabase

01. Executive & Architecture Overview
-------------------------------------

Core Stack

Next.js 15 (App Router)

Database & BaaS

Supabase (PostgreSQL & Storage)

State & Styling

Zustand + Tailwind CSS

Deployment Target

Vercel Platform

02. Frontend & Application Routes
---------------------------------

### Customer Storefront Pages

Mobile-First & Responsive

*   **Home Page (`/`):** Header/Footer, Store branding, Hero Promotional Banner, Featured Category grid, and Featured Products showcase.
*   **Product Catalog (`/products`):** 2-column responsive product grid (`grid-cols-2 md:grid-cols-4`) featuring instant search, Category filter dropdown, and Price sorting (Low to High / High to Low).
*   **Product Details (`/products/[id]`):** High-res image, stock availability badges, description, interactive quantity selector, Add to Cart action, and Related Products section.
*   **Shopping Cart (`/cart`):** Zustand persistent store (`localStorage`) managing quantity updates, item removal, stock limit caps, subtotal, and total breakdown.
*   **Checkout Flow (`/checkout`):** Customer information form (Name, Email, Contact Number, Address, Notes, Payment Method choice) triggering Next.js Server Actions. Generates confirmation modal with order summary and tracking ID.

### Admin Dashboard Interface

Management CMS

*   **Dashboard Overview (`/admin`):** 6 aggregate summary KPI cards: Total Products, Total Orders, Pending Orders, Completed Orders, Total Customers, and Total Sales metrics.
*   **Product Management (`/admin/products`):** Full CRUD operations, search/category filter, mandatory image file upload directly to Supabase Storage bucket, and product status toggling (Active, Inactive).
*   **Category Management (`/admin/categories`):** Dedicated interface for Category CRUD. Enforces deletion guard (\`ON DELETE RESTRICT\`) displaying toast alerts if linked products exist.
*   **Order Management (`/admin/orders`):** Data table managing order status lifecycle updates (Pending -> Confirmed -> Preparing -> Shipped -> Completed / Cancelled). Triggers automated stock restoration on cancellation.
*   **Customer Management (`/admin/customers`):** Dynamic list aggregating Number of Orders and Total Purchase Amount computed live via relational joins.

03. Cross-Platform & Responsive Design Specs
--------------------------------------------

### 📱 Mobile Viewports (< 640px)

Sticky search bar header, collapsible slide-out drawer navigation, compact 2-column product grid with 2-line truncated titles, sticky bottom checkout action bar.

### 💻 Tablet Viewports (640px - 1024px)

Adaptive 3-column product grid, collapsible side navigation for admin panel, full-width checkout forms.

### 🖥️ Desktop Viewports (> 1024px)

4-column product grid, persistent sidebar navigation for Admin Dashboard, side-by-side cart summary & checkout breakdown layout.

04. Implemented High-Impact Bonus Features
------------------------------------------

🖼️ Image Upload

Direct file upload to Supabase Storage with preview and validation.

📊 Order CSV Export

One-click spreadsheet download utility for admin order records.

⚡ Skeleton Loaders

Next.js App Router streaming loaders preventing visual UI layout shifts.

🔗 Pagination & Sync

URL search params (`?page=2`) preserved on browser refresh.

05. Relational Database Schema
------------------------------

\-- 1. Custom Enums
CREATE TYPE product\_status AS ENUM ('active', 'inactive');
CREATE TYPE order\_status AS ENUM ('pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled');
CREATE TYPE payment\_method AS ENUM ('cod', 'ewallet', 'bank\_transfer');
CREATE TYPE customer\_account\_status AS ENUM ('active', 'inactive');

\-- 2. Categories Table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

\-- 3. Products Table (Category Restricted Deletion)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),
  category\_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock\_quantity INT NOT NULL DEFAULT 0 CHECK (stock\_quantity >= 0),
  image\_url TEXT NOT NULL,
  status product\_status DEFAULT 'active',
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

\-- 4. Customers Table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),
  full\_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  contact\_number VARCHAR(50) NOT NULL,
  account\_status customer\_account\_status DEFAULT 'active',
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

\-- 5. Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),
  order\_number VARCHAR(30) NOT NULL UNIQUE,
  customer\_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  delivery\_address TEXT NOT NULL,
  payment\_method payment\_method NOT NULL,
  status order\_status DEFAULT 'pending',
  total\_amount DECIMAL(10,2) NOT NULL CHECK (total\_amount >= 0),
  notes TEXT,
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

\-- 6. Order Items Table
CREATE TABLE order\_items (
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),
  order\_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product\_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit\_price DECIMAL(10,2) NOT NULL,
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
        

06. Key Architecture Decisions
------------------------------

### 1\. Immediate Deduction & Restock

Stock is deducted immediately upon placing an order (`pending`) to prevent overselling. If an admin cancels the order, stock is automatically restored to the product.

### 2\. Category Integrity Guard

Enforces `ON DELETE RESTRICT` on categories. Prevents orphaned products by surfacing clear user-facing error toasts when attempting to delete assigned categories.

### 3\. Dynamic Customer Aggregates

`total_purchase_amount` and `number_of_orders` are dynamically computed at query time via Supabase relational joins, preventing data desynchronization.

CubeTech Assessment Specification • 100% Shared Understanding Reached

## Revisions (grill-with-docs session)

- **Removed** `/track-order` (order tracking) — deferred; the checkout confirmation modal still shows the order number.
- **`product_status` simplified** to `('active', 'inactive')` — out-of-stock is now derived from `stock_quantity`, not stored as a status.
- **Clarified decisions** (see `docs/adr/`): guest checkout with Auth reserved for Admins (role claim in `app_metadata`); immediate stock deduction with atomic re-validation at checkout; price snapshots on orders; RLS posture — catalog public-read, anon INSERT-only for order tables, Admins full access.
- **Record-only payments** — `payment_method` is metadata; no gateway or payment_status.
- **Order numbers** — `ORD-YYYYMMDD-XXXX` with a server-side per-day counter.
- **Product images** — public Supabase Storage bucket, admin-write policies, jpg/png/webp ≤ 5MB.
- Note: spec targets Next.js 15; the repo currently runs Next.js 16.2.12.
- **Single application (ADR-0006):** a separate admin project (`cube-store-admin`) sharing one Supabase database was briefly scaffolded (ADR-0005), then merged back into this repo — the admin dashboard lives here as the `/admin` route group. Admin sections of this SRS (§02 admin pages) describe that area.

## Revisions (UI/UX improvement session)

- **Footer redesign** — expanded from copyright-only to a 4-column layout: brand + description, shop links, contact information (email, phone, address — mock data), and social links (Facebook — mock data). Theme switcher retained in the bottom bar.
- **Product card enhancements** — cards now display the category label, an explicit "View Details" button, and an "Add to Cart" button (instant add, 1 item). The "Out of stock" badge now includes an icon (`XCircle`) alongside the text for colorblind accessibility.
- **Product status filter (admin)** — added a status dropdown filter ("All statuses / Active / Inactive") to the products manager toolbar, matching the existing category filter pattern. Filters client-side over the fetched product list.
- **Customer account status column (admin)** — the `account_status` field (already returned by `customer_summaries` view) is now displayed as a styled badge (Active = green dot, Inactive = gray dot) in the customers table.
- **Admin dashboard charts** — added two Recharts visualizations below the KPI cards: "Orders over time" (line chart) and "Revenue by month" (bar chart), both showing the last 6 months. Data is queried directly from the `orders` table, excluding cancelled orders.
- **Accessibility improvements** — added visible focus rings (`focus-visible:ring-1`) to cart quantity stepper buttons (both storefront cart and product detail page). Added icon + text pairing to product card stock badges.
- **Out of stock remains derived** — confirmed that `stock_quantity === 0` is the source of truth; no third status was added to the `product_status` enum.

## Revisions (UI/UX fixes session)

- **Promotional carousel** — added a rotating banner section below the hero with 3 slides (gradient backgrounds + text). Auto-rotates every 5 seconds with arrow and dot navigation.
- **Duplicate search bar fix** — header search bar is now hidden on the `/products` page where the toolbar search (instant, debounced) takes over. Header search remains on all other pages.
- **Sort dropdown cleanup** — removed "Newest" from the price sort dropdown (it was misleading as a price sort option). Dropdown now shows "Sort by price" placeholder + "Price: Low to High" / "Price: High to Low". Server-side default remains "newest" (by `created_at`).
- **Mobile button layout** — product card "View Details" and "Add to Cart" buttons now stack vertically on small screens instead of side-by-side, preventing text from being chopped.
- **Product detail stock number** — the stock badge now shows the actual quantity for in-stock items (e.g., "42 in stock") instead of just "In stock". Low-stock ("Only X left") and out-of-stock ("Out of stock") badges unchanged.