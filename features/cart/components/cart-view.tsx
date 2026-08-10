"use client";

import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import {
  cartCount,
  cartSubtotal,
  useCartStore,
  type CartItem,
} from "@/features/cart/lib/cart";
import { useCartReconcile } from "@/features/cart/lib/use-cart-reconcile";
import { Button } from "@/components/ui/button";

const priceFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export function CartView() {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="h-8 w-28 animate-shimmer rounded-md" />
        <div className="mt-2 h-8 w-40 animate-shimmer rounded-md" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-24 animate-shimmer rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-muted-foreground">
        <Link href="/products">
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </Link>
      </Button>
      <h1 className="font-display text-3xl font-bold tracking-tight">Your cart</h1>

      {items.length === 0 ? (
        <EmptyCart />
      ) : (
        <CartContents />
      )}
    </div>
  );
}

function CartContents() {
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const subtotal = cartSubtotal(items);
  const count = cartCount(items);
  // Keep lines in line with the live catalog (ADR-0013): prices/stock refresh,
  // retired Products get flagged. The returned result drives the notices.
  const reconciled = useCartReconcile();
  const unavailableCount = items.filter((item) => item.unavailable).length;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        {reconciled && reconciled.updated.length > 0 && (
          <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            Cart updated to match the current catalog.
          </p>
        )}
        {unavailableCount > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5">
            <p className="text-sm font-medium text-destructive">
              {unavailableCount} item{unavailableCount === 1 ? " is" : "s are"} no longer
              available.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                items
                  .filter((item) => item.unavailable)
                  .forEach((item) => removeItem(item.id));
              }}
            >
              Remove unavailable
            </Button>
          </div>
        )}
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((item) => (
            <CartLine key={item.id} item={item} />
          ))}
        </ul>
      </div>

      <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Order summary
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Items ({count})
            </dt>
            <dd className="font-medium tabular-nums">
              {priceFormatter.format(subtotal)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="font-medium">{subtotal >= 2500 ? "Free" : "Calculated at checkout"}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{priceFormatter.format(subtotal)}</dd>
          </div>
        </dl>
        {unavailableCount > 0 ? (
          <Button size="lg" className="mt-5 w-full" disabled>
            Checkout
          </Button>
        ) : (
          <Button asChild size="lg" className="mt-5 w-full">
            <Link href="/checkout">Checkout</Link>
          </Button>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Stock is reserved when you place your order.
        </p>
      </aside>
    </div>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const unavailable = item.unavailable === true;
  const outOfStock = !unavailable && item.stock_quantity === 0;

  return (
    <li className="flex gap-4 p-4">
      <Link
        href={`/products/${item.id}`}
        className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:h-20 sm:w-20"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote images from seed/Storage */}
        <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
      </Link>

      {/* min-w-0 lets this column shrink below its content width on small
          screens instead of pushing the line item off the right edge. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${item.id}`}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              {item.name}
            </Link>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {priceFormatter.format(item.price)} each
            </p>
            {unavailable ? (
              <p className="mt-1 text-xs font-semibold text-destructive">
                No longer available — remove
              </p>
            ) : outOfStock ? (
              <p className="mt-1 text-xs font-medium text-destructive">
                Out of stock — adjust or remove
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            aria-label={`Remove ${item.name} from cart`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* flex-wrap: at ~320px the stepper and line total no longer fit side
            by side, so the total wraps onto its own right-aligned row. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex h-9 shrink-0 items-center rounded-md border border-input bg-background shadow-sm">
            <button
              type="button"
              onClick={() => updateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-full w-8 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-9"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="flex h-full min-w-8 items-center justify-center px-1.5 text-sm font-semibold tabular-nums sm:min-w-10 sm:px-2">
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
              disabled={unavailable || item.quantity >= item.stock_quantity}
              aria-label="Increase quantity"
              className="flex h-full w-8 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-9"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <span className="ml-auto text-sm font-semibold tabular-nums">
            {priceFormatter.format(item.price * item.quantity)}
          </span>
        </div>
      </div>
    </li>
  );
}

function EmptyCart() {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <ShoppingCart className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">Your cart is empty</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Add a few items from the catalog and they will appear here.
      </p>
      <Button asChild className="mt-6">
        <Link href="/products">Browse products</Link>
      </Button>
    </div>
  );
}


