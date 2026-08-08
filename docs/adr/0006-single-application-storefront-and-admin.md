# Single application: storefront and admin in one repo

Status: superseded in part by ADR-0007 — the single-repo decision stands; the "deploy as one unit" consequence is revised to two deployments switched by `NEXT_PUBLIC_APP_MODE`.

The two-application split (ADR-0005) was reversed before either app shipped real features: the admin dashboard, briefly scaffolded as a separate repo (`cube-store-admin`), was merged back into this single Next.js app as the `/admin` route group. Chosen because the two halves share one database and nearly all supporting code — Supabase clients, the store service layer (checkout and order lifecycle are two halves of the same seam), schema migrations, shadcn components, glossary, and docs — so separate repos imposed a duplication and sync tax with no team-scale isolation benefit for a solo/duo project. The storefront and admin now deploy as one unit, and the security posture is unchanged: the storefront is guest-only, auth gates only `/admin` via the `role: admin` claim (ADR-0001), and RLS is unchanged (ADR-0004). Reversing later to separate apps remains possible; the cost is re-extracting `app/admin`, the auth plumbing, and the shared service layer.

Supersedes ADR-0005.
