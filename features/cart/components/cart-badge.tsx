"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { cartCount, useCartStore } from "@/features/cart/lib/cart";

/**
 * Header cart link with a live unit-count badge. SSR-safe: the persisted store
 * only hydrates on the client, so the badge renders once hydrated (the count
 * of an empty-but-unhydrated cart would be a misleading "0" flash otherwise).
 */
export function CartBadge({ className }: { className?: string }) {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const pathname = usePathname();

  const count = hasHydrated ? cartCount(items) : 0;
  const showBadge = hasHydrated && count > 0;
  const isCart = pathname === "/cart";

  return (
    <Link
      href="/cart"
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground ${isCart ? "text-foreground" : "text-muted-foreground"} ${className ?? ""}`}
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <ShoppingCart className="h-5 w-5" />
      {showBadge && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
