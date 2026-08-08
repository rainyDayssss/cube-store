# 09 — Admin products

**What to build:** Product management: full CRUD with search and Category filter, a mandatory image upload directly to Storage (client-side type/size validation with preview, re-validated server-side), and an active/inactive status toggle. Availability remains derived from `stock_quantity` — status never stores it.

**Blocked by:** 08

**Status:** resolved

- [x] Products can be created, edited, and deleted; creating/editing requires a valid image upload (jpg/png/webp ≤ 5MB)
- [x] Upload shows a preview; server re-validates the file; images serve from the public bucket
- [x] Toggling active/inactive changes storefront visibility; out-of-stock is still derived from stock
- [x] Category dropdown lists live Categories; deleting a Product leaves no orphaned references

**Interpretation (recorded):** "creating/editing requires a valid image upload" — the image is **mandatory on create** and **optional on edit** (an existing image is kept unless a new file is chosen). Re-uploading on every edit would be hostile UX.

**Review round applied:** preview blob URLs are revoked (no leaks); debounced search drops stale responses and skips the redundant mount fetch; blank price/stock fields are rejected server-side (Number("") → 0 was silently accepted).

**Known acceptable trade-off:** if an image upload succeeds but the product insert then fails, the storage object is orphaned (fine at this scale).

**Live check:** `/admin/products` compiles; the gate redirects unauthenticated visitors to login (307). Upload + CRUD need the signed-in Admin to verify end-to-end.

**User-confirmed:** product CRUD and image upload (create with image, edit, toggle, delete) all work as Admin in the browser; created products appear on the storefront.
