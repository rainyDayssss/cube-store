-- ============================================================================
-- Cube Store — admin read model verification (migration 20260808000002)
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor AFTER applying
-- 20260808000002_admin_read_model.sql. It mechanically checks the
-- order_summaries / order_details / customer_summaries views and the
-- get_admin_kpis RPC:
--   - structural: objects exist, security_invoker set, grants correct
--   - behavioral: joins and aggregates correct against scratch data
--     (inserted inside a transaction and rolled back, so nothing persists)
--   - roles: anon denied, admin (role claim) allowed — as NOTICE lines
-- Expected result: every row PASS, behavioural notices read PASS.
-- ============================================================================

create temp table if not exists _verify_rm (
  criterion  int,
  check_name text,
  ok         boolean,
  detail     text
);

-- ---------------------------------------------------------------------------
-- Criterion 1 — objects exist, are security_invoker, and are admin-gated
-- ---------------------------------------------------------------------------

insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'view order_summaries exists', exists (
  select 1 from information_schema.views
  where table_schema = 'public' and table_name = 'order_summaries'), '';
insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'view order_details exists', exists (
  select 1 from information_schema.views
  where table_schema = 'public' and table_name = 'order_details'), '';
insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'view customer_summaries exists', exists (
  select 1 from information_schema.views
  where table_schema = 'public' and table_name = 'customer_summaries'), '';

insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'order_summaries is security_invoker', (
  select reloptions from pg_class
  where relname = 'order_summaries' and relnamespace = 'public'::regnamespace
) @> array['security_invoker=true'], '';
insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'order_details is security_invoker', (
  select reloptions from pg_class
  where relname = 'order_details' and relnamespace = 'public'::regnamespace
) @> array['security_invoker=true'], '';
insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'customer_summaries is security_invoker', (
  select reloptions from pg_class
  where relname = 'customer_summaries' and relnamespace = 'public'::regnamespace
) @> array['security_invoker=true'], '';

insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'function get_admin_kpis exists', exists (
  select 1 from pg_proc
  where proname = 'get_admin_kpis' and pronamespace = 'public'::regnamespace), '';

-- Grants: anon has no SELECT on the views, authenticated does.
insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'anon has NO SELECT on the read-model views',
  not has_table_privilege('anon', 'public.order_summaries', 'SELECT')
  and not has_table_privilege('anon', 'public.order_details', 'SELECT')
  and not has_table_privilege('anon', 'public.customer_summaries', 'SELECT'), '';
insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'authenticated HAS SELECT on the read-model views',
  has_table_privilege('authenticated', 'public.order_summaries', 'SELECT')
  and has_table_privilege('authenticated', 'public.order_details', 'SELECT')
  and has_table_privilege('authenticated', 'public.customer_summaries', 'SELECT'), '';

insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'anon has NO EXECUTE on get_admin_kpis',
  not has_function_privilege('anon', 'public.get_admin_kpis()', 'EXECUTE'), '';
insert into _verify_rm (criterion, check_name, ok, detail)
select 1, 'authenticated HAS EXECUTE on get_admin_kpis',
  has_function_privilege('authenticated', 'public.get_admin_kpis()', 'EXECUTE'), '';

-- ---------------------------------------------------------------------------
-- Criterion 2 — behavioral checks against scratch data (rolled back)
-- ---------------------------------------------------------------------------

begin;

-- Scratch customer with one pending order (2 units) and one cancelled order.
-- on conflict guards make the script safe to re-run even if a previous run
-- failed before the rollback.
insert into public.customers (id, full_name, email, contact_number)
values ('00000000-0000-0000-0000-0000000000a1', 'Verify Ada', 'verify.ada@example.com', '+63 900 000 0001')
on conflict (email) do nothing;

insert into public.orders (id, order_number, customer_id, delivery_address, payment_method, status, total_amount)
values
  ('00000000-0000-0000-0000-0000000000b1', 'ORD-20991231-9001', '00000000-0000-0000-0000-0000000000a1', 'Verify St 1', 'cod', 'pending', 25.50),
  ('00000000-0000-0000-0000-0000000000b2', 'ORD-20991231-9002', '00000000-0000-0000-0000-0000000000a1', 'Verify St 2', 'ewallet', 'cancelled', 999.00)
on conflict (order_number) do nothing;

insert into public.order_items (id, order_id, product_id, quantity, unit_price)
select '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', id, 2, 10.00
from public.products
limit 1
on conflict (id) do nothing;

