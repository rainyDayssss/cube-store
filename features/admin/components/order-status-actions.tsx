"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, Loader2 } from "lucide-react";
import {
  nextTransitions,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/features/admin/lib/orders/orders";
import { transitionOrderStatusAction } from "@/features/admin/actions/orders";
import { Button } from "@/components/ui/button";
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
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous guard: `busy` state applies on the next render, so a rapid
  // double-click could otherwise fire two transitions and let a slower
  // earlier response overwrite a newer one.
  const inFlightRef = useRef(false);

  // Clear the toast timer on unmount so a pending dismissal can't fire on a
  // dead component.
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

  const moves = nextTransitions(status);
  const nextStep = moves.find((move) => move !== "cancelled");
  const canCancel = moves.includes("cancelled");

  async function handleTransition(target: OrderStatus) {
    if (inFlightRef.current) return;
    const message =
      target === "cancelled"
        ? `${orderNumber} cancelled — stock restored`
        : `${orderNumber} moved to ${ORDER_STATUS_LABELS[target]}`;
    inFlightRef.current = true;
    setBusy(true);
    try {
      const result = await transitionOrderStatusAction(orderId, target);
      if (result.ok) {
        showToast(message, "success");
        // Close the prompt and re-run the server page so the status badge and
        // view reflect the move — success only.
        setConfirming(false);
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
      {confirming && canCancel ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            Cancel <span className="font-semibold">{orderNumber}</span>? Stock
            is restored automatically.
          </span>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => void handleTransition("cancelled")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Yes, cancel
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
            Keep order
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {nextStep && (
            <Button size="sm" disabled={busy} onClick={() => void handleTransition(nextStep)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Mark {ORDER_STATUS_LABELS[nextStep].toLowerCase()}
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Ban className="h-4 w-4" />
              Cancel order
            </Button>
          )}
          {moves.length === 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              {status === "cancelled"
                ? "This order is cancelled and cannot be changed."
                : "This order is completed and cannot be changed."}
            </span>
          )}
        </div>
      )}

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
