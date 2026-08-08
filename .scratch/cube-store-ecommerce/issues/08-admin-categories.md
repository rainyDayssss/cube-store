08 — Admin categories

**What to build:** Category management: create, rename, and delete Categories from the Admin area, with a deletion guard — deleting a Category that still has Products is blocked and surfaced as a friendly toast, enforced at the database by `ON DELETE RESTRICT`.

**Blocked by:** 07

**Status:** resolved

- [x] Categories can be created and renamed; the slug is derived from the name and unique
- [x] Deleting a referenced Category fails gracefully with a clear toast; deleting an unreferenced one succeeds
- [x] Changes are reflected in the storefront catalog (ticket 02/03) without a redeploy
- [x] Guard behavior is re-verified once Products exist (with ticket 09)

  **Verified without waiting for 09:** Products exist from the seed (11 across 4 categories, since ticket 01). The guard is enforced at the database by `ON DELETE RESTRICT` and covered by unit tests for both paths — the manager's pre-check (friendly "still has N products" failure, no delete attempted) and the FK-race mapping (`23503`). The Admin browser session confirmed delete works, including the guarded path on populated categories. Ticket 09 will still exercise it naturally when Products become editable.

**Review round applied:** `PGRST116` (missing row) mapped to a friendly message; `23505` message covers slug races too; synchronous in-flight ref guard prevents double-submits on rapid Enter.

**Notes:** renaming a Category re-derives its slug, so old `?category=old-slug` storefront bookmarks land on the honest "Category doesn't exist" empty state (expected — slug derives from name). The manager refreshes counts via the browser client, so product counts stay live when ticket 09 adds Products.

**User-confirmed:** create, rename, and guarded delete all work as Admin in the browser.
