import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { getFeaturedCategories, getFeaturedProducts } from "@/features/catalog/lib/catalog";
import { ProductCard } from "@/features/catalog/components/product-card";
import { STICKER_COLORS } from "@/components/cube-palette";

export async function FeaturedCatalog() {
  if (!hasEnvVars) {
    return <SetupHint />;
  }

  const supabase = await createClient();
  const [categories, products] = await Promise.all([
    getFeaturedCategories(supabase),
    getFeaturedProducts(supabase),
  ]);

  if (categories.length === 0 && products.length === 0) {
    return <EmptyCatalog />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 px-5 py-14">
      {categories.length > 0 && (
        <section id="categories" aria-labelledby="featured-categories">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2
              id="featured-categories"
              className="font-display text-2xl font-semibold tracking-tight"
            >
              Shop by category
            </h2>
            <Link
              href="/products"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className="group relative flex h-24 flex-col justify-end overflow-hidden rounded-xl border border-border bg-gradient-to-b from-muted/60 to-muted p-4 transition-colors hover:border-primary/50"
              >
                {/* A sticker dot, cycling the palette — each tile keeps one
                    accent from the cube face. */}
                <span
                  aria-hidden
                  className="absolute right-3 top-3 h-2.5 w-2.5 rounded-[3px] transition-transform duration-300 group-hover:scale-125"
                  style={{
                    backgroundColor: STICKER_COLORS[index % STICKER_COLORS.length],
                  }}
                />
                <span className="font-medium transition-colors group-hover:text-primary">
                  {category.name}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Browse →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {products.length > 0 && (
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
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} categories={categories} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function FeaturedCatalogSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 px-5 py-14">
      <div className="space-y-5">
        <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
      <div className="space-y-5">
        <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-xl bg-muted" />
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
          Once the catalog has Categories and Products, they will appear here.
        </p>
      </div>
    </div>
  );
}
