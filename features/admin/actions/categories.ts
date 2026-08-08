"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  type CategoryMutationResult,
  type DeleteCategoryResult,
} from "@/features/admin/lib/categories/categories";

/**
 * Category write actions (ticket 08). The RLS admin policies on `categories`
 * are the security boundary — a non-admin calling these directly gets an RLS
 * error, surfaced here as a friendly failure.
 */

export async function createCategoryAction(
  name: string,
): Promise<CategoryMutationResult> {
  const supabase = await createClient();
  return createCategory(supabase, name);
}

export async function renameCategoryAction(
  id: string,
  name: string,
): Promise<CategoryMutationResult> {
  const supabase = await createClient();
  return renameCategory(supabase, id, name);
}

export async function deleteCategoryAction(
  id: string,
): Promise<DeleteCategoryResult> {
  const supabase = await createClient();
  return deleteCategory(supabase, id);
}
