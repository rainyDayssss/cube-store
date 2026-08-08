import Link from "next/link";
import { CubeFace } from "@/components/cube-face";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Facebook, Mail, MapPin, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border/60">
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
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
              Speed cubes, puzzles, and collectibles — curated, stocked, and
              ready to ship.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                href="/cart"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cart
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

          {/* Social */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Follow us
            </h3>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Facebook className="h-3.5 w-3.5 shrink-0" />
              Facebook
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 Cube Store. All rights reserved.</p>
          <ThemeSwitcher />
        </div>
      </div>
    </footer>
  );
}
