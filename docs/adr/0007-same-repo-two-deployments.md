# Same repo, two deployments

The storefront and admin remain one codebase (ADR-0006's *repo* decision stands — the two halves share one Supabase project, one checkout/order lifecycle seam, and one migration set), but they now deploy as two separate surfaces switched by the `NEXT_PUBLIC_APP_MODE` environment variable: the storefront host serves the public pages only (any `/admin` or `/auth/*` request returns 404 as if it doesn't exist), and the admin host serves only `/admin` and `/auth/*` (every other path, including the root, returns 404). Chosen over reviving ADR-0005's two-repo split (separate repos would duplicate the service layer, migrations, shadcn components, and docs for no isolation gain — both halves share the same data and lifecycle) and over keeping the single host (no real separation of the admin surface from the public one). With the variable unset, behavior is unchanged — storefront and admin coexist as before, which is also how development runs.

Status: accepted — supersedes the "deploy as one unit" consequence of ADR-0006

## Considered options

- **Two separate repos (revive ADR-0005)** — rejected: the admin must manage exactly the catalog and orders the storefront sells through the same database and the same store seam (now `features/`, see ADR-0009); a repo split adds a duplication-and-sync tax with no team-scale isolation benefit for a solo/duo project.
- **One deployment, hidden path** — rejected: merely removing the visible link leaves the login surface reachable on the public host, so the separation would be cosmetic rather than real.
- **Redirect blocked paths to the other host** — rejected: the storefront host should have *no* admin surface at all; a redirect keeps the public app auth-aware and hands crawlers an interesting target. A real 404 is the cleaner posture.
- **Same repo, two deployments (chosen)** — one codebase, two builds, each serving a disjoint URL surface, both pointing at the same Supabase project.

## Consequences

- **Routing lives in the proxy.** A pure `routeMode(pathname, appMode)` function sits beside the session proxy and is the single tested seam for the split; the proxy returns a real `404` for blocked requests before any session work runs (`notFound()` is not proxy-safe, and rewrites risk soft 404s).
- **The storefront ships no auth UI.** The public header renders no Sign in button and no signed-in admin chrome; the auth button components were deleted. A signed-in Admin browsing the storefront looks like any other Customer.
- **Auth remains in this repo.** `/auth/*` pages and the admin login flow stay put and keep working on the admin host, unchanged from ADR-0001 and ADR-0004 — RLS and the `role: admin` claim mechanism are untouched.
- **Deployment.** Two builds from the same code (e.g. two Vercel projects) share the `NEXT_PUBLIC_SUPABASE_*` variables; the storefront project sets `NEXT_PUBLIC_APP_MODE="storefront"`, the admin project sets `"admin"`. No migration or schema change is required.
