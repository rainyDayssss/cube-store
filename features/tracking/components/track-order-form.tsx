"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Download, Package, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trackOrder, type OrderTrackingResult, ORDER_STATUS_LABELS } from "@/features/tracking/lib/tracking";
import { OrderStatusBar } from "@/features/tracking/components/order-status-bar";
import { downloadReceipt } from "@/features/tracking/lib/download-receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentMethod } from "@/features/checkout/lib/checkout";

const STORAGE_KEY = "cube-store-tracking";

const priceFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

function loadSaved(): { orderNumber: string; email: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { orderNumber: string; email: string };
  } catch {
    return null;
  }
}

function saveTracking(orderNumber: string, email: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ orderNumber, email }));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function TrackOrderForm() {
  const saved = useRef(loadSaved());
  const [orderNumber, setOrderNumber] = useState(saved.current?.orderNumber ?? "");
  const [email, setEmail] = useState(saved.current?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrderTrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  // Auto-submit if we have saved credentials
  useEffect(() => {
    if (saved.current?.orderNumber && saved.current?.email && !result && !loading) {
      // Trigger submit on mount with saved values
      handleSubmitDirect(saved.current.orderNumber, saved.current.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime subscription: re-fetch when order status changes
  useEffect(() => {
    if (!result) return;

    const supabase = createClient();
    const channel = supabase
      .channel("order-tracking")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `order_number=eq.${result.orderNumber}`,
        },
        async () => {
          // Re-fetch the order data
          const freshData = await trackOrder(supabase, orderNumber, email);
          if (freshData && freshData.status !== result.status) {
            setResult(freshData);
            setUpdated(true);
            setTimeout(() => setUpdated(false), 3000);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [result, orderNumber, email]);

  async function handleSubmitDirect(orderNum: string, emailAddr: string) {
    setLoading(true);
    setError(null);
    setResult(null);

    const supabase = createClient();
    const data = await trackOrder(supabase, orderNum, emailAddr);

    if (!data) {
      setError(
        "No order found with those details. Please check your order number and email. " +
          "Make sure you're entering the full order number (e.g., ORD-20260810-0001). " +
          "If you just placed your order, it may take a moment to appear.",
      );
    } else {
      setResult(data);
      saveTracking(orderNum, emailAddr);
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleSubmitDirect(orderNumber, email);
  }

  async function handleDownloadReceipt() {
    if (!result) return;
    try {
      await downloadReceipt({
        orderNumber: result.orderNumber,
        totalAmount: result.totalAmount,
        paymentMethod: result.paymentMethod,
        deliveryAddress: result.deliveryAddress,
        customerName: result.customerName,
        createdAt: result.createdAt,
        items: result.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
    } catch {
      setError("Could not generate receipt. Please try again.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Order number (e.g., ORD-20260810-0001)"
              aria-label="Order number"
              className="pl-9"
            />
          </div>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email used at checkout"
            aria-label="Email address"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !orderNumber.trim() || !email.trim()}
          className="w-full sm:w-auto"
        >
          {loading ? "Searching…" : "Track order"}
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-6">
          {/* Status update notification */}
          {updated && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
              <RefreshCw className="mr-2 inline-block h-4 w-4 animate-spin" />
              Order status updated!
            </div>
          )}

          {/* Status Bar */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h2 className="mb-1 font-display text-lg font-bold tracking-tight">
              {result.orderNumber}
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Status:{" "}
              <span className="font-medium text-foreground">
                {ORDER_STATUS_LABELS[result.status]}
              </span>
            </p>
            <OrderStatusBar status={result.status} />
          </div>

          {/* Order Summary */}
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Order summary
            </h3>
            <ul className="divide-y divide-border">
              {result.items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 py-3 first:pt-0 last:pb-0 sm:gap-3"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:h-12 sm:w-12">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {priceFormatter.format(item.unitPrice)} &times;{" "}
                      {item.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {priceFormatter.format(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm font-semibold sm:text-base">
              <span>Total</span>
              <span className="tabular-nums">
                {priceFormatter.format(result.totalAmount)}
              </span>
            </div>

            <Button
              onClick={handleDownloadReceipt}
              variant="outline"
              className="mt-4 w-full"
            >
              <Download className="h-4 w-4" />
              Download receipt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
