"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban } from "lucide-react";
import {
  availableTransitions,
  LIFECYCLE,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/features/admin/lib/orders/orders";
import { transitionOrderStatusAction } from "@/features/admin/actions/orders";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { StatusDropdown } from "@/components/ui/status-dropdown";
import { Toast } from "@/components/ui/toast";

export function OrderStatusActions({
  orderId,
  orderNumber,
  status,
}: {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [statusModal, setStatusModal] = useState<OrderStatus | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const inFlightRef = useRef(false);

  const moves = availableTransitions(status);
  const isTerminal = moves.length === 0;

  async function handleTransition(target: OrderStatus) {
    if (inFlightRef.current) return;
    const message =
      target === "cancelled"
        ? `Order ${orderNumber} cancelled. Stock restored.`
        : `Order ${orderNumber} is now ${ORDER_STATUS_LABELS[target]}`;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const result = await transitionOrderStatusAction(orderId, target);
      if (result.ok) {
        setToast({ message, tone: "success" });
        setStatusModal(null);
        router.refresh();
      } else {
        setToast({ message: result.message, tone: "error" });
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  const fromIndex = LIFECYCLE.indexOf(status as (typeof LIFECYCLE)[number]);

  // Build status options for the dropdown (same pattern as orders manager)
  const statusOptions: { value: string; label: string; hint?: string; disabled?: boolean }[] = [];
  if (fromIndex > 0) {
    statusOptions.push({
      value: LIFECYCLE[fromIndex - 1],
      label: ORDER_STATUS_LABELS[LIFECYCLE[fromIndex - 1]],
      hint: "previous",
    });
  }
  statusOptions.push({
    value: status,
    label: ORDER_STATUS_LABELS[status],
    hint: "current",
    disabled: true,
  });
  if (fromIndex < LIFECYCLE.length - 1) {
    statusOptions.push({
      value: LIFECYCLE[fromIndex + 1],
      label: ORDER_STATUS_LABELS[LIFECYCLE[fromIndex + 1]],
      hint: "next",
    });
  }
  statusOptions.push({
    value: "cancelled",
    label: "Cancel order",
  });

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      {!isTerminal && (
        <StatusDropdown
          label="Update status"
          options={statusOptions}
          busy={busy}
          onSelect={(v) => setStatusModal(v as OrderStatus)}
        />
      )}

      {isTerminal && (
        <span className="text-xs font-medium text-muted-foreground">
          {status === "cancelled"
            ? "This order is cancelled and cannot be changed."
            : "This order is completed and cannot be changed."}
        </span>
      )}

      {/* Status change confirmation modal */}
      {statusModal && (() => {
        const isCancel = statusModal === "cancelled";
        return (
          <ConfirmModal
            title={isCancel ? "Cancel order?" : "Update order status?"}
            message={isCancel
              ? `Are you sure you want to cancel order ${orderNumber}?`
              : `Change order ${orderNumber} from "${ORDER_STATUS_LABELS[status]}" to "${ORDER_STATUS_LABELS[statusModal]}"?`}
            warning={isCancel ? "Stock will be restored automatically." : undefined}
            confirmLabel={isCancel ? "Cancel order" : "Update status"}
            confirmVariant={isCancel ? "destructive" : "default"}
            confirmIcon={isCancel ? Ban : ArrowRight}
            busy={busy}
            onConfirm={() => void handleTransition(statusModal)}
            onCancel={() => setStatusModal(null)}
          />
        );
      })()}

      {/* Toast notification */}
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
