"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, PackagePlus, Pencil, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listAdminProducts } from "@/features/admin/lib/products/products";
import type { Category, Product } from "@/features/catalog/lib/catalog";
import {
  deleteProductAction,
  toggleProductStatusAction,
} from "@/features/admin/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductFormModal } from "@/features/admin/components/product-form-modal";
import { cn } from "@/lib/utils";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export type AdminProduct = Product & { category_name: string | null };

type Toast = { id: number; message: string; tone: "success" | "error" };
type ModalState = { mode: "create" } | { mode: "edit"; product: AdminProduct } | null;

export function ProductsManager({
  initialProducts,
  categories,
}: {
  initialProducts: AdminProduct[];
  categories: Category[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [searchDraft, setSearchDraft] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const firstRender = useRef(true);
  // Monotonic sequence so a slower earlier response can never overwrite a
  // newer one when the user changes search + category quickly.
  const sequenceRef = useRef(0);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  function showToast(message: string, tone: Toast["tone"]) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  async function refresh(q = searchDraft, categoryId = categoryFilter) {
    const sequence = ++sequenceRef.current;
    const supabase = createClient();
    const result = await listAdminProducts(supabase, { q, categoryId });
    // Drop stale responses (a newer search/category change already landed).
    if (sequence === sequenceRef.current) setProducts(result);
  }

  // Debounced name search against the database. The mount render is skipped
  // — the server page already provided the unfiltered list.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void refresh(searchDraft, categoryFilter);
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, categoryFilter]);

  async function handleToggle(product: AdminProduct) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusyId(product.id);
    try {
      const next = product.status === "active" ? "inactive" : "active";
      const result = await toggleProductStatusAction(product.id, next);
      if (result.ok) {
        showToast(
          `"${product.name}" is now ${next === "active" ? "visible" : "hidden"} in the storefront`,
          "success",
        );
        await refresh();
      } else {
        showToast(result.message, "error");
      }
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusyId(id);
    try {
      const result = await deleteProductAction(id);
      if (result.ok) {
        showToast("Product deleted", "success");
        await refresh();
      } else {
        showToast(result.message, "error");
      }
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
      setConfirming(null);
    }
  }

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="admin-category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="admin-category-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setModal({ mode: "create" })}>
            <PackagePlus className="h-4 w-4" />
            New product
          </Button>
        </div>
      </div>

      {/* Table */}
      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No products match. Try a different search or category.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-background">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => {
                const outOfStock = product.stock_quantity === 0;
                return (
                  <tr key={product.id} className={cn(product.status !== "active" && "opacity-70")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails */}
                          <img
                            src={product.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {product.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {product.category_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{priceFormatter.format(product.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          outOfStock && "text-destructive",
                        )}
                      >
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void handleToggle(product)}
                        disabled={busyId === product.id}
                        aria-label={`Set ${product.name} ${
                          product.status === "active" ? "inactive" : "active"
                        }`}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                          product.status === "active"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                            : "border-border bg-muted text-muted-foreground hover:bg-muted/60",
                        )}
                      >
                        {busyId === product.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              product.status === "active"
                                ? "bg-emerald-500"
                                : "bg-muted-foreground",
                            )}
                          />
                        )}
                        {product.status === "active" ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {confirming === product.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busyId !== null}
                            onClick={() => void handleDelete(product.id)}
                          >
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId !== null}
                            onClick={() => setConfirming(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setModal({ mode: "edit", product })}
                            aria-label={`Edit ${product.name}`}
                            className={iconButton}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(product.id)}
                            aria-label={`Delete ${product.name}`}
                            className={cn(
                              iconButton,
                              "hover:bg-destructive/10 hover:text-destructive",
                            )}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/edit modal */}
      {modal && (
        <ProductFormModal
          mode={modal.mode}
          product={modal.mode === "edit" ? modal.product : null}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            showToast(message, "success");
            void refresh();
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={cn(
            "fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-medium shadow-lg",
            toast.tone === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
