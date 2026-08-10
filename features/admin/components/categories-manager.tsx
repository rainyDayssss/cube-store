"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, Pencil, Search, Trash2 } from "lucide-react";
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
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ToastState = { message: string; tone: "success" | "error" };

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: CategoryWithCount[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [searchDraft, setSearchDraft] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<CategoryWithCount | null>(null);
  const [deleting, setDeleting] = useState<CategoryWithCount | null>(null);
  const [cannotDelete, setCannotDelete] = useState<CategoryWithCount | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const inFlightRef = useRef(false);

  // Live updates (ADR-0011)
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

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
        setToast({ message: `"${result.category.name}" created`, tone: "success" });
        await refresh();
      } else {
        setToast({ message: result.message, tone: "error" });
      }
    } finally {
      inFlightRef.current = false;
      setBusy(null);
    }
  }

  async function handleRename(name: string) {
    if (!editing || busy !== null || inFlightRef.current || !name.trim()) return;
    const { id } = editing;
    inFlightRef.current = true;
    setBusy(id);
    try {
      const result = await renameCategoryAction(id, name);
      if (result.ok) {
        setToast({ message: `"${name}" renamed`, tone: "success" });
        await refresh();
      } else {
        setToast({ message: result.message, tone: "error" });
      }
    } finally {
      inFlightRef.current = false;
      setBusy(null);
      setEditing(null);
    }
  }

  async function handleDelete(id: string) {
    if (busy !== null || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(id);
    try {
      const result = await deleteCategoryAction(id);
      if (result.ok) {
        setToast({ message: `"${deleting?.name}" deleted`, tone: "success" });
        await refresh();
      } else {
        setToast({ message: result.message, tone: "error" });
      }
    } finally {
      inFlightRef.current = false;
      setBusy(null);
      setDeleting(null);
    }
  }

  function handleDeleteClick(category: CategoryWithCount) {
    if (category.productCount > 0) {
      setCannotDelete(category);
    } else {
      setDeleting(category);
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
              className="flex items-center justify-between p-4"
            >
              {/* Category info */}
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

              {/* Row actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(category)}
                  aria-label={`Edit ${category.name}`}
                  className={iconButton}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(category)}
                  aria-label={`Delete ${category.name}`}
                  className={cn(
                    iconButton,
                    "hover:bg-destructive/10 hover:text-destructive",
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CategoryFormModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSaved={(name) => void handleCreate(name)}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <CategoryFormModal
          mode="edit"
          initialName={editing.name}
          initialSlug={editing.slug}
          onClose={() => setEditing(null)}
          onSaved={(name) => void handleRename(name)}
        />
      )}

      {/* Delete confirmation modal */}
      {deleting && (
        <ConfirmDeleteModal
          title="Delete category?"
          message={`Are you sure you want to delete "${deleting.name}"? This action cannot be undone.`}
          busy={busy === deleting.id}
          onConfirm={() => void handleDelete(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* Cannot delete modal (category has products) */}
      {cannotDelete && (
        <ConfirmModal
          title="Cannot delete category"
          message={`"${cannotDelete.name}" cannot be deleted because it has ${cannotDelete.productCount} product${cannotDelete.productCount === 1 ? "" : "s"} linked.`}
          warning="Remove or reassign the products first, then try again."
          confirmLabel="Close"
          hideCancel={true}
          busy={false}
          onConfirm={() => setCannotDelete(null)}
          onCancel={() => setCannotDelete(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
