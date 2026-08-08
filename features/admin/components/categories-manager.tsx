"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FolderPlus, Loader2, Pencil, Trash2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; tone: "success" | "error" };

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: CategoryWithCount[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [confirming, setConfirming] = useState<string | null>(null);
  // "create" while creating; a category id while renaming/deleting that row.
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous in-flight guard: `busy` state isn't applied until the next
  // render, so rapid Enter presses could otherwise double-fire an action.
  const inFlightRef = useRef(false);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Live updates (ADR-0011): a Realtime-triggered router.refresh() hands down
  // fresh props — follow them so renames, deletions, and product counts stay
  // current without a reload.
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  function showToast(message: string, tone: Toast["tone"]) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Re-fetch with the browser client so product counts stay live (ticket 09
  // will add Products; counts must reflect them without a redeploy).
  async function refresh() {
    const supabase = createClient();
    setCategories(await listCategoriesWithCounts(supabase));
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy !== null || inFlightRef.current || !draft.trim()) return;
    inFlightRef.current = true;
    setBusy("create");
    try {
      const result = await createCategoryAction(draft);
      if (result.ok) {
        setDraft("");
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
        showToast("Category renamed", "success");
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
        showToast("Category deleted", "success");
        await refresh();
      } else {
        showToast(result.message, "error");
      }
    } finally {
      inFlightRef.current = false;
      setBusy(null);
      setConfirming(null);
    }
  }

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="flex flex-col gap-6">
      {/* Create */}
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="New category name…"
          aria-label="New category name"
          className="sm:max-w-xs"
        />
        <Button
          type="submit"
          disabled={busy !== null || !draft.trim()}
          className="w-full sm:w-auto"
        >
          {busy === "create" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderPlus className="h-4 w-4" />
          )}
          Add category
        </Button>
      </form>

      {/* List */}
      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No categories yet — create the first one above.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {confirming === category.id ? (
                /* Confirm delete */
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm">
                    Delete <span className="font-semibold">{category.name}</span>?
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy !== null}
                    onClick={() => handleDelete(category.id)}
                  >
                    {busy === category.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : renaming?.id === category.id ? (
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
              {confirming !== category.id && renaming?.id !== category.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming({ id: category.id, name: category.name });
                      setConfirming(null);
                    }}
                    aria-label={`Rename ${category.name}`}
                    className={iconButton}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(category.id);
                      setRenaming(null);
                    }}
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
