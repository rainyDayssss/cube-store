-- Cube Store — repair seeded admin auth rows
--
-- Background: the original seed (20260807000001_seed_admin.sql) inserted the
-- admin straight into `auth.users` with only a handful of columns. That causes
-- two failures on password sign-in at /auth/v1/token?grant_type=password:
--
--   1. NULL token columns. GoTrue scans `auth.users` into Go structs whose
--      fields are plain strings. Any unset (NULL) text column — e.g.
--      `confirmation_token` — makes the scan fail with
--      "sql: Scan error ... converting NULL to string is unsupported", which
--      GoTrue wraps and returns as HTTP 500 "Database error querying schema"
--      (supabase/auth#1940). The fix is to store '' instead of NULL.
--
--   2. Missing `auth.identities` row. Modern GoTrue also expects a matching
--      'email' identity row for the user (used for sessions and JWT claims).
--
-- This migration repairs both for the seeded admin. It is idempotent and safe
-- to re-run: the UPDATE only touches NULL token columns, and the identity
-- INSERT is guarded by a not-exists check. It no-ops entirely if the seed was
-- never applied.
--
-- Email:    admin@example.com
-- Password: admin123 (unchanged)

-- 1) Replace NULLs in the text/token columns GoTrue scans as strings.
--    (All of these are plain-string fields in GoTrue's User model; any NULL
--    fails the row scan, so the whole set is repaired in one pass.)
update auth.users
set confirmation_token       = coalesce(confirmation_token, ''),
    recovery_token           = coalesce(recovery_token, ''),
    email_change             = coalesce(email_change, ''),
    email_change_token_new   = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone                    = coalesce(phone, ''),
    phone_change             = coalesce(phone_change, ''),
    phone_change_token       = coalesce(phone_change_token, ''),
    reauthentication_token   = coalesce(reauthentication_token, ''),
    updated_at               = now()
where email = 'admin@example.com'
  and (
    confirmation_token is null
    or recovery_token is null
    or email_change is null
    or email_change_token_new is null
    or email_change_token_current is null
    or phone is null
    or phone_change is null
    or phone_change_token is null
    or reauthentication_token is null
  );

-- 2) Create the email identity GoTrue needs. Looked up by email so it stays
--    aligned with the user row; skipped when already present.
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
    select 1
    from auth.identities i
    where i.user_id = u.id
      and i.provider = 'email'
  );
