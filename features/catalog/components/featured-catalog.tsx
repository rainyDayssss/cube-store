import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { getFeaturedCategories, getFeaturedProducts } from "@/features/catalog/lib/catalog";
import { ProductCard } from "@/features/catalog/components/product-card";

export async function FeaturedCatalog() {
  if (!hasEnvVars) {
    return <SetupHint />;
  }

  const supabase = await createClient();
  const [categories, products] = await Promise.all([
    getFeaturedCategories(supabase),
    getFeaturedProducts(supabase),
  ]);

  if (products.length === 0) {
    return <EmptyCatalog />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14">
      {/* Category pills */}
      {categories.length > 0 && (
        <section id="categories" aria-labelledby="featured-categories" className="mb-10">
          <h2 id="featured-categories" className="sr-only">
            Shop by category
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section aria-labelledby="featured-products">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2
            id="featured-products"
            className="font-display text-2xl font-semibold tracking-tight"
          >
            Featured products
          </h2>
          <Link
            href="/products"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} categories={categories} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function FeaturedCatalogSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14">
      {/* Category pills skeleton */}
      <div className="mb-10 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-9 w-24 animate-shimmer rounded-full" />
        ))}
      </div>
      {/* Products skeleton */}
      <div className="space-y-5">
        <div className="h-6 w-48 animate-shimmer rounded-md" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-square animate-shimmer rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function SetupHint() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14">
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium">The catalog is waiting for Supabase.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Copy `.env.example` to `.env.local`, add your Supabase project keys, and
          apply the migrations in `supabase/migrations/` to load the seed catalog.
        </p>
      </div>
    </div>
  );
}

function EmptyCatalog() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14">
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium">No products yet.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Once the catalog has Products, they will appear here.
        </p>
      </div>
    </div>
  );
}
