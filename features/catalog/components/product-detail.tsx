import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PackageCheck, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import {
  getFeaturedCategories,
  getProductById,
  getRelatedProducts,
} from "@/features/catalog/lib/catalog";
import { ProductCard } from "@/features/catalog/components/product-card";
import { AddToCart } from "@/features/catalog/components/add-to-cart";
import { Button } from "@/components/ui/button";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export async function ProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!hasEnvVars) {
    return <SetupHint />;
  }

  const { id } = await params;
  const supabase = await createClient();
  const product = await getProductById(supabase, id);

  if (!product) {
    notFound();
  }

  // Related products need the product's own category, so they are fetched
  // after the product resolves; categories resolve the slug for the chip.
  const [related, categories] = await Promise.all([
    getRelatedProducts(supabase, product.category_id, product.id),
    getFeaturedCategories(supabase),
  ]);
  const category =
    categories.find((c) => c.id === product.category_id) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-6 text-muted-foreground">
        <Link href="/products">
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote images from seed/Storage */}
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            {category && (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Link
                  href={`/products?category=${category.slug}`}
                  className="transition-colors hover:text-foreground"
                >
                  {category.name}
                </Link>
              </p>
            )}
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
              {product.name}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-3xl font-semibold">
              {priceFormatter.format(product.price)}
            </span>
            <StockBadge stockQuantity={product.stock_quantity} />
          </div>

          {product.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}

          <AddToCart product={product} />

          <div className="mt-2 grid gap-3 border-t border-border pt-5 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Truck className="h-4 w-4 shrink-0" />
              <span>Free shipping on orders over $50</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <PackageCheck className="h-4 w-4 shrink-0" />
              <span>Ready to ship within 1–2 business days</span>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-products" className="mt-16">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 id="related-products" className="text-2xl font-semibold tracking-tight">
              Related products
            </h2>
            <Link
              href="/products"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((product) => (
              <ProductCard key={product.id} product={product} categories={categories} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <div className="h-8 w-28 animate-shimmer rounded-md" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="aspect-square animate-shimmer rounded-2xl" />
        <div className="flex flex-col gap-5">
          <div className="h-4 w-24 animate-shimmer rounded-md" />
          <div className="h-9 w-2/3 animate-shimmer rounded-md" />
          <div className="h-8 w-40 animate-shimmer rounded-md" />
          <div className="h-24 w-full animate-shimmer rounded-md" />
          <div className="h-12 w-full animate-shimmer rounded-md" />
        </div>
      </div>
      <div className="mt-16">
        <div className="h-6 w-40 animate-shimmer rounded-md" />
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-square animate-shimmer rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function StockBadge({ stockQuantity }: { stockQuantity: number }) {
  if (stockQuantity === 0) {
    return (
      <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
        Out of stock
      </span>
    );
  }
  if (stockQuantity <= 5) {
    return (
      <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        Only {stockQuantity} left
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      {stockQuantity} in stock
    </span>
  );
}

function SetupHint() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium">The catalog is waiting for Supabase.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Copy `.env.example` to `.env.local`, add your Supabase project keys, and
          apply the migrations in `supabase/migrations/` to load the seed catalog.
        </p>
      </div>
    </div>
  );
}
