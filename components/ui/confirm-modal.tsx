"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ConfirmModalProps = {
  title: string;
  message: string;
  warning?: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  confirmIcon?: LucideIcon;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  title,
  message,
  warning,
  confirmLabel,
  confirmVariant = "default",
  confirmIcon: ConfirmIcon,
  busy,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 h-full w-full bg-black/50 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-2xl outline-none"
      >
        <div className="px-6 pt-6">
          <h2 id="confirm-modal-title" className="text-lg font-bold tracking-tight">
            {title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          {warning && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : ConfirmIcon ? (
              <ConfirmIcon className="h-4 w-4" />
            ) : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
