import Link from "next/link";
import { Search } from "lucide-react";
import { StorefrontDrawer } from "@/components/storefront-drawer";
import { CatalogRefresh } from "@/features/catalog/components/catalog-refresh";
import { CartBadge } from "@/features/cart/components/cart-badge";
import { CubeFace } from "@/components/cube-face";
import { Input } from "@/components/ui/input";

function SearchForm({ className }: { className?: string }) {
  return (
    <form action="/products" method="get" role="search" className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          placeholder="Search cubes…"
          aria-label="Search products"
          className="pl-8"
        />
      </div>
    </form>
  );
}

// The storefront is guest-only (ADR-0001 / ADR-0007): it renders no auth UI
// whatsoever. Admins reach the dashboard through its own URL and sign in there.
export function StorefrontHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      {/* Catalog sync (ADR-0010): polls the catalog while the tab is visible
          so Customers see Admin changes without reloading. Renders nothing. */}
      <CatalogRefresh />
      {/* Top row: brand, nav, search (desktop), cart. */}
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4 sm:gap-3 sm:px-5">
        {/* Mobile: hamburger opens the drawer (Cart lives inside too). */}
        <div className="md:hidden">
          <StorefrontDrawer />
        </div>

        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
        >
          {/* Static solved face — the signature mark in miniature. */}
          <CubeFace size="sm" />
          <span className="font-display text-sm font-semibold tracking-tight">
            Cube Store
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Store">
          <Link
            href="/products"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Products
          </Link>
        </nav>

        {/* Desktop: search stays inline in the header row. */}
        <SearchForm className="ml-auto hidden w-full max-w-xs md:block" />

        {/* ml-auto pushes the cart to the right edge on mobile, where the
            search has moved down to its own row. */}
        <CartBadge className="ml-auto md:ml-0" />
      </div>

      {/* Mobile: the search bar gets its own full-width row below the header. */}
      <div className="mx-auto w-full max-w-5xl px-4 pb-2.5 sm:px-5 md:hidden">
        <SearchForm className="w-full" />
      </div>
    </header>
  );
}
