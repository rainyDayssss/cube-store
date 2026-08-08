"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FolderTree,
  LayoutDashboard,
  Menu,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/features/auth/components/logout-button";

const navItems: {
  href: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, ready: true },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: FolderTree,
    ready: true,
  },
  { href: "/admin/products", label: "Products", icon: Package, ready: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart, ready: true },
  { href: "/admin/customers", label: "Customers", icon: Users, ready: true },
];

function NavLink({
  href,
  label,
  icon: Icon,
  ready,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  const base =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

  if (!ready) {
    return (
      <button
        type="button"
        disabled
        title={`${label} management — planned in a later issue`}
        className={`${base} cursor-not-allowed text-muted-foreground opacity-60`}
      >
        <Icon className="h-4 w-4" />
        {label}
        <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium">
          Soon
        </span>
      </button>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`${base} ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function AdminNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 md:hidden">
        <Link
          href="/admin"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <ShieldCheck className="h-5 w-5 text-primary" />
          Cube Store Admin
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-background shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="flex items-center gap-2 font-semibold tracking-tight">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Cube Store Admin
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </nav>
            <div className="border-t border-border p-3">
              <LogoutButton />
            </div>
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-background md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">Cube Store Admin</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
