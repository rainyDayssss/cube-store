# Cube Store

A complete e-commerce storefront and admin dashboard built with [Next.js](https://nextjs.org) and [Supabase](https://supabase.com).

Customers browse a responsive storefront (catalog, product details, cart, guest checkout) and place orders **without creating an account**. Supabase Auth exists solely to gate the **Admin dashboard** at `/admin` — a role-protected area for managing the catalog, orders, and customers.

All 11 feature tickets are implemented and resolved, with **129/129 unit tests**, clean `tsc`/ESLint, and a verified production build.

## Features

**Storefront (guest-only, no account needed)**

- Responsive home page with hero banner, featured category grid, and featured products
- Product catalog with **live search**, category filter, price sorting, and pagination — state preserved in the URL
- Product details with image, stock-availability badge, **quantity selector capped at stock**, and related products
- Cart powered by **Zustand + `localStorage`** (persists between visits), quantity updates capped at stock
- Guest checkout: name / email / contact / address / notes, record-only payment method (COD / e-wallet / bank transfer)
- **Atomic order placement** — per-day `ORD-YYYYMMDD-XXXX` order numbers, price snapshots, immediate stock deduction, per-item stock rejection, confirmation modal with order summary

**Admin (role-gated at `/admin`)**

- KPI dashboard with six live cards (products, orders, pending, completed, customers, sales — sales excludes cancelled)
- **Categories** — create, rename (auto-slug), delete with a guard (categories holding products are protected)
- **Products** — searchable/filterable table, create/edit modal, **image upload to Supabase Storage** (jpg/png/webp ≤ 5 MB, preview + validation, auto-compressed server-side to WebP ≤ 1600px; replaced/deleted images are removed from the bucket), active/inactive visibility toggle
- **Orders** — filterable list, status badges, **lifecycle transitions** (`pending → confirmed → preparing → shipped → completed`), **cancel from any state except completed with automatic stock restore**, order detail view, **CSV export** of the current filtered view
- **Customers** — searchable/sortable list with **live order counts and total spend** (computed at query time; cancelled orders excluded)

## Stack

- **Next.js** (App Router, React 19) — server components, server actions, streaming
- **Supabase** — PostgreSQL (RLS-enabled), Auth (`@supabase/ssr` cookies), Storage
- **Zustand** — persisted cart state
- **Tailwind CSS** + **shadcn/ui** components
- **next-themes** — light / dark / system theming
- **Vitest** — unit tests against a mocked Supabase client

## Getting started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at [database.new](https://database.new).

3. **Set the environment variables** — see [Environment variables](#environment-variables) below.

4. **Apply the database migrations** (see [Database](#database) below).

5. **Run the development server:**

   ```bash
   npm run dev
   ```

   The app runs at [localhost:3000](http://localhost:3000).

### Environment variables

This project reads its Supabase connection from a local **`.env.local`** file (already present in the repo — gitignored, so never commit it). It holds two values:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL, e.g. `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your publishable (or legacy anon) key |

Both come from the Supabase dashboard → **Project Settings → API** (Project URL and Project API keys). Restart the dev server after changing the file. The same two variables must be set on any host you deploy to.

## Scripts

| Command            | Description                      |
| ------------------ | -------------------------------- |
| `npm run dev`      | Development server               |
| `npm run build`    | Production build                 |
| `npm run start`    | Serve the production build       |
| `npm run lint`     | Run ESLint                       |
| `npm test`         | Run the unit tests (Vitest)      |

## Project structure

Feature-driven layout (ADR-0009): each business capability is a self-contained
`features/<feature>/` module owning its UI, server actions, business logic, and
unit tests; `app/` holds thin route shells that compose features.

```
app/                          Thin route shells only — pages compose features
├── page.tsx                  Storefront home (hero + featured catalog)
├── admin/                    Role-gated dashboard
│   ├── page.tsx              KPI overview
│   ├── categories/  products/  orders/  customers/   Manager pages (+ detail)
├── auth/                     Login, password reset, confirm
├── checkout/  cart/  products/    Storefront pages
features/
├── catalog/                  Storefront browsing
│   ├── components/           Hero, featured, grid, toolbar, product card,
│   │                         product detail, add-to-cart
│   └── lib/                  catalog.ts + catalog.test.ts (search/filter/sort)
├── cart/                     Cart badge + view, Zustand store (lib/cart.ts)
├── checkout/                 Checkout view + confirmation modal, lib/checkout.ts
│                             (placeOrder seam) + actions.ts
├── auth/                     Login / forgot / update-password forms, logout
└── admin/                    The whole dashboard
    ├── components/           Gate, nav, KPI cards + all five managers
    ├── lib/                  admin.ts (KPIs) + categories/ products/ orders/
    │                         customers/ (logic + tests per manager)
    └── actions/              Server actions per manager (categories/products/orders)
components/
├── ui/                       shadcn/ui primitives
└── storefront-header.tsx, storefront-drawer.tsx, site-footer.tsx,
    theme-switcher.tsx        Shared storefront chrome (cross-feature, ADR-0009)
lib/
├── supabase/                 Browser / server / proxy Supabase clients
├── testing/                  The single shared mock of the Supabase client
└── utils.ts
supabase/
└── migrations/               Schema, seed, and function migrations (in order)
proxy.ts                      Session-refresh proxy (Supabase auth cookies)
```

Each feature is self-contained: its components, Server Actions, business logic,
and `.test.ts` files live together under `features/<feature>/`, and every feature
module takes a Supabase client so tests run against the shared in-memory mock in
`lib/testing/` — **no live Supabase project or env vars are needed to run the
test suite**. Trust boundaries like stock validation and order atomicity live in
Postgres functions, never in the client.

## Database

Apply `supabase/migrations/` **in filename order**. From the Supabase **SQL editor** (copy-paste each file and run), or with the [Supabase CLI](https://supabase.com/docs/guides/cli) on a fresh project:

```bash
supabase db push
```

| Migration | What it adds |
| --- | --- |
| `20260804000000_cube_store_schema.sql` | Schema (`categories`, `products`, `customers`, `orders`, `order_items` + enums), **RLS policies** (catalog world-readable; order tables INSERT-only for guests, Admins full access), the public `product-images` storage bucket (admin-write only) |
| `20260804000001_seed_catalog.sql` | 4 Categories + 11 Products (including one out-of-stock and one inactive) |
| `20260806000000_guest_checkout.sql` | `place_order` — atomic guest-checkout function (stock re-validation, customer upsert, price snapshots, per-day order numbers) |
| `20260807000000_admin_order_transitions.sql` | `transition_order_status` — admin order lifecycle with atomic stock restore on cancel |
| `20260807000001_seed_admin.sql` | Seeds the `admin@example.com` Admin account in Supabase Auth (pre-confirmed, `role: admin` claim, token columns set to `''`, plus its `auth.identities` row) |
| `20260808000000_seed_admin_identity_fix.sql` | Backfill for projects seeded with the original admin seed: replaces NULL token columns with `''` and creates the `email` identity row — GoTrue returns an HTTP 500 `Database error querying schema` on login until both are fixed (supabase/auth#1940) |

After applying the first two, run `supabase/verify-ticket-01.sql` in the SQL editor — it prints a PASS/FAIL report covering schema, RLS behaviour, storage, and seed contents.

### Seeded Admin

The latest migration (`20260807000001_seed_admin.sql`) creates the initial Admin account:

- **Email:** `admin@example.com`
- **Password:** `admin123`

It is pre-confirmed and idempotent (skipped if the email already exists). **Change the password after the first login** — e.g. from the Supabase dashboard (Authentication → Users) or a password-reset email.

> **Existing projects:** if you applied `20260807000001_seed_admin.sql` before
> `20260808000000_seed_admin_identity_fix.sql` existed, run the fix migration
> in the SQL editor — otherwise login for the seeded account fails with an
> HTTP 500 `Database error querying schema`: the user row has NULL token
> columns GoTrue scans as strings, and the `auth.identities` row is missing.

### Promoting another Admin

Admins are identified by the `role: admin` claim in their Auth account's `app_metadata`. Promote a User once, from the SQL editor:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
where email = 'admin@example.com';
```

The User must **sign out and sign back in** for the claim to appear in their session.

## Deployment

The app is a standard Next.js + Supabase deployment (verified with a production build and smoke test):

1. **Supabase** — apply the migrations and promote your admin account (above).
2. **Host** — deploy to [Vercel](https://vercel.com) (or any Node host) with the build command `npm run build` and start command `npm run start`.
3. **Environment variables** — set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on the host.
4. Sign in with your admin account and open `/admin` to manage the store.

## Testing

```bash
npm test
```

129 unit tests cover the feature seams: catalog queries and filters, the persisted cart, checkout atomicity and order-number sequencing, admin KPIs, category/product CRUD (including the guarded delete and image validation), the order lifecycle (valid moves, rejected moves, **cancel restores stock exactly once**), customer aggregates, CSV export, plus the mocked Supabase client and the route-mode split.
