# 07 — Admin shell, auth gating & KPIs

**What to build:** The Admin area: a layout with a persistent sidebar on desktop and collapsible navigation on smaller screens, server-side protection so only Admins can enter (everyone else is redirected away), and a dashboard overview with six KPI cards: total Products, total Orders, pending Orders, completed Orders, total Customers, and total sales. Sales and customer totals exclude cancelled Orders (a cancelled Order is undone — ADR-0002).

**Blocked by:** 01

**Status:** resolved

- [x] Every admin route checks the `role: admin` claim server-side; non-Admins are redirected, Admins see the dashboard
- [x] Six KPI cards render live aggregates and are correct with empty data
- [x] Sidebar navigation covers the admin sections; collapsible on tablet, persistent on desktop
- [x] Total sales excludes cancelled Orders

**Decision (asked the user):** "customer totals exclude cancelled Orders" in the description read as ambiguous — resolved to **count all customers** (guests persist by email even after a cancellation; matches the acceptance criteria literally).

**Review round applied:** count queries use `head: true` (no row bodies downloaded); sales sum guards against `NaN`.

**Live-verified:** `/admin` redirects unauthenticated visitors to `/auth/login` (307) — server-side gate confirmed. Dashboard aggregates are covered by the mock-based tests; the signed-in dashboard itself needs an Admin session to view.

**User-confirmed:** live KPI cards render for the signed-in Admin (11 products, orders + sales from the test orders, etc.).

## Comments

- The scaffold (`app/admin/`, `components/admin/`) already ships the gated layout, the responsive sidebar shell, and placeholder KPI cards. The remaining work here is wiring the six cards to live aggregates from the database (through the store service seam).
- The split into a separate admin project (ADR-0005) was reversed — the admin lives in this repo as the `/admin` route group (ADR-0006).
