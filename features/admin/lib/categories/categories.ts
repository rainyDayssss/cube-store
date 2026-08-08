import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin category management (ticket 08). All writes run with the signed-in
 * Admin's session — the RLS admin policies on `categories` permit them, and
 * the unique constraints on name/slug plus `ON DELETE RESTRICT` on products
 * are the authoritative database guards. This module adds deterministic
 * pre-checks so the UI can explain failures, then maps any DB error it still
 * hits into a friendly message.
 */

export type Category = { id: string; name: string; slug: string };

export type CategoryWithCount = Category & { productCount: number };

export type CategoryMutationResult =
  | { ok: true; category: Category }
  | { ok: false; message: string };

export type DeleteCategoryResult = { ok: true } | { ok: false; message: string };

/**
 * Turns a display name into a URL slug: lowercase, non-alphanumerics become
 * hyphens, leading/trailing hyphens trimmed. Falls back to "category" for an
 * empty input so callers can always rely on a non-empty slug.
 */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "category"
  );
}

/** Picks a slug that is not already taken, appending -2, -3, ... as needed. */
function uniqueSlug(base: string, taken: string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function friendlyError(
  error: { code?: string; message?: string } | null,
  fallback: string,
): string {
  if (error?.code === "23505") {
    // Raised by both the name and the slug unique constraints.
    return "A category with that name already exists.";
  }
  if (error?.code === "PGRST116") {
    return "That category no longer exists. Refresh the list and try again.";
  }
  return error?.message ?? fallback;
}

/** Categories with live product counts, ordered by name. */
export async function listCategoriesWithCounts(
  client: SupabaseClient,
): Promise<CategoryWithCount[]> {
  const [categories, products] = await Promise.all([
    client.from("categories").select("id, name, slug").order("name"),
    client.from("products").select("id, category_id"),
  ]);

  if (categories.error || products.error) return [];

  const counts = new Map<string, number>();
  for (const product of (products.data ?? []) as { category_id: string | null }[]) {
    if (product.category_id) {
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }
  }

  return ((categories.data ?? []) as Category[]).map((category) => ({
    ...category,
    productCount: counts.get(category.id) ?? 0,
  }));
}

/** Creates a Category; the slug is derived from the name and kept unique. */
export async function createCategory(
  client: SupabaseClient,
  name: string,
): Promise<CategoryMutationResult> {
  const clean = name.trim();
  if (!clean) {
    return { ok: false, message: "Category name is required." };
  }

  // Pre-check name and slug against the current rows for a deterministic
  // UX; the unique constraints still enforce this at the database.
  const { data: existing, error } = await client
    .from("categories")
    .select("id, name, slug");
  if (error) {
    return { ok: false, message: "Could not load categories." };
  }
  const rows = (existing ?? []) as Category[];
  if (rows.some((row) => row.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, message: "A category with that name already exists." };
  }
  const slug = uniqueSlug(slugify(clean), rows.map((row) => row.slug));

  const { data, error: insertError } = await client
    .from("categories")
    .insert({ name: clean, slug })
    .select("id, name, slug")
    .single();

  if (insertError || !data) {
    return {
      ok: false,
      message: friendlyError(insertError, "Could not create the category."),
    };
  }
  return { ok: true, category: data as Category };
}

/** Renames a Category; both the name and its derived slug stay unique. */
export async function renameCategory(
  client: SupabaseClient,
  id: string,
  name: string,
): Promise<CategoryMutationResult> {
  const clean = name.trim();
  if (!clean) {
    return { ok: false, message: "Category name is required." };
  }

  const { data: existing, error } = await client
    .from("categories")
    .select("id, name, slug")
    .neq("id", id);
  if (error) {
    return { ok: false, message: "Could not load categories." };
  }
  const rows = (existing ?? []) as Category[];
  if (rows.some((row) => row.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, message: "Another category already has that name." };
  }
  const slug = uniqueSlug(slugify(clean), rows.map((row) => row.slug));

  const { data, error: updateError } = await client
    .from("categories")
    .update({ name: clean, slug })
    .eq("id", id)
    .select("id, name, slug")
    .single();

  if (updateError || !data) {
    return {
      ok: false,
      message: friendlyError(updateError, "Could not rename the category."),
    };
  }
  return { ok: true, category: data as Category };
}

/**
 * Deletes a Category. Categories that still have Products are protected by
 * `ON DELETE RESTRICT` in the schema; this checks first so the guard is a
 * friendly message rather than a raw DB error, and maps the FK violation
 * (23503) the same way if a Product slips in between the check and the
 * delete.
 */
export async function deleteCategory(
  client: SupabaseClient,
  id: string,
): Promise<DeleteCategoryResult> {
  const { count, error: countError } = await client
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (countError) {
    return { ok: false, message: "Could not check the category's products." };
  }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `This category still has ${count} product${count === 1 ? "" : "s"}. Move or remove them first.`,
    };
  }

  const { error } = await client.from("categories").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        message: "This category still has products. Move or remove them first.",
      };
    }
    return { ok: false, message: friendlyError(error, "Could not delete the category.") };
  }
  return { ok: true };
}
