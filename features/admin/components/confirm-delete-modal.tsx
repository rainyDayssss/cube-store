"use client";

import { Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function ConfirmDeleteModal({
  title,
  message,
  warning,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  warning?: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmModal
      title={title}
      message={message}
      warning={warning}
      confirmLabel="Delete"
      confirmVariant="destructive"
      confirmIcon={Trash2}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
