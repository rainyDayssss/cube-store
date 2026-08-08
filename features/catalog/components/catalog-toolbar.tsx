"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  isValidSort,
  type Category,
  type CatalogSort,
} from "@/features/catalog/lib/catalog";

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
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
  const sort: CatalogSort | "" = isValidSort(rawSort) ? rawSort : "";

  const [draft, setDraft] = useState(q);
  const firstRender = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Always points at the newest searchParams so a pending search timer can
  // never overwrite a category/sort change made while the timer was waiting.
  const latestParamsRef = useRef(searchParams);
  latestParamsRef.current = searchParams;

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

      {/* Filters: stacked full-width on mobile, side-by-side on desktop. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor="category-filter" className="sr-only">
          Filter by category
        </label>
        <select
          id="category-filter"
          value={category}
          onChange={(event) => updateParams({ category: event.target.value }, searchParams)}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm sm:w-auto",
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

        <label htmlFor="sort-select" className="sr-only">
          Sort products
        </label>
        <select
          id="sort-select"
          value={sort}
          onChange={(event) => updateParams({ sort: event.target.value }, searchParams)}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm sm:w-auto",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        >
          <option value="">Sort by price</option>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
