"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { Category, ProductStatus } from "@/features/catalog/lib/catalog";
import { validateImageFile } from "@/features/admin/lib/products/products";
import {
  createProductAction,
  updateProductAction,
} from "@/features/admin/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminProduct } from "@/features/admin/components/products-manager";

type FormState = {
  name: string;
  category_id: string;
  price: string;
  stock_quantity: string;
  status: ProductStatus;
  description: string;
};

export function ProductFormModal({
  mode,
  product,
  categories,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  product: AdminProduct | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => ({
    name: product?.name ?? "",
    category_id: product?.category_id ?? "",
    price: product ? String(product.price) : "",
    stock_quantity: product ? String(product.stock_quantity) : "",
    status: product?.status ?? "active",
    description: product?.description ?? "",
  }));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    product?.image_url ?? null,
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  // Tracks the preview blob URL so it is always revoked (never leaked).
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Revoke the preview blob URL exactly once, on unmount.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFileChange(selected: File | null) {
    setFile(selected);
    if (!selected) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreview(product?.image_url ?? null);
      setFileError(null);
      return;
    }
    const invalid = validateImageFile(selected);
    if (invalid) {
      setFileError(invalid);
      setPreview(product?.image_url ?? null);
      return;
    }
    setFileError(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(selected);
    previewUrlRef.current = url;
    setPreview(url);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || inFlightRef.current) return;

    // Client-side pass (the server re-validates everything).
    if (!form.name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (!form.price || Number(form.price) < 0) {
      setFormError("Enter a valid price.");
      return;
    }
    if (
      form.stock_quantity === "" ||
      !Number.isInteger(Number(form.stock_quantity)) ||
      Number(form.stock_quantity) < 0
    ) {
      setFormError("Enter a valid stock quantity.");
      return;
    }
    if (mode === "create" && !file) {
      setFileError("An image is required.");
      return;
    }

    const formData = new FormData();
    formData.set("name", form.name.trim());
    formData.set("description", form.description.trim());
    formData.set("price", String(Number(form.price)));
    formData.set("stock_quantity", String(Number(form.stock_quantity)));
    formData.set("status", form.status);
    formData.set("category_id", form.category_id);
    if (mode === "edit" && product) {
      formData.set("id", product.id);
    }
    if (file) formData.set("image", file);

    inFlightRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const result =
        mode === "create"
          ? await createProductAction(formData)
          : await updateProductAction(formData);
      if (result.ok) {
        onSaved(
          mode === "create"
            ? `"${result.product.name}" created`
            : `"${result.product.name}" saved`,
        );
        onClose();
      } else {
        setFormError(result.message);
      }
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/50 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        tabIndex={-1}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="product-form-title" className="text-lg font-bold tracking-tight">
            {mode === "create" ? "New product" : `Edit — ${product?.name}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {/* Image */}
            <div>
              <Label>Image</Label>
              <div className="mt-1.5 flex items-start gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin preview
                    <img src={preview} alt="Product preview" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <label className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="inline-flex h-9 w-fit items-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
                    {file ? "Change image…" : "Choose image…"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                  <span className="text-xs text-muted-foreground">
                    JPG, PNG, or WebP · max 5 MB
                  </span>
                </label>
              </div>
              {fileError && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                  {fileError}
                </p>
              )}
            </div>

            <Field label="Name" htmlFor="product-name">
              <Input
                id="product-name"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="Gan 356 M"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price (USD)" htmlFor="product-price">
                <Input
                  id="product-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(event) => set("price", event.target.value)}
                  placeholder="12.99"
                />
              </Field>
              <Field label="Stock quantity" htmlFor="product-stock">
                <Input
                  id="product-stock"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={form.stock_quantity}
                  onChange={(event) => set("stock_quantity", event.target.value)}
                  placeholder="50"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="product-category">
                <select
                  id="product-category"
                  value={form.category_id}
                  onChange={(event) => set("category_id", event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status" htmlFor="product-status">
                <select
                  id="product-status"
                  value={form.status}
                  onChange={(event) => set("status", event.target.value as ProductStatus)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="active">Active (visible)</option>
                  <option value="inactive">Inactive (hidden)</option>
                </select>
              </Field>
            </div>

            <Field label="Description" htmlFor="product-description">
              <textarea
                id="product-description"
                rows={3}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="What makes it worth the click?"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </Field>

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive"
              >
                {formError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create product" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
