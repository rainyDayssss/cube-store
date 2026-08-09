"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ColumnFilterOption = {
  value: string;
  label: string;
};

export type ColumnSortValue = "asc" | "desc" | "";

export function ColumnHeader({
  label,
  filterValue,
  filterOptions,
  sortValue,
  onFilterChange,
  onSortChange,
  className,
}: {
  label: string;
  filterValue?: string;
  filterOptions?: ColumnFilterOption[];
  sortValue?: ColumnSortValue;
  onFilterChange?: (value: string) => void;
  onSortChange?: (value: ColumnSortValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasFilter = filterOptions && filterOptions.length > 0 && onFilterChange;
  const hasSort = onSortChange;
  const isInteractive = hasFilter || hasSort;

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const hasActiveFilter = hasFilter && filterValue && filterValue !== "";
  const hasActiveSort = hasSort && sortValue && sortValue.length > 0;

  if (!isInteractive) {
    return <th className={className}>{label}</th>;
  }

  return (
    <th className={className}>
      <div ref={menuRef} className="relative inline-flex">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "group inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs uppercase tracking-wide transition-colors",
            "hover:bg-muted hover:text-foreground",
            (hasActiveFilter || hasActiveSort) && "text-primary",
          )}
        >
          {label}
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground transition-colors",
              open && "text-foreground",
              (hasActiveFilter || hasActiveSort) && "text-primary",
            )}
          />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-border bg-background shadow-lg">
            {hasSort && (
              <div className="border-b border-border p-1">
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Sort
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onSortChange(sortValue === "asc" ? "" : "asc");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted",
                    sortValue === "asc" && "bg-muted font-medium text-primary",
                  )}
                >
                  Low to High
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSortChange(sortValue === "desc" ? "" : "desc");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted",
                    sortValue === "desc" && "bg-muted font-medium text-primary",
                  )}
                >
                  High to Low
                </button>
              </div>
            )}
            {hasFilter && (
              <div className="p-1">
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Filter
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange("");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted",
                    (!filterValue || filterValue === "") && "bg-muted font-medium text-primary",
                  )}
                >
                  All
                </button>
                {filterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onFilterChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted",
                      filterValue === opt.value && "bg-muted font-medium text-primary",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </th>
  );
}
