import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRODUCT_COLUMNS,
  type Product,
  type ProductStatus,
} from "@/features/catalog/lib/catalog";

/**
 * Admin product management (ticket 09). Like the other admin seams, reads and
 * writes run with the signed-in Admin's session — the RLS admin policies on
 * `products` permit them. This module validates the file shape and does the
 * database work; the image lifecycle (compression, upload, Storage cleanup)
 * lives in `./images.ts` (ADR-0008) and this file stays client-safe.
 */

export type ProductInput = {
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  status: ProductStatus;
  category_id: string | null;
  image_url: string;
};

export type ProductMutationResult =
  | { ok: true; product: Product }
  | { ok: false; message: string };

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Client- and server-side guard for the mandatory product image. Returns an
 * error message or null when the file is acceptable.
 */
export function validateImageFile(file: {
  size: number;
  type: string;
}): string | null {
  if (!file) return "An image is required.";
  if (file.size <= 0) return "The image file is empty.";
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Image must be JPG, PNG, or WebP.";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  return null;
}

function friendlyError(
  error: { code?: string; message?: string } | null,
  fallback: string,
): string {
  if (error?.code === "PGRST116") {
    return "That product no longer exists. Refresh the list and try again.";
  }
  return error?.message ?? fallback;
}

/**
 * Every Product (active and inactive) with its Category name, filtered by
 * name search and/or Category, newest first. Used by the admin list.
 */
export async function listAdminProducts(
  client: SupabaseClient,
  params: { q?: string; categoryId?: string } = {},
): Promise<(Product & { category_name: string | null })[]> {
  let query = client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .order("created_at", { ascending: false });
  if (params.q?.trim()) {
    query = query.ilike("name", `%${params.q.trim()}%`);
  }
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }

  const [products, categories] = await Promise.all([
    query,
    client.from("categories").select("id, name"),
  ]);
  if (products.error || categories.error) return [];

  const names = new Map(
    ((categories.data ?? []) as { id: string; name: string }[]).map((c) => [
      c.id,
      c.name,
    ]),
  );
  return ((products.data ?? []) as Product[]).map((product) => ({
    ...product,
    category_name: product.category_id ? (names.get(product.category_id) ?? null) : null,
  }));
}

export async function createProduct(
  client: SupabaseClient,
  input: ProductInput,
): Promise<ProductMutationResult> {
  const { data, error } = await client
    .from("products")
    .insert(input)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, message: friendlyError(error, "Could not create the product.") };
  }
  return { ok: true, product: data as Product };
}

export async function updateProduct(
  client: SupabaseClient,
  id: string,
  input: ProductInput,
): Promise<ProductMutationResult> {
  // A Product must always have an image (ADR-0008) — the column is NOT NULL,
  // but reject with a friendly message before the database does.
  if (!input.image_url.trim()) {
    return {
      ok: false,
      message: "A product must always have an image — keep the existing one or choose a new one.",
    };
  }

  const { data, error } = await client
    .from("products")
    .update(input)
    .eq("id", id)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, message: friendlyError(error, "Could not save the product.") };
  }
  return { ok: true, product: data as Product };
}

/** Quick active/inactive toggle from the list. */
export async function updateProductStatus(
  client: SupabaseClient,
  id: string,
  status: ProductStatus,
): Promise<ProductMutationResult> {
  const { data, error } = await client
    .from("products")
    .update({ status })
    .eq("id", id)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, message: friendlyError(error, "Could not update the product status.") };
  }
  return { ok: true, product: data as Product };
}

/**
 * Deletes a Product. Historical order items reference it via
 * `on delete set null`, so deleting leaves no orphaned rows — order history
 * keeps its price snapshots (ADR-0003). Returns the deleted row's `image_url`
 * so the caller can remove the Storage object (ADR-0008).
 */
export async function deleteProduct(
  client: SupabaseClient,
  id: string,
): Promise<{ ok: true; image_url: string | null } | { ok: false; message: string }> {
  const { data, error } = await client
    .from("products")
    .delete()
    .eq("id", id)
    .select("image_url")
    .single();
  if (error || !data) {
    return { ok: false, message: friendlyError(error, "Could not delete the product.") };
  }
  return { ok: true, image_url: (data as { image_url: string }).image_url ?? null };
}
