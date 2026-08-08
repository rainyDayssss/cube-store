# Product images: server-side compression and storage cleanup

Product images are re-encoded server-side with `sharp` — to WebP, longest edge ≤ 1600px, quality 80, auto-oriented — before upload, so the free-tier Storage bucket only ever holds small objects regardless of what an Admin uploads (a 5 MB JPEG typically lands at ~150–400 KB). Every `products.image_url` points at a WebP object in the public `product-images` bucket owned by exactly one Product; when a Product is deleted or its image replaced on edit, the previous Storage object is removed **best-effort after the database write succeeds**, and only for URLs whose path actually lives in the `product-images` bucket — seeded `picsum.photos` image URLs are external and never touched. A Product must always have an image: the column is `NOT NULL` and `updateProduct` rejects a blank `image_url` with a friendly message.

Status: accepted

## Considered options

- **Client-side (browser) compression** — rejected: quality control is weaker, EXIF handling is manual, and the upload already flows through a Server Action where server-side validation must happen regardless; server-side `sharp` (already shipped by Next.js for `next/image`) is one tested seam.
- **Compress only, no resize / keep original format** — rejected: WebP at q80 with a 1600px cap yields ~90% size reduction with no visible loss at storefront sizes (seed images are 800px); the bucket's MIME whitelist already includes `image/webp`, so no migration is needed.
- **Strict cleanup (fail the action if a Storage removal fails)** — rejected: a leaked object costs a few KB of free-tier space, while a product delete/update blocked by a Storage outage is a real failure. DB-first ordering guarantees a Product never points at an image that doesn't exist (mirroring the upload-before-insert rule for creation).

## Consequences

- Admin-uploaded products always end in `.webp`; seed URLs are unchanged.
- A failed create removes the freshly uploaded object best-effort, so an upload never orphans either.
- The blank-image invariant is enforced in code, not just by the schema.
- Storage removals are best-effort: transient Storage errors leave orphaned objects rather than failing the Admin's action.
- Image logic lives in `features/admin/lib/products/images.ts` (server-only — it imports `sharp`, so it is never bundled into a client component; `products.ts` stays client-safe).
