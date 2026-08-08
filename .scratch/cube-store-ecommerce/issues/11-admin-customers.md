# 11 — Admin customers

**What to build:** Customer management: a list of Customers with their number of Orders and total purchase amount computed live via relational joins — never stored — so the dashboard reflects real data as Orders are placed and cancelled. Cancelled Orders are excluded from purchase totals.

**Blocked by:** 06, 07

**Status:** resolved

- [x] Customer list renders with live Order count and total purchase per Customer
- [x] Aggregates are computed at query time (no stored counters) and update as Orders change
- [x] Cancelled Orders are excluded from purchase totals; counts reflect the same rule

## Implementation notes

- **Store seam** (`lib/store/admin-customers.ts`): `listCustomers` (customers + orders fetched in parallel, count/sum aggregated in JS at query time — no stored counters), cancelled excluded from BOTH count and total per the ticket (clarifies the ticket 07 ambiguity — counts follow the same exclusion rule). Search by name/email; sorts: name (default, locale-aware), newest, most orders, most spent (with name tiebreaks). `getCustomerDetail` returns the customer + full order history (cancelled included, badge-tagged) with active-only aggregates.
- **UI**: `/admin/customers` — search (name/email/number, whitespace-insensitive for contact), sort select (shared `CUSTOMER_SORTS`/`CUSTOMER_SORT_LABELS` from the seam), table with Orders + Total spent + joined date, links to the detail page; `/admin/customers/[id]` — summary stat cards, contact, and their order history reusing `OrderStatusBadge`, with an explicit note that cancelled orders appear in history but don't count toward totals. Customers enabled in the admin sidebar.
- **Tests**: 8 new tests — aggregates exclude cancelled, updates at query time as orders change (no counters), zeroes for orderless customers, search, sort stability, detail history, fail-soft. → 100/100 green, tsc + lint clean.
- **No DB migration needed** — read-only aggregation.
- **To verify as Admin**: `/admin/customers` shows your real customers (from ticket 06 checkouts) with live counts/spend; cancel an order in `/admin/orders` and the customer's totals drop; open a customer to see their order history.
