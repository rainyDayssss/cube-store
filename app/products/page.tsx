import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { CatalogGrid, CatalogGridSkeleton } from "@/features/catalog/components/catalog-grid";
import type { ProductsSearchParams } from "@/features/catalog/lib/catalog";

export const metadata: Metadata = {
  title: "Products — Cube Store",
  description: "Browse the Cube Store catalog — search, filter by category, and sort by price.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductsSearchParams>;
}) {
  // searchParams is a Promise — pass it (unresolved) into the Suspense
  // boundary so the page shell streams immediately and only the grid waits.
  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader />
      <main className="flex-1">
        <Suspense fallback={<CatalogGridSkeleton />}>
          <CatalogGrid searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
