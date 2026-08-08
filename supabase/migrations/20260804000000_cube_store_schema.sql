-- Cube Store — schema foundation (ticket 01)
-- Applies the SRS §05 schema (amended) and the RLS posture from ADR-0004:
--   catalog (categories, products) is world-readable
--   customers, orders, order_items are INSERT-only for anon (guest checkout), never SELECT-able by anon
--   Admins (role claim in auth app_metadata, ADR-0001) have full access

-- 1. Extension: fuzzy name search for the catalog (used by ticket 03)
create extension if not exists pg_trgm;

-- 2. Custom enums
create type product_status as enum ('active', 'inactive');
create type order_status as enum ('pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled');
create type payment_method as enum ('cod', 'ewallet', 'bank_transfer');
create type customer_account_status as enum ('active', 'inactive');

-- 3. Admin check: reads the `role: admin` claim from the JWT's app_metadata.
--    False for anon and for authenticated Users without the claim.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- 4. Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null unique,
  slug varchar(100) not null unique,
  created_at timestamptz not null default now()
);

-- 5. Products (category deletion is restricted, per SRS)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete restrict,
  name varchar(255) not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_url text not null,
  status product_status not null default 'active',
  created_at timestamptz not null default now()
);

-- 6. Customers (guest checkout rows, ADR-0001)
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(150) not null,
  email varchar(150) not null unique,
  contact_number varchar(50) not null,
  account_status customer_account_status not null default 'active',
  created_at timestamptz not null default now()
);

-- 7. Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number varchar(30) not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  delivery_address text not null,
  payment_method payment_method not null,
  status order_status not null default 'pending',
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

-- 8. Order items — unit_price is a snapshot at purchase time (ADR-0003)
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

-- 9. Indexes
create index products_category_id_idx on public.products(category_id);
create index products_status_idx on public.products(status);
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index categories_name_trgm_idx on public.categories using gin (name gin_trgm_ops);
create index orders_status_idx on public.orders(status);
create index orders_customer_id_idx on public.orders(customer_id);
create index orders_created_at_idx on public.orders(created_at desc);
create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_product_id_idx on public.order_items(product_id);

-- 10. Row-level security (ADR-0004)
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Catalog: world-readable
create policy "Catalog categories are publicly readable"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Catalog products are publicly readable"
  on public.products for select
  to anon, authenticated
  using (true);

-- Catalog writes: Admins only
create policy "Admins can manage categories"
  on public.categories for all
  to anon, authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage products"
  on public.products for all
  to anon, authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Guest checkout: anon may INSERT order data but never SELECT it
create policy "Guests can create customers"
  on public.customers for insert
  to anon, authenticated
  with check (true);

create policy "Guests can create orders"
  on public.orders for insert
  to anon, authenticated
  with check (true);

create policy "Guests can create order items"
  on public.order_items for insert
  to anon, authenticated
  with check (true);

-- Order data: Admins only for everything else
create policy "Admins can manage customers"
  on public.customers for all
  to anon, authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage orders"
  on public.orders for all
  to anon, authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can manage order items"
  on public.order_items for all
  to anon, authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 11. Storage: public product-images bucket, admin-write only (ticket 01 / 09)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'product-images';

create policy "Product images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Admins can upload product images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can update product images"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can delete product images"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- One-off admin bootstrap (run in the Supabase SQL editor once per Admin):
--   update auth.users
--   set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
--   where email = 'admin@example.com';
-- The User must sign out and back in for the new claim to appear in their JWT.
-- ---------------------------------------------------------------------------
