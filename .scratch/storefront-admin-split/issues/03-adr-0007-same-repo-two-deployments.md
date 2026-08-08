# 03 — ADR-0007: same repo, two deployments

**What to build:** A decision record (`docs/adr/0007-same-repo-two-deployments.md`) that revises ADR-0006's "deploy as one unit" consequence. It records: the storefront and admin remain one codebase with a unified service layer, but deploy as two separate surfaces switched by `NEXT_PUBLIC_APP_MODE`; the storefront host 404s `/admin` and `/auth/*`, the admin host 404s everything else; and why this beats two repos (ADR-0005 — duplicated service layer, migrations, and docs for no isolation gain) and one host (no real separation of the admin surface). It cross-references ADR-0001 (auth reserved for Admins) and ADR-0004 (RLS unchanged).

**Blocked by:** 01, 02

**Status:** resolved

- [x] ADR-0007 exists at the repo's documented ADR location and follows the established format
- [x] It records the decision made in the grilling session: one repo, two deployments, env-var switch, two-way 404 isolation, and the reasons the considered alternatives were rejected
- [x] It accurately reflects what tickets 01 and 02 actually shipped (written after the code, so not aspirational)
- [x] It states it supersedes ADR-0006's deployment consequence and points to ADR-0001/0004 for the unchanged security posture
- [x] No code changes — documentation only

## Comments

- Spec: `.scratch/storefront-admin-split/spec.md` (Implementation Decisions: Same repo, two deployments (ADR-0007); Further Notes).
- Written last so it documents reality, matching the repo's pattern of superseding ADRs when the design changes (cf. ADR-0005 → 0006).
- Implemented: ADR-0007 written at `docs/adr/0007-same-repo-two-deployments.md` (highest prior number was 0006), recording the same-repo two-deployments decision, the `NEXT_PUBLIC_APP_MODE` switch, the two-way 404 isolation, and the rejected alternatives (two repos, hidden path, cross-host redirect). ADR-0006 gained a "superseded in part by ADR-0007" Status note (repo pattern: ADR-0005 → 0006). All five criteria verified against the actual ADR and shipped code (routeMode seam, proxy 404-before-session-work, auth-free storefront, untouched auth/RLS surface) — docs only, no code changes.
