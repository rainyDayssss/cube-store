import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Mail, Phone, StickyNote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrderDetail, PAYMENT_METHOD_LABELS } from "@/features/admin/lib/orders/orders";
import { OrderStatusActions } from "@/features/admin/components/order-status-actions";
import { OrderStatusBadge } from "@/features/admin/components/order-status-badge";

export const metadata: Metadata = {
  title: "Order — Cube Store Admin",
  description: "Order details and fulfillment actions.",
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeStyle: "short",
});

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; customerId?: string }>;
}) {
  const { id } = await params;
  const { from, customerId } = await searchParams;
  const supabase = await createClient();
  const order = await getOrderDetail(supabase, id);

  if (!order) {
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="rounded-xl border border-dashed border-border p-10">
          <h1 className="text-xl font-semibold">Order not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been removed, or the link is out of date.
          </p>
          <Link
            href={from === "customer" && customerId ? `/admin/customers/${customerId}` : "/admin/orders"}
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            ← {from === "customer" ? "Back to customer" : "Back to orders"}
          </Link>
        </div>
      </div>
    );
  }

  const lineTotal = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const backHref = from === "customer" && customerId ? `/admin/customers/${customerId}` : `/admin/orders?status=${order.status}`;
  const backLabel = from === "customer" ? "Back to customer" : "Orders";

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href={backHref}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← {backLabel}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {order.orderNumber}
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-1 text-muted-foreground">
              Placed {dateFormatter.format(new Date(order.createdAt))}
            </p>
          </div>
          <OrderStatusActions
            orderId={order.id}
            orderNumber={order.orderNumber}
            status={order.status}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: customer + delivery + payment */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <section className="rounded-xl border border-border bg-background p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Customer
            </h2>
            <p className="mt-3 font-medium">{order.customer.fullName}</p>
            <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                {order.customer.email}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                {order.customer.contactNumber}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-background p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Delivery
            </h2>
            <p className="mt-3 flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="whitespace-pre-line">{order.deliveryAddress}</span>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Payment:{" "}
              <span className="font-medium text-foreground">
                {PAYMENT_METHOD_LABELS[order.paymentMethod]}
              </span>
            </p>
            {order.notes && (
              <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-line">{order.notes}</span>
              </p>
            )}
          </section>
        </div>

        {/* Right: items + total */}
        <section className="rounded-xl border border-border bg-background lg:col-span-2">
          <h2 className="border-b border-border px-5 py-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Items
          </h2>
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-muted-foreground">
                      Deleted
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    ID: {item.productId ?? "N/A"} · {item.quantity} × {priceFormatter.format(item.unitPrice)}
                  </p>
                  {!item.imageUrl && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Product deleted — name and ID preserved from order snapshot
                    </p>
                  )}
                </div>
                <p className="shrink-0 tabular-nums font-medium">
                  {priceFormatter.format(item.lineTotal)}
                </p>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-5 py-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">
                {priceFormatter.format(lineTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span className="tabular-nums">
                {priceFormatter.format(order.totalAmount)}
              </span>
            </div>
          </div>
          {lineTotal !== order.totalAmount && (
            <p className="px-5 pb-4 text-xs text-muted-foreground">
              Line items sum to {priceFormatter.format(lineTotal)} — the order
              total is the snapshot taken at checkout (ADR-0003).
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
