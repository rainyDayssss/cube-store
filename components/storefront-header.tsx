import { StorefrontDrawer } from "@/components/storefront-drawer";
import { CatalogRefresh } from "@/features/catalog/components/catalog-refresh";
import { CartBadge } from "@/features/cart/components/cart-badge";
import { StorefrontNav } from "@/components/storefront-nav";
import { ThemeSwitcher } from "@/components/theme-switcher";

// The storefront is guest-only (ADR-0001 / ADR-0007): it renders no auth UI
// whatsoever. Admins reach the dashboard through its own URL and sign in there.
export function StorefrontHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      {/* Catalog sync (ADR-0010): polls the catalog while the tab is visible
          so Customers see Admin changes without reloading. Renders nothing. */}
      <CatalogRefresh />
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4 sm:gap-3 sm:px-5">
        {/* Mobile: hamburger opens the drawer (Cart lives inside too). */}
        <div className="md:hidden">
          <StorefrontDrawer />
        </div>

        <StorefrontNav />

        <div className="ml-auto flex items-center gap-1">
          <ThemeSwitcher />
          <CartBadge />
        </div>
      </div>
    </header>
  );
}
