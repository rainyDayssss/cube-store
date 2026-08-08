-- ============================================================================
-- Cube Store — ticket 01 verification script
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor AFTER applying both migrations
-- (20260804000000_cube_store_schema.sql, 20260804000001_seed_catalog.sql).
-- It mechanically checks the four database-verification acceptance criteria
-- and prints a PASS/FAIL report (plus role-behaviour checks as NOTICE lines).
--
-- Expected result: every row PASS, and the behavioural notices read PASS.
-- Any FAIL means the migration did not land as specified — fix and re-run.
-- ============================================================================

create temp table if not exists _verify (
  criterion  int,
  check_name text,
  ok         boolean,
  detail     text
);

-- ---------------------------------------------------------------------------
-- Criterion 1 — migration applies cleanly (tables, enums, checks, FKs)
-- ---------------------------------------------------------------------------

insert into _verify (criterion, check_name, ok, detail)
select 1, 'table categories exists',
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'categories'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'table products exists',
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'products'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'table customers exists',
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'customers'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'table orders exists',
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'orders'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'table order_items exists',
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'order_items'), '';

insert into _verify (criterion, check_name, ok, detail)
select 1, 'enum product_status = (active, inactive)',
  (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'product_status') = 'active,inactive', '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'enum order_status = (pending, confirmed, preparing, shipped, completed, cancelled)',
  (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'order_status') = 'pending,confirmed,preparing,shipped,completed,cancelled', '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'enum payment_method = (cod, ewallet, bank_transfer)',
  (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'payment_method') = 'cod,ewallet,bank_transfer', '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'enum customer_account_status = (active, inactive)',
  (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'customer_account_status') = 'active,inactive', '';

-- CHECK constraints (price, stock, total, quantity)
insert into _verify (criterion, check_name, ok, detail)
select 1, 'products CHECK price >= 0', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'products' and c.conname = 'products_price_check'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'products CHECK stock_quantity >= 0', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'products' and c.conname = 'products_stock_quantity_check'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'orders CHECK total_amount >= 0', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'orders' and c.conname = 'orders_total_amount_check'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'order_items CHECK quantity > 0', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'order_items' and c.conname = 'order_items_quantity_check'), '';

-- Referential actions
insert into _verify (criterion, check_name, ok, detail)
select 1, 'products.category_id FK -> categories ON DELETE RESTRICT', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'products' and c.conname = 'products_category_id_fkey' and c.confdeltype = 'r'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'orders.customer_id FK -> customers ON DELETE RESTRICT', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'orders' and c.conname = 'orders_customer_id_fkey' and c.confdeltype = 'r'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'order_items.order_id FK -> orders ON DELETE CASCADE', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'order_items' and c.conname = 'order_items_order_id_fkey' and c.confdeltype = 'c'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'order_items.product_id FK -> products ON DELETE SET NULL', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'order_items' and c.conname = 'order_items_product_id_fkey' and c.confdeltype = 'n'), '';

-- Uniques + NOT NULL image_url
insert into _verify (criterion, check_name, ok, detail)
select 1, 'categories.name unique', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'categories' and c.conname = 'categories_name_key'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'categories.slug unique', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'categories' and c.conname = 'categories_slug_key'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'customers.email unique', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'customers' and c.conname = 'customers_email_key'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'orders.order_number unique', exists (
  select 1 from pg_constraint c
  join pg_class r on c.conrelid = r.oid join pg_namespace n on r.relnamespace = n.oid
  where n.nspname = 'public' and r.relname = 'orders' and c.conname = 'orders_order_number_key'), '';
insert into _verify (criterion, check_name, ok, detail)
select 1, 'products.image_url NOT NULL', (
  select is_nullable = 'NO' from information_schema.columns
  where table_schema = 'public' and table_name = 'products' and column_name = 'image_url'), '';

-- ---------------------------------------------------------------------------
-- Criterion 2 — RLS per ADR-0004 (enabled + policies)
-- ---------------------------------------------------------------------------

