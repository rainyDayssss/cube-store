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
import { ConfirmDeleteModal } from "@/features/admin/components/confirm-delete-modal";
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
  const [statusFilter, setStatusFilter] = useState("");
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);
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

  // Live updates (ADR-0011): follow fresh props from a Realtime-triggered
  // refresh. The server page only knows the unfiltered list, so an active
  // search/category filter is preserved by re-running the filtered query.
  useEffect(() => {
    if (searchDraft.trim() || categoryFilter || statusFilter) {
      void refresh(searchDraft, categoryFilter);
    } else {
      setProducts(initialProducts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProducts]);

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
  }, [searchDraft, categoryFilter, statusFilter]);

  async function handleToggle(product: AdminProduct) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusyId(product.id);
    try {
      const next = product.status === "active" ? "inactive" : "active";
      const result = await toggleProductStatusAction(product.id, next);
      if (result.ok) {
        showToast(`"${product.name}" is now ${next}`, "success");
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
        showToast(`"${deleting?.name}" deleted`, "success");
        await refresh();
      } else {
        showToast(result.message, "error");
      }
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
      setDeleting(null);
    }
  }

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

  const filteredProducts = statusFilter
    ? statusFilter === "out_of_stock"
      ? products.filter((p) => p.stock_quantity === 0)
      : products.filter((p) => p.status === statusFilter)
    : products;

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
          <label htmlFor="admin-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="admin-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <Button onClick={() => setModal({ mode: "create" })}>
            <PackagePlus className="h-4 w-4" />
            New product
          </Button>
        </div>
      </div>

      {/* Table */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No products match. Try a different search, category, or status.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-background">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3 font-medium lg:px-4">Product</th>
                <th className="px-3 py-3 font-medium lg:px-4">Category</th>
                <th className="px-3 py-3 font-medium lg:px-4">Price</th>
                <th className="px-3 py-3 font-medium lg:px-4">Stock</th>
                <th className="px-3 py-3 font-medium lg:px-4">Status</th>
                <th className="px-3 py-3 text-right font-medium lg:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.map((product) => {
                const outOfStock = product.stock_quantity === 0;
                return (
                  <tr key={product.id} className={cn(product.status !== "active" && "opacity-70")}>
                    <td className="px-3 py-3 lg:px-4">
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
                          <p className="hidden truncate text-xs text-muted-foreground lg:block">
                            {product.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground lg:px-4">
                      {product.category_name ?? "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums lg:px-4">{priceFormatter.format(product.price)}</td>
                    <td className="px-3 py-3 lg:px-4">
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          outOfStock && "text-destructive",
                        )}
                      >
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="px-3 py-3 lg:px-4">
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
                    <td className="px-3 py-3 lg:px-4">
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
                          onClick={() => setDeleting(product)}
                          aria-label={`Delete ${product.name}`}
                          className={cn(
                            iconButton,
                            "hover:bg-destructive/10 hover:text-destructive",
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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

      {/* Delete confirmation modal */}
      {deleting && (
        <ConfirmDeleteModal
          title="Delete product?"
          message={`Are you sure you want to delete "${deleting.name}"? This action cannot be undone.`}
          busy={busyId === deleting.id}
          onConfirm={() => void handleDelete(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

function Toast({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: "success" | "error";
  onClose: () => void;
}) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const duration = 3500;
    let frame: number;

    function tick() {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        frame = requestAnimationFrame(tick);
      } else {
        onClose();
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onClose]);

  return (
    <div
      role="status"
      className={cn(
        "fixed top-4 right-4 z-50 max-w-sm overflow-hidden rounded-lg border shadow-lg",
        tone === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      <div className="px-4 py-3 text-sm font-medium">{message}</div>
      <div className="h-1 w-full bg-black/10">
        <div
          className={cn(
            "h-full transition-none",
            tone === "error" ? "bg-destructive" : "bg-emerald-500",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
