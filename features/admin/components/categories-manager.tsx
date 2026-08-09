"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FolderPlus, Loader2, Pencil, Search, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listCategoriesWithCounts,
  type CategoryWithCount,
} from "@/features/admin/lib/categories/categories";
import {
  createCategoryAction,
  deleteCategoryAction,
  renameCategoryAction,
} from "@/features/admin/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryFormModal } from "@/features/admin/components/category-form-modal";
import { ConfirmDeleteModal } from "@/features/admin/components/confirm-delete-modal";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "success" | "error" };

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: CategoryWithCount[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [searchDraft, setSearchDraft] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<CategoryWithCount | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Live updates (ADR-0011)
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  function showToast(message: string, tone: Toast["tone"]) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  async function refresh() {
    const supabase = createClient();
    setCategories(await listCategoriesWithCounts(supabase));
  }

  async function handleCreate(name: string) {
    if (busy !== null || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy("create");
    try {
      const result = await createCategoryAction(name);
      if (result.ok) {
        showToast(`"${result.category.name}" created`, "success");
        await refresh();
      } else {
        showToast(result.message, "error");
      }
    } finally {
      inFlightRef.current = false;
      setBusy(null);
    }
  }

  async function handleRename() {
    if (!renaming || busy !== null || inFlightRef.current || !renaming.name.trim())
      return;
    const { id, name } = renaming;
    inFlightRef.current = true;
    setBusy(id);
    try {
      const result = await renameCategoryAction(id, name);
      if (result.ok) {
        showToast(`"${name}" renamed`, "success");
        await refresh();
      } else {
        showToast(result.message, "error");
      }
    } finally {
      inFlightRef.current = false;
      setBusy(null);
      setRenaming(null);
    }
  }

  async function handleDelete(id: string) {
    if (busy !== null || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(id);
    try {
      const result = await deleteCategoryAction(id);
      if (result.ok) {
        showToast(`"${deleting?.name}" deleted`, "success");
        await refresh();
      } else {
        showToast(result.message, "error");
      }
    } finally {
      inFlightRef.current = false;
      setBusy(null);
      setDeleting(null);
    }
  }

  const filtered = useMemo(() => {
    const q = searchDraft.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchDraft]);

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar: search + create button */}
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search categories…"
            aria-label="Search categories"
            className="pl-8"
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="shrink-0">
          <FolderPlus className="h-4 w-4" />
          <span className="hidden sm:inline">New category</span>
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {categories.length === 0
            ? "No categories yet — create the first one above."
            : "No categories match this search."}
        </div>
      ) : (
        <ul className="min-h-[400px] max-h-[600px] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-background">
          {filtered.map((category) => (
            <li
              key={category.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {renaming?.id === category.id ? (
                /* Inline rename */
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={renaming.name}
                    onChange={(event) =>
                      setRenaming({ ...renaming, name: event.target.value })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleRename();
                      if (event.key === "Escape") setRenaming(null);
                    }}
                    aria-label={`Rename ${category.name}`}
                    className="sm:w-64"
                  />
                  <Button
                    size="sm"
                    disabled={busy !== null || !renaming.name.trim()}
                    onClick={() => void handleRename()}
                  >
                    {busy === category.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => setRenaming(null)}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              ) : (
                /* Display */
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{category.name}</p>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {category.productCount} product
                      {category.productCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    /{category.slug}
                  </p>
                </div>
              )}

              {/* Row actions */}
              {renaming?.id !== category.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming({ id: category.id, name: category.name });
                    }}
                    aria-label={`Rename ${category.name}`}
                    className={iconButton}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(category)}
                    aria-label={`Delete ${category.name}`}
                    className={cn(
                      iconButton,
                      "hover:bg-destructive/10 hover:text-destructive",
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CategoryFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={(name) => void handleCreate(name)}
        />
      )}

      {/* Delete confirmation modal */}
      {deleting && (
        <ConfirmDeleteModal
          title="Delete category?"
          message={`Are you sure you want to delete "${deleting.name}"? This action cannot be undone.`}
          warning={
            deleting.productCount > 0
              ? `This category has ${deleting.productCount} product${deleting.productCount === 1 ? "" : "s"} linked. Deleting may fail due to the database constraint.`
              : undefined
          }
          busy={busy === deleting.id}
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
