import Link from "next/link";
import { CubeFace } from "@/components/cube-face";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border/60 bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand + Newsletter */}
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <CubeFace size="sm" />
              <span className="font-display text-sm font-semibold tracking-tight">
                Cube Store
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Curious objects for mind and desk — speed cubes, brain teasers,
              desk toys, and collectibles.
            </p>
          </div>

          {/* Shop */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shop
            </h3>
            <nav className="flex flex-col gap-1.5" aria-label="Footer shop links">
              <Link
                href="/products"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                All Products
              </Link>
              <Link
                href="/products?category=speed-cubes"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Speed Cubes
              </Link>
              <Link
                href="/products?category=puzzles"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Brain Teasers
              </Link>
              <Link
                href="/products?category=collectibles"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Collectibles
              </Link>
              <Link
                href="/cart"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cart
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact
            </h3>
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <a
                href="mailto:support@cubestore.com"
                className="flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                support@cubestore.com
              </a>
              <a
                href="tel:+639123456789"
                className="flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                +63 912 345 6789
              </a>
              <span className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                123 Cube Street, Makati City, Metro Manila
              </span>
            </div>
          </div>

          {/* Follow */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Follow us
            </h3>
            <div className="flex flex-col gap-1.5">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Facebook className="h-3.5 w-3.5 shrink-0" />
                Facebook
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Instagram className="h-3.5 w-3.5 shrink-0" />
                Instagram
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>&copy; 2026 Cube Store. All rights reserved.</p>
          <p className="font-display text-[11px] tracking-wide">
            Every piece, a new challenge.
          </p>
        </div>
      </div>
    </footer>
  );
}