insert into _verify (criterion, check_name, ok, detail)
select 2, 'RLS enabled on categories', (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'categories'), '';
insert into _verify (criterion, check_name, ok, detail)
select 2, 'RLS enabled on products', (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'products'), '';
insert into _verify (criterion, check_name, ok, detail)
select 2, 'RLS enabled on customers', (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'customers'), '';
insert into _verify (criterion, check_name, ok, detail)
select 2, 'RLS enabled on orders', (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'orders'), '';
insert into _verify (criterion, check_name, ok, detail)
select 2, 'RLS enabled on order_items', (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'order_items'), '';

insert into _verify (criterion, check_name, ok, detail)
select 2, 'catalog SELECT policy for anon on categories', exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'categories'
    and policyname = 'Catalog categories are publicly readable' and cmd = 'SELECT' and 'anon' = any (roles)), '';
insert into _verify (criterion, check_name, ok, detail)
select 2, 'catalog SELECT policy for anon on products', exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'products'
    and policyname = 'Catalog products are publicly readable' and cmd = 'SELECT' and 'anon' = any (roles)), '';

insert into _verify (criterion, check_name, ok, detail)
select 2, 'guest INSERT policy on customers (anon)', exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'customers'
    and policyname = 'Guests can create customers' and cmd = 'INSERT' and 'anon' = any (roles)), '';
insert into _verify (criterion, check_name, ok, detail)
select 2, 'guest INSERT policy on orders (anon)', exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'orders'
    and policyname = 'Guests can create orders' and cmd = 'INSERT' and 'anon' = any (roles)), '';
insert into _verify (criterion, check_name, ok, detail)
select 2, 'guest INSERT policy on order_items (anon)', exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'order_items'
    and policyname = 'Guests can create order items' and cmd = 'INSERT' and 'anon' = any (roles)), '';

insert into _verify (criterion, check_name, ok, detail)
select 2, 'admin FULL policy on customers (is_admin-gated)', exists (
  select 1 from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'customers'
    and p.policyname = 'Admins can manage customers' and p.cmd = 'ALL'
    and p.qual like '%is_admin%'), '';
insert into _verify (criterion, check_name, ok, detail)
select 2, 'admin FULL policy on orders (is_admin-gated)', exists (
  select 1 from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'orders'
    and p.policyname = 'Admins can manage orders' and p.cmd = 'ALL'
    and p.qual like '%is_admin%'), '';
insert into _verify (criterion, check_name, ok, detail)
select 2, 'admin FULL policy on order_items (is_admin-gated)', exists (
  select 1 from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'order_items'
    and p.policyname = 'Admins can manage order items' and p.cmd = 'ALL'
    and p.qual like '%is_admin%'), '';

-- ---------------------------------------------------------------------------
-- Criterion 3 — storage bucket + policies
-- ---------------------------------------------------------------------------

insert into _verify (criterion, check_name, ok, detail)
select 3, 'product-images bucket exists', exists (select 1 from storage.buckets where id = 'product-images'), '';
insert into _verify (criterion, check_name, ok, detail)
select 3, 'product-images bucket is public', (select "public" from storage.buckets where id = 'product-images'), '';
insert into _verify (criterion, check_name, ok, detail)
select 3, 'file_size_limit = 5 MB', (select file_size_limit from storage.buckets where id = 'product-images') = 5242880, '';
insert into _verify (criterion, check_name, ok, detail)
select 3, 'allowed_mime_types = jpeg/png/webp', (select allowed_mime_types from storage.buckets where id = 'product-images') = array['image/jpeg', 'image/png', 'image/webp']::text[], '';

insert into _verify (criterion, check_name, ok, detail)
select 3, 'public read policy on product-images', exists (
  select 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'Product images are publicly readable' and cmd = 'SELECT' and 'anon' = any (roles)), '';
