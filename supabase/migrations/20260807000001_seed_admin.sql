-- Cube Store — seed admin user (auth bootstrap)
-- Creates the single Admin account for the dashboard, with the `role: admin`
-- claim in app_metadata (ADR-0001; the same claim the README "Promoting an
-- Admin" snippet sets manually). Sign-up is disabled in the app, so this is
-- the way the Admin comes into existence.
--
-- Idempotent: skipped when admin@example.com already exists; safe to re-run.
-- The email is pre-confirmed (email_confirmed_at = now()), so the Admin can
-- sign in immediately at /auth/login.
--
-- Two requirements for a manually-inserted auth.user to be able to sign in:
--   1. The token/text columns must be '' (empty), not NULL — GoTrue scans
--      `auth.users` into Go strings and fails with "Database error querying
--      schema" (sql: converting NULL to string is unsupported, supabase/auth
--      #1940) when they are NULL.
--   2. A matching `auth.identities` row (provider = 'email') must exist.
-- Both are handled below. See 20260808000000_seed_admin_identity_fix.sql for
-- the backfill that repairs projects seeded by the original version of this
-- migration.
--
-- IMPORTANT (dev seed only): change the password after the first login.
--   Email:    admin@example.com
--   Password: admin123

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  phone,
  phone_change,
  phone_change_token,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
where not exists (
  select 1 from auth.users where email = 'admin@example.com'
);

-- The email identity GoTrue needs for password sign-in. Looked up by email so
-- it stays aligned with the insert above; skipped when already present, so the
-- migration stays idempotent across re-runs.
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  u.id,
  u.id,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.email = 'admin@example.com'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );
