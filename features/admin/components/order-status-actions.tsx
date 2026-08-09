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
import { cn } from "@/lib/utils";

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
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  function showToast(message: string, tone: "success" | "error") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

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
        showToast(message, "success");
        setStatusModal(null);
        router.refresh();
      } else {
        showToast(result.message, "error");
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      {!isTerminal && (() => {
        const fromIndex = LIFECYCLE.indexOf(status as (typeof LIFECYCLE)[number]);
        return (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                const newStatus = e.target.value as OrderStatus;
                if (newStatus) {
                  setStatusModal(newStatus);
                }
              }}
              disabled={busy}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Update order status"
            >
              <option value="">Update status</option>
              {fromIndex > 0 && (
                <option value={LIFECYCLE[fromIndex - 1]}>
                  {ORDER_STATUS_LABELS[LIFECYCLE[fromIndex - 1]]} (previous)
                </option>
              )}
              <option value="" disabled className="font-semibold">
                {ORDER_STATUS_LABELS[status]} (current)
              </option>
              {fromIndex < LIFECYCLE.length - 1 && (
                <option value={LIFECYCLE[fromIndex + 1]}>
                  {ORDER_STATUS_LABELS[LIFECYCLE[fromIndex + 1]]} (next)
                </option>
              )}
              <option value="cancelled">Cancel order</option>
            </select>
          </div>
        );
      })()}

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

      {toast && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm font-medium",
            toast.tone === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          )}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