insert into _verify (criterion, check_name, ok, detail)
select 3, 'admin-write policies on product-images (insert/update/delete)', (
  select count(*) from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname in ('Admins can upload product images', 'Admins can update product images', 'Admins can delete product images')
) = 3, '';

-- ---------------------------------------------------------------------------
-- Criterion 4 — seed catalog
-- ---------------------------------------------------------------------------

insert into _verify (criterion, check_name, ok, detail)
select 4, 'seed has 4 categories', (select count(*) from public.categories) = 4,
  'found ' || (select count(*)::text from public.categories);
insert into _verify (criterion, check_name, ok, detail)
select 4, 'seed has 11 products', (select count(*) from public.products) = 11,
  'found ' || (select count(*)::text from public.products);
insert into _verify (criterion, check_name, ok, detail)
select 4, 'includes an out-of-stock product (stock 0, active)', exists (
  select 1 from public.products where status = 'active' and stock_quantity = 0), '';
insert into _verify (criterion, check_name, ok, detail)
select 4, 'includes an inactive product', exists (
  select 1 from public.products where status = 'inactive'), '';

-- ---------------------------------------------------------------------------
-- Behavioural RLS checks (NOTICE lines) — the real proof
--
-- NOTE: this script must NOT contain BEGIN/COMMIT/ROLLBACK. The Supabase SQL
-- editor runs the whole script as one implicit transaction, so any ROLLBACK
-- here would undo the `_verify` temp table created above and the final report
-- would fail with `relation "_verify" does not exist`. Role switches are done
-- at session level (SET ROLE / RESET ROLE), which is safe inside a
-- transaction. The anon INSERT test rolls back its own row via a PL/pgSQL
-- exception (an internal savepoint) — no outer ROLLBACK needed.
-- ---------------------------------------------------------------------------

set role anon;
set request.jwt.claims = '{"role":"anon","app_metadata":{}}';

do $$
begin
  perform (select count(*) from public.categories);
  raise notice 'PASS: anon can SELECT categories';
exception when insufficient_privilege then
  raise notice 'FAIL: anon cannot SELECT categories';
end $$;

do $$
begin
  perform (select count(*) from public.products);
  raise notice 'PASS: anon can SELECT products';
exception when insufficient_privilege then
  raise notice 'FAIL: anon cannot SELECT products';
end $$;

do $$
begin
  perform (select count(*) from public.orders);
  raise notice 'FAIL: anon CAN read orders (RLS hole!)';
exception when insufficient_privilege then
  raise notice 'PASS: anon SELECT on orders is denied (RLS)';
end $$;

do $$
begin
  insert into public.customers (full_name, email, contact_number)
  values ('Verify Temp', 'verify-' || gen_random_uuid() || '@example.com', '000');
  raise exception using errcode = 'P0001', message = 'ROLLED_BACK_OK';
exception
  when insufficient_privilege then
    raise notice 'FAIL: anon INSERT into customers denied (guest checkout broken)';
  when others then
    if sqlerrm = 'ROLLED_BACK_OK' then
      raise notice 'PASS: anon can INSERT into customers (row rolled back)';
    else
      raise notice 'FAIL: anon INSERT customers threw: %', sqlerrm;
    end if;
end $$;

reset request.jwt.claims;
reset role;

-- Admin simulation: an authenticated user whose JWT carries the admin claim
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","email":"admin@example.com","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  perform (select count(*) from public.orders);
  raise notice 'PASS: admin (role claim) can read orders';
exception when insufficient_privilege then
  raise notice 'FAIL: admin cannot read orders';
end $$;

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------

select criterion as "Criterion", check_name as "Check",
       case when ok then 'PASS' else 'FAIL' end as "Result", detail as "Detail"
from _verify
order by criterion, check_name;

select count(*) filter (where ok) as "Passed",
       count(*) filter (where not ok) as "Failed"
from _verify;

drop table _verify;
