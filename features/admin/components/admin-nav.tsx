"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { CubeFace } from "@/components/cube-face";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useRouter } from "next/navigation";

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
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  const base = collapsed
    ? "flex w-full items-center justify-center rounded-lg p-2 text-sm font-medium transition-colors"
    : "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

  if (!ready) {
    return (
      <button
        type="button"
        disabled
        title={`${label} management — planned in a later issue`}
        className={`${base} cursor-not-allowed text-muted-foreground opacity-60`}
      >
        <Icon className="h-4 w-4" />
        {!collapsed && (
          <>
            {label}
            <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium">
              Soon
            </span>
          </>
        )}
      </button>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={`${base} ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {!collapsed && label}
    </Link>
  );
}

function SidebarLogout({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
    } finally {
      setBusy(false);
    }
  };

  if (collapsed) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          title="Logout"
          className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
        {showConfirm && (
          <ConfirmModal
            title="Logout?"
            message="Are you sure you want to logout? You will need to sign in again to access the admin dashboard."
            confirmLabel="Logout"
            confirmIcon={LogOut}
            busy={busy}
            onConfirm={logout}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </>
    );
  }

  return <LogoutButton />;
}

export function AdminNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mouseY, setMouseY] = useState<number | null>(null);

  // Persist sidebar state in localStorage.
  useEffect(() => {
    const stored = localStorage.getItem("admin-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  // Lock background scroll + Escape key when mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("admin-sidebar-collapsed", String(next));
  }

  function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseY(e.clientY - rect.top);
  }

  function handleMouseLeave() {
    setMouseY(null);
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-background px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link
          href="/admin"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <CubeFace size="sm" />
          Cube Store Admin
        </Link>
        <div className="ml-auto">
          <ThemeSwitcher />
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 h-full w-full bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-background shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="flex items-center gap-2 font-semibold tracking-tight">
                <CubeFace size="sm" />
                Cube Store Admin
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  collapsed={false}
                  onNavigate={() => setMobileOpen(false)}
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
      <aside
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`group/sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-background transition-[width] duration-200 md:flex ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div
          className={`flex h-16 items-center border-b border-border ${
            collapsed ? "justify-center px-2" : "gap-2 px-5"
          }`}
        >
          <CubeFace size="sm" />
          {!collapsed && (
            <span className="font-semibold tracking-tight">Cube Store Admin</span>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} collapsed={collapsed} />
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-2">
            <ThemeSwitcher />
          </div>
          <SidebarLogout collapsed={collapsed} />
        </div>

        {/* Hover toggle arrow follows mouse on sidebar edge */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-opacity hover:bg-muted hover:text-foreground"
          style={{
            top: mouseY !== null ? `${mouseY}px` : "80px",
            transform: "translateY(-50%)",
            opacity: mouseY !== null ? 1 : 0,
          }}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>
    </>
  );
}
