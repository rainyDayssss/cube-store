"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Ban, Download, Loader2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listOrders,
  nextTransitions,
  ordersToCsv,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_METHOD_LABELS,
  type OrderListItem,
  type OrderStatus,
} from "@/features/admin/lib/orders/orders";
import { transitionOrderStatusAction } from "@/features/admin/actions/orders";
import { OrderStatusBadge } from "@/features/admin/components/order-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

type Toast = {
  message: string;
  tone: "success" | "error";
  id: number;
};

export function OrdersManager({
  initialOrders,
  initialStatus,
}: {
  initialOrders: OrderListItem[];
  initialStatus?: OrderStatus;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">(
    initialStatus ?? "all",
  );
  const [searchDraft, setSearchDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous guard: `busyId` state applies on the next render, so a rapid
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

  // Live updates (ADR-0011): a Realtime-triggered router.refresh() hands down
  // fresh props — follow them so new orders and status moves appear without a
  // reload. Status chips and search filter over this list in memory, so the
  // Admin's current view survives the re-sync.
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  function showToast(message: string, tone: Toast["tone"]) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Re-fetch with the browser client so statuses stay live after a move.
  async function refresh() {
    const supabase = createClient();
    setOrders(await listOrders(supabase));
  }

  const filtered = useMemo(() => {
    const q = searchDraft.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.customerEmail.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, searchDraft]);

  async function handleTransition(order: OrderListItem, next: OrderStatus) {
    if (inFlightRef.current) return;
    const message =
      next === "cancelled"
        ? `Order ${order.orderNumber} cancelled. Stock restored.`
        : `Order ${order.orderNumber} is now ${ORDER_STATUS_LABELS[next]}`;
    inFlightRef.current = true;
    setBusyId(order.id);
    try {
      const result = await transitionOrderStatusAction(order.id, next);
      if (result.ok) {
        showToast(message, "success");
        await refresh();
      } else {
        showToast(result.message, "error");
      }
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
      setConfirming(null);
    }
  }

  function handleExport() {
    const blob = new Blob([ordersToCsv(filtered)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cube-store-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const chipCount = (status: OrderStatus | "all") =>
    status === "all"
      ? orders.length
      : orders.filter((order) => order.status === status).length;

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
            placeholder="Search by order number, customer…"
            aria-label="Search orders"
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="w-full sm:w-auto"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Status filter chips — horizontal scroll on narrow screens */}
      <div
        aria-label="Filter orders by status"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {(["all", ...ORDER_STATUSES] as (OrderStatus | "all")[]).map((status) => {
          const active = statusFilter === status;
          const count = chipCount(status);
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {status === "all" ? "All" : ORDER_STATUS_LABELS[status]}
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  active ? "text-primary-foreground/70" : "text-muted-foreground/70",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {orders.length === 0
            ? "No orders yet — they'll appear here as customers check out."
            : "No orders match this view. Try a different status or search."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-background">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((order) => {
                const moves = nextTransitions(order.status);
                const nextStep = moves.find((move) => move !== "cancelled");
                const canCancel = moves.includes("cancelled");
                return (
                  <tr key={order.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {dateFormatter.format(new Date(order.createdAt))}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate font-medium">{order.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.customerEmail}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {order.itemsCount}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {priceFormatter.format(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      {confirming === order.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busyId !== null}
                            onClick={() => void handleTransition(order, "cancelled")}
                          >
                            {busyId === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Ban className="h-4 w-4" />
                            )}
                            Cancel order
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId !== null}
                            onClick={() => setConfirming(null)}
                          >
                            Keep
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {nextStep && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId !== null}
                              onClick={() => void handleTransition(order, nextStep)}
                            >
                              {busyId === order.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowRight className="h-3.5 w-3.5" />
                              )}
                              {ORDER_STATUS_LABELS[nextStep]}
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId !== null}
                              onClick={() => setConfirming(order.id)}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          )}
                          {moves.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
