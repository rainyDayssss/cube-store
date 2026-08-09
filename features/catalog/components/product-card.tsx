"use client";

import Link from "next/link";
import { Check, Eye, ShoppingCart, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import type { Category, Product } from "@/features/catalog/lib/catalog";
import { useCartStore } from "@/features/cart/lib/cart";

const priceFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export function ProductCard({
  product,
  categories,
}: {
  product: Product;
  categories?: Category[];
}) {
  const addItem = useCartStore((state) => state.addItem);
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outOfStock = product.stock_quantity === 0;
  const categoryName =
    categories?.find((c) => c.id === product.category_id)?.name ?? null;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    addItem(product, 1);
    setJustAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(false), 1600);
  }

  function handleViewDetails(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = `/products/${product.id}`;
  }

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote images from seed/Storage */}
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {outOfStock && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
            <XCircle className="h-3 w-3" />
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {categoryName && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {categoryName}
          </p>
        )}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">
          {product.name}
        </h3>
        <p className="mt-auto pt-1 font-display text-base font-bold tabular-nums">
          {priceFormatter.format(product.price)}
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleViewDetails}
            aria-label={`View details for ${product.name}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Eye className="h-3.5 w-3.5" />
            View Details
          </button>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={outOfStock}
            aria-label={`Add ${product.name} to cart`}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              justAdded
                ? "bg-emerald-600 text-white"
                : outOfStock
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            }`}
          >
            {justAdded ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Added
              </>
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5" />
                Add to Cart
              </>
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}
