import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listAdminProducts } from "@/features/admin/lib/products/products";
import { getFeaturedCategories } from "@/features/catalog/lib/catalog";
import { ProductsManager } from "@/features/admin/components/products-manager";

export const metadata: Metadata = {
  title: "Products — Cube Store Admin",
  description: "Manage store products: create, edit, upload images, and toggle visibility.",
};

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const [products, categories] = await Promise.all([
    listAdminProducts(supabase),
    getFeaturedCategories(supabase),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="mt-1 text-muted-foreground">
          Manage the catalog. Availability comes from stock — status only
          controls storefront visibility.
        </p>
      </div>

      <ProductsManager initialProducts={products} categories={categories} />
    </div>
  );
}
