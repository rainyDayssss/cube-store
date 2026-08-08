/**
 * Deployment-mode routing (ADR-0007): one repo, two deployments.
 *
 * The same codebase deploys as two disjoint surfaces, switched by the
 * `NEXT_PUBLIC_APP_MODE` environment variable. This pure function is the
 * single testing seam for that behaviour:
 *
 * - `"storefront"` — serve the public pages only: `/admin` and `/auth/*` are
 *   blocked (404) as if they don't exist.
 * - `"admin"` — serve only `/admin` and `/auth/*`; everything else (including
 *   the host root `/`) is blocked.
 * - Any other value (or unset) — nothing is blocked; today's single-deployment
 *   behaviour is preserved.
 *
 * Matching is a plain `startsWith` on the prefix (like the pre-existing proxy
 * redirect logic), so lookalike paths such as `/administrator` are treated as
 * admin paths. No such routes exist today; the tests pin this behaviour.
 *
 * It stays free of I/O and Next.js imports so the proxy can call it and the
 * tests can call it directly.
 */

export type AppMode = "storefront" | "admin";

export type RouteVerdict = "allow" | "block";

function isAdminOrAuth(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/auth");
}

export function routeMode(
  pathname: string,
  appMode: string | undefined,
): RouteVerdict {
  if (appMode === "storefront") {
    return isAdminOrAuth(pathname) ? "block" : "allow";
  }
  if (appMode === "admin") {
    return isAdminOrAuth(pathname) ? "allow" : "block";
  }
  return "allow";
}
