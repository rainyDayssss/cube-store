"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/features/cart/lib/cart";
import type { Product } from "@/features/catalog/lib/catalog";

/**
 * Add to Cart control (tickets 04/05): a quantity stepper capped at available
 * stock, plus the Add to Cart button which dispatches to the persisted Zustand
 * cart store. The "Added to cart" confirmation is transient UI only — the
 * store is the source of truth for the cart.
 */
export function AddToCart({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outOfStock = product.stock_quantity === 0;
  const maxQuantity = Math.max(1, product.stock_quantity);

  // Clear the pending "Added to cart" timer on unmount to avoid setting state
  // on an unmounted component after a quick navigation.
  useEffect(() => {
    return () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    };
  }, []);

  function clamp(next: number) {
    return Math.min(Math.max(next, 1), maxQuantity);
  }

  function dispatchAddToCart() {
    addItem(product, quantity);
    setJustAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(false), 1600);
  }

  if (outOfStock) {
    return (
      <Button disabled size="lg" className="w-full sm:w-auto">
        <ShoppingCart className="h-4 w-4" />
        Out of stock
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex h-10 w-full items-center rounded-md border border-input bg-background shadow-sm sm:w-auto">
        <button
          type="button"
          onClick={() => setQuantity((q) => clamp(q - 1))}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
          className="flex h-full flex-1 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-10 sm:flex-none"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span
          aria-live="polite"
          className="flex h-full min-w-12 items-center justify-center px-2 text-sm font-semibold tabular-nums"
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => setQuantity((q) => clamp(q + 1))}
          disabled={quantity >= maxQuantity}
          aria-label="Increase quantity"
          className="flex h-full flex-1 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-10 sm:flex-none"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Button
        size="lg"
        onClick={dispatchAddToCart}
        className={cn("w-full sm:w-auto", justAdded && "bg-emerald-600 hover:bg-emerald-600")}
      >
        {justAdded ? (
          <>
            <Check className="h-4 w-4" />
            Added to cart
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" />
            Add to cart
          </>
        )}
      </Button>
    </div>
  );
}
