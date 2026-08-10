"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CubeFace } from "@/components/cube-face";

export function StorefrontNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isProducts = pathname.startsWith("/products");
  const isTrack = pathname === "/track";

  return (
    <>
      <Link
        href="/"
        className={`flex shrink-0 items-center gap-2 transition-opacity ${isHome ? "text-foreground" : "text-foreground/80 hover:opacity-80"}`}
      >
        <CubeFace size="sm" />
        <span className="font-display text-sm font-semibold tracking-tight">
          Cube Store
        </span>
      </Link>

      <nav className="hidden items-center gap-6 md:flex" aria-label="Store">
        <Link
          href="/"
          className={`relative text-sm font-medium transition-colors ${isHome ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
        >
          Home
        </Link>
        <Link
          href="/products"
          className={`relative text-sm font-medium transition-colors ${isProducts ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
        >
          Products
        </Link>
        <Link
          href="/track"
          className={`relative text-sm font-medium transition-colors ${isTrack ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
        >
          Track Order
        </Link>
      </nav>
    </>
  );
}
