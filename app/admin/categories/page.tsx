import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listCategoriesWithCounts } from "@/features/admin/lib/categories/categories";
import { CategoriesManager } from "@/features/admin/components/categories-manager";

export const metadata: Metadata = {
  title: "Categories — Cube Store Admin",
  description: "Manage store categories: create, rename, and delete.",
};

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const categories = await listCategoriesWithCounts(supabase);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="mt-1 text-muted-foreground">
          Organise the catalog. Changes appear in the storefront immediately.
        </p>
      </div>

      <CategoriesManager initialCategories={categories} />
    </div>
  );
}
