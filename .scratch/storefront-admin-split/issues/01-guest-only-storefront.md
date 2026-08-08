# 01 — Guest-only storefront: strip auth chrome

**What to build:** The storefront becomes a pure guest surface (matching ADR-0001's intent at the deployment level): every public page renders zero auth UI. The header's desktop auth slot and its mobile-drawer child are removed (brand, navigation, search, and the Cart badge remain), the unused children slot is dropped from the storefront drawer, and the now-dead auth button component together with the already-unimported legacy site header are deleted. A signed-in Admin browsing the storefront sees exactly what a Customer sees.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] No Sign in button, email greeting, Dashboard link, or Logout control appears on any public page (desktop or mobile, drawer included)
- [x] The storefront header still shows brand, Products navigation, search, and the Cart badge; the layout stays balanced with the auth slot gone
- [x] The storefront drawer still opens and navigates; it no longer carries an auth section
- [x] The dead auth button component and the legacy site header are deleted, and nothing imports them; the logout button used by the admin navigation still exists
- [x] `tsc`, lint, and a production build all pass

## Comments

Implemented: the storefront header was rewritten with zero auth UI (brand, Products nav, search, Cart badge remain; the `hasEnvVars` conditional went with the auth slot), the drawer's `children` slot and its bottom section were removed, and `auth-button.tsx` + `site-header.tsx` were deleted (logout button kept for the admin nav). `tsc`, ESLint, 108 tests, and a production build all pass.

## Comments

- Spec: `.scratch/storefront-admin-split/spec.md` (User Stories 1–3, 15; Implementation Decisions: Storefront header, Storefront drawer, Dead code removal).
- Do not touch admin pages, auth pages/forms, RLS, migrations, or the session proxy — those belong to the other tickets or are out of scope.
