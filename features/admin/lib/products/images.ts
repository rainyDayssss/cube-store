import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createProduct,
  deleteProduct,
  updateProduct,
  validateImageFile,
  type ProductInput,
  type ProductMutationResult,
} from "./products";

/**
 * Product image lifecycle (ADR-0008). This module is the only place that
 * touches Supabase Storage — it is server-only (it imports `sharp`), so it is
 * never bundled into a client component. The DB seam (`products.ts`) stays
 * client-safe.
 *
 * Every upload is re-encoded server-side to WebP (longest edge ≤ 1600px,
 * quality 80, auto-oriented) before it reaches the bucket, so the free-tier
 * bucket only ever holds small objects regardless of what admins upload.
 * Storage objects are removed best-effort *after* the database write
 * succeeds, and only for URLs that actually point into the `product-images`
 * bucket — seeded `picsum.photos` URLs are external and never touched.
 */

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const IMAGE_MAX_DIMENSION = 1600;
export const IMAGE_WEBP_QUALITY = 80;
export const IMAGE_OUTPUT_TYPE = "image/webp";

/** Public-URL path prefix for objects inside our bucket. */
const PUBLIC_PREFIX = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;

/**
 * Re-encodes a picked image to WebP, capped at `IMAGE_MAX_DIMENSION` on the
 * longest edge (never upscales), with EXIF orientation applied. Pure pipeline
 * — returns the processed bytes, no I/O beyond `sharp`.
 */
export async function compressImage(file: File): Promise<Buffer> {
  const input = Buffer.from(await file.arrayBuffer());
  return sharp(input)
    .rotate()
    .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: IMAGE_WEBP_QUALITY })
    .toBuffer();
}

/**
 * Extracts the Storage object path from a public URL, or `null` when the URL
 * does not point into our bucket (seed images, foreign buckets, malformed
 * URLs). Callers use this to decide whether a removal is safe.
 */
export function imagePathFromUrl(
  imageUrl: string | null | undefined,
): string | null {
  if (!imageUrl) return null;
  try {
    const { pathname } = new URL(imageUrl);
    if (!pathname.startsWith(PUBLIC_PREFIX)) return null;
    const path = pathname.slice(PUBLIC_PREFIX.length);
    return path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

/**
 * Validates, compresses, and uploads an image to the `product-images` bucket,
 * returning its public URL. The file is re-validated here (client-side checks
 * are a UX convenience only) and the bucket's admin-write RLS policy is the
 * security boundary.
 */
export async function uploadProductImage(
  client: SupabaseClient,
  file: File,
): Promise<{ url: string } | { error: string }> {
  const invalid = validateImageFile(file);
  if (invalid) return { error: invalid };

  let processed: Buffer;
  try {
    processed = await compressImage(file);
  } catch {
    return { error: "The image could not be processed." };
  }

  const path = `products/${crypto.randomUUID()}.webp`;
  const { error } = await client.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, processed, { contentType: IMAGE_OUTPUT_TYPE, upsert: false });
  if (error) {
    return { error: `Upload failed: ${error.message}` };
  }

  const { data } = client.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/**
 * Best-effort removal of a product's Storage object. Never throws and never
 * touches URLs outside our bucket — a failed removal must not block the
 * admin's action (ADR-0008).
 */
export async function removeProductImage(
  client: SupabaseClient,
  imageUrl: string | null | undefined,
): Promise<void> {
  const path = imagePathFromUrl(imageUrl);
  if (!path) return;
  try {
    await client.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  } catch {
    // Best-effort by contract: swallow storage outages.
  }
}

/**
 * Uploads the image first, then creates the Product — it never points at a
 * missing image. If the insert fails, the freshly uploaded object is removed
 * best-effort so a failed create leaves no orphan (ADR-0008).
 */
export async function createProductWithImage(
  client: SupabaseClient,
  input: ProductInput,
  file: File,
): Promise<ProductMutationResult> {
  const upload = await uploadProductImage(client, file);
  if ("error" in upload) {
    return { ok: false, message: upload.error };
  }

  const result = await createProduct(client, { ...input, image_url: upload.url });
  if (!result.ok) {
    await removeProductImage(client, upload.url);
  }
  return result;
}

/**
 * Updates a Product, replacing its image when a new file is provided (keeps
 * the current one otherwise) and then best-effort removing the old Storage
 * object so replacements never orphan images (ADR-0008). The previous image
 * URL is read from the database — never trusted from the form — so cleanup
 * always targets the object this row actually referenced.
 */
export async function updateProductWithImage(
  client: SupabaseClient,
  id: string,
  input: ProductInput,
  file: File | null,
): Promise<ProductMutationResult> {
  const { data: current } = await client
    .from("products")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();
  const previousImageUrl = (current as { image_url?: string } | null)?.image_url ?? "";

  let imageUrl = previousImageUrl;
  if (file && file.size > 0) {
    const upload = await uploadProductImage(client, file);
    if ("error" in upload) {
      return { ok: false, message: upload.error };
    }
    imageUrl = upload.url;
  }

  const result = await updateProduct(client, id, { ...input, image_url: imageUrl });
  if (result.ok && previousImageUrl && previousImageUrl !== imageUrl) {
    await removeProductImage(client, previousImageUrl);
  }
  return result;
}

/** Deletes the Product, then best-effort removes its Storage object (ADR-0008). */
export async function deleteProductWithImage(
  client: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await deleteProduct(client, id);
  if (result.ok && result.image_url) {
    await removeProductImage(client, result.image_url);
  }
  return result.ok ? { ok: true } : result;
}