insert into _verify_rm (criterion, check_name, ok, detail)
select 2, 'order_summaries joins customer name/email and sums item quantities',
  (select customer_name = 'Verify Ada' and customer_email = 'verify.ada@example.com' and items_count = 2
   from public.order_summaries where order_number = 'ORD-20991231-9001'), '';

insert into _verify_rm (criterion, check_name, ok, detail)
select 2, 'order_details returns items as jsonb with product names and snapshots',
  (select items is not null
     and jsonb_array_length(items) = 1
     and items -> 0 ->> 'product_name' is not null
     and items -> 0 ->> 'quantity' = '2'
     and items -> 0 ->> 'unit_price' = '10.00'
   from public.order_details where order_number = 'ORD-20991231-9001'), '';

insert into _verify_rm (criterion, check_name, ok, detail)
select 2, 'customer_summaries excludes cancelled from count and total',
  (select order_count = 1 and total_spent = 25.50
   from public.customer_summaries where email = 'verify.ada@example.com'), '';

-- KPI RPC with an admin claim: total_orders includes the scratch orders,
-- total_sales includes 25.50 but stays below the cancelled 999 — proving the
-- exclusion regardless of any other orders already in the database.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated","app_metadata":{"role":"admin"}}';

insert into _verify_rm (criterion, check_name, ok, detail)
select 2, 'get_admin_kpis answers ok for an admin claim',
  (select (public.get_admin_kpis() ->> 'ok')::boolean), '';

insert into _verify_rm (criterion, check_name, ok, detail)
select 2, 'get_admin_kpis counts the scratch orders',
  (select (public.get_admin_kpis() #>> '{kpis,total_orders}')::int >= 2), '';

insert into _verify_rm (criterion, check_name, ok, detail)
select 2, 'get_admin_kpis excludes cancelled from total_sales',
  (select (public.get_admin_kpis() #>> '{kpis,total_sales}')::numeric >= 25.50
      and (public.get_admin_kpis() #>> '{kpis,total_sales}')::numeric < 999), '';

rollback;

-- ---------------------------------------------------------------------------
-- Role behaviour (NOTICE lines, mirroring verify-ticket-01.sql)
-- ---------------------------------------------------------------------------

-- Anon: the views are invisible (no grant) — even before RLS applies.
set role anon;
set request.jwt.claims = '{"role":"anon","app_metadata":{}}';

do $$
begin
  perform (select count(*) from public.order_summaries);
  raise notice 'FAIL: anon can SELECT order_summaries (should be denied)';
exception when insufficient_privilege then
  raise notice 'PASS: anon cannot SELECT order_summaries';
end $$;

do $$
begin
  perform (select count(*) from public.customer_summaries);
  raise notice 'FAIL: anon can SELECT customer_summaries (should be denied)';
exception when insufficient_privilege then
  raise notice 'PASS: anon cannot SELECT customer_summaries';
end $$;

do $$
begin
  perform public.get_admin_kpis();
  raise notice 'FAIL: anon can call get_admin_kpis (should be denied)';
exception when insufficient_privilege then
  raise notice 'PASS: anon cannot call get_admin_kpis';
end $$;

reset request.jwt.claims;
reset role;

-- Admin: the role claim opens the read model (and RLS lets it see rows).
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","email":"admin@example.com","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
begin
  perform (select count(*) from public.order_summaries);
  raise notice 'PASS: admin (role claim) can SELECT order_summaries';
exception when insufficient_privilege then
  raise notice 'FAIL: admin cannot SELECT order_summaries';
end $$;

do $$
begin
  perform (select count(*) from public.customer_summaries);
  raise notice 'PASS: admin (role claim) can SELECT customer_summaries';
exception when insufficient_privilege then
  raise notice 'FAIL: admin cannot SELECT customer_summaries';
end $$;

do $$
begin
  perform public.get_admin_kpis();
  raise notice 'PASS: admin (role claim) can call get_admin_kpis';
exception when insufficient_privilege then
  raise notice 'FAIL: admin cannot call get_admin_kpis';
end $$;

reset request.jwt.claims;
reset role;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------

select criterion as "Criterion", check_name as "Check",
       case when ok then 'PASS' else 'FAIL' end as "Result", detail as "Detail"
from _verify_rm
order by criterion, check_name;

select count(*) filter (where ok) as "Passed",
       count(*) filter (where not ok) as "Failed"
from _verify_rm;
