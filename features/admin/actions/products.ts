"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createProductWithImage,
  deleteProductWithImage,
  updateProductWithImage,
} from "@/features/admin/lib/products/images";
import {
  updateProductStatus,
  type ProductInput,
  type ProductMutationResult,
} from "@/features/admin/lib/products/products";
import type { ProductStatus } from "@/features/catalog/lib/catalog";

/**
 * Product write actions (ticket 09). The RLS admin policies on `products`
 * and the storage admin-write policy are the security boundary. Image
 * handling (validation, server-side compression to WebP, upload, and
 * best-effort cleanup of replaced/deleted images — ADR-0008) lives in
 * `features/admin/lib/products/images.ts`; these actions are thin glue.
 */

/**
 * Parses and validates the product form's text fields into a ProductInput.
 * Image rules live separately (`validateImageFile` / the create action's
 * presence check). Rules: name required; price a finite number >= 0; stock an
 * integer >= 0; status `active` or `inactive` (default `active`).
 */
function parseProductForm(
  formData: FormData,
): { input?: ProductInput; error?: string } {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const stockRaw = String(formData.get("stock_quantity") ?? "").trim();
  const price = Number(priceRaw);
  const stock_quantity = Number(stockRaw);
  const status = String(formData.get("status") ?? "active");
  const categoryRaw = String(formData.get("category_id") ?? "");
  const category_id = categoryRaw ? categoryRaw : null;

  if (!name) return { error: "Product name is required." };
  // Reject blank fields explicitly — Number("") is 0, which would silently
  // create a $0 / zero-stock product if we only checked the parsed value.
  if (priceRaw === "" || !Number.isFinite(price) || price < 0) {
    return { error: "Enter a valid price." };
  }
  if (
    stockRaw === "" ||
    !Number.isInteger(stock_quantity) ||
    stock_quantity < 0
  ) {
    return { error: "Enter a valid stock quantity." };
  }
  if (status !== "active" && status !== "inactive") {
    return { error: "Invalid status." };
  }

  return {
    input: {
      name,
      description,
      price,
      stock_quantity,
      status,
      category_id,
      image_url: "",
    },
  };
}

export async function createProductAction(
  formData: FormData,
): Promise<ProductMutationResult> {
  const supabase = await createClient();
  const { input, error } = parseProductForm(formData);
  if (error || !input) {
    return { ok: false, message: error ?? "Invalid form data." };
  }

  // The image is mandatory on create.
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, message: "An image is required." };
  }

  return createProductWithImage(supabase, input, file);
}

export async function updateProductAction(
  formData: FormData,
): Promise<ProductMutationResult> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { input, error } = parseProductForm(formData);
  if (error || !input || !id) {
    return { ok: false, message: error ?? "Invalid form data." };
  }

  // The image is optional on edit: keep the current URL unless a new file is
  // provided (the current URL is read from the database by the seam).
  const file = formData.get("image") as File | null;

  return updateProductWithImage(supabase, id, input, file);
}

export async function deleteProductAction(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  return deleteProductWithImage(supabase, id);
}

export async function toggleProductStatusAction(
  id: string,
  status: ProductStatus,
): Promise<ProductMutationResult> {
  const supabase = await createClient();
  return updateProductStatus(supabase, id, status);
}
