# 04 — Product details

**What to build:** The product detail page: a high-res image, a derived stock-availability badge, description, price, an interactive quantity selector capped at available stock, and a Related Products section (same Category). The page also exposes an Add to Cart control for the cart ticket to wire up.

**Blocked by:** 01

**Status:** resolved

- [x] Detail page shows image, price, description; availability badge derives from `stock_quantity` (out-of-stock when 0)
- [x] Quantity selector caps at available stock and is disabled when out of stock
- [x] Related Products (same Category) load and link correctly
- [x] Unknown Product id renders a friendly not-found state
- [x] Add to Cart control is present and ready to dispatch to the cart store (wired in ticket 05)

## Comments

Implemented locally (Aug 6): `app/products/[id]/` — `page.tsx` (generateMetadata, params promise passed unresolved into Suspense so the shell streams), `not-found.tsx` (friendly boundary inside the storefront shell), plus `components/product/product-detail.tsx` (server: image, price, derived availability badge with low-stock tier, description, category chip linking to the filtered catalog, related products grid, `notFound()` for unknown/inactive ids) and `components/product/add-to-cart.tsx` (client: quantity stepper capped at stock, disabled when out of stock, Add to Cart button with a local seam ready for the ticket 05 store dispatch). Store seam: `getProductById` (active-only) and `getRelatedProducts` (same category, excludes self, newest first, capped) with 7 new tests — 31/31 green, tsc ✓, lint ✓.

Live verification against the real Supabase project: 3x3 Speed Cube page renders with badge + Add to cart + Related products (4x4 etc.); out-of-stock 2x2 shows Out of stock; unknown and inactive ids render the not-found state. Note: the not-found boundary streams with HTTP 200 in dev (headers are sent before the boundary resolves) — the friendly page itself renders correctly. Remaining for manual pass: a browser click-through of the quantity stepper and Add to Cart button.

Resolved Aug 6: browser click-through confirmed — detail page renders image/price/badge/description, the quantity stepper caps at stock, the out-of-stock product shows the disabled state, Related Products link correctly, and unknown ids show the friendly not-found page. Ticket fully closed.
