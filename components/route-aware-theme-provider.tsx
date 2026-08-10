"use client";

import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";

export function RouteAwareThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/auth");

  return (
    <ThemeProvider
      key={isAdmin ? "admin" : "storefront"}
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={isAdmin ? "admin-theme" : "theme"}
    >
      {children}
    </ThemeProvider>
  );
}
