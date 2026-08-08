import { ThemeSwitcher } from "@/components/theme-switcher";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border/60">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-8 text-xs text-muted-foreground">
        <p>© 2026 Cube Store</p>
        <ThemeSwitcher />
      </div>
    </footer>
  );
}
