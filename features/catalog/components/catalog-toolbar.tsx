"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  isValidSort,
  type Category,
  type CatalogSort,
} from "@/features/catalog/lib/catalog";

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

/**
 * The catalog toolbar: instant name search, a Category filter, and price
 * sorting. Every change is pushed into the URL query string (via the router)
 * so the server component re-renders with the new state — refresh-safe by
 * construction. Page resets to 1 whenever a filter changes.
 */
export function CatalogToolbar({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const rawSort = searchParams.get("sort");
  const sort: CatalogSort = isValidSort(rawSort) ? rawSort : "newest";

  const [draft, setDraft] = useState(q);
  const firstRender = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Always points at the newest searchParams so a pending search timer can
  // never overwrite a category/sort change made while the timer was waiting.
  const latestParamsRef = useRef(searchParams);
  latestParamsRef.current = searchParams;

  // Horizontal-scroll hint for the filter row: on mobile the controls keep
  // their place on one line (swipe to reach the rest), and a fade appears on
  // the right edge only while there is more content to scroll to.
  const filterRowRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollHint() {
    const el = filterRowRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollHint();
    const el = filterRowRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(el);
    // A <select> grows when a longer option is chosen — observe the children
    // too so the hint updates the moment the row actually overflows.
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, []);

  // Keep the input in sync when the URL changes (back/forward, "clear" link),
  // but never clobber text the user is actively typing.
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      setDraft(q);
    }
  }, [q]);

  /**
   * Merges `changes` into `base` (the URLSearchParams), resets to page 1 by
   * dropping the `page` param entirely, and pushes the result. The debounced
   * search passes `latest` (a ref that always holds the newest
   * URLSearchParams) so a pending search timer can never overwrite a
   * category/sort change made while the timer was waiting.
   */
  function updateParams(
    changes: { q?: string; category?: string; sort?: string },
    base: URLSearchParams,
  ) {
    const params = new URLSearchParams(base);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "") params.set(key, value);
      else params.delete(key);
    }
    // Any filter change resets to the first page.
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `/products?${qs}` : "/products");
  }

  // Debounce typing into the URL.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateParams({ q: draft }, latestParamsRef.current);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // The timer only resets on draft changes; the base params are read from
    // `latestParamsRef` at fire time so concurrent filter changes win.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          className="pl-8"
        />
      </div>

      {/* Filters stay on one row at every size: when the controls overflow
          the viewport they scroll horizontally instead of wrapping. */}
      <div className="relative min-w-0">
        <div
          ref={filterRowRef}
          onScroll={updateScrollHint}
          className="flex items-center gap-3 overflow-x-auto overscroll-x-contain pb-1"
        >
          <div className="flex shrink-0 items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
            <label htmlFor="category-filter" className="sr-only">
              Filter by category
            </label>
            <select
              id="category-filter"
              value={category}
              onChange={(event) => updateParams({ category: event.target.value }, searchParams)}
              className={cn(
                "h-9 shrink-0 rounded-md border border-input bg-background px-3 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="sort-select" className="sr-only">
            Sort products
          </label>
          <select
            id="sort-select"
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value }, searchParams)}
            className={cn(
              "h-9 shrink-0 rounded-md border border-input bg-background px-3 text-sm shadow-sm",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Fade hint on the right edge while more controls are off-screen. */}
        {canScrollRight && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
          />
        )}
      </div>
    </div>
  );
}
