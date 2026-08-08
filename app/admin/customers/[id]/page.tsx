import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, ShoppingBag, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCustomerDetail } from "@/features/admin/lib/customers/customers";
import { OrderStatusBadge } from "@/features/admin/components/order-status-badge";

export const metadata: Metadata = {
  title: "Customer — Cube Store Admin",
  description: "Customer details and order history.",
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
});

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const customer = await getCustomerDetail(supabase, id);

  if (!customer) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10">
        <h1 className="text-xl font-semibold">Customer not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been removed, or the link is out of date.
        </p>
        <Link
          href="/admin/customers"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          ← Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/customers"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Customers
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {customer.fullName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Customer since {dateFormatter.format(new Date(customer.createdAt))}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-5">
          <ShoppingBag className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-2xl font-bold tabular-nums leading-none">
              {customer.orderCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Orders (excluding cancelled)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-5">
          <Wallet className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-2xl font-bold tabular-nums leading-none">
              {priceFormatter.format(customer.totalSpent)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total spent (excluding cancelled)
            </p>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 text-sm sm:flex-row sm:items-center sm:gap-8">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4 shrink-0" />
          {customer.email}
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-4 w-4 shrink-0" />
          {customer.contactNumber}
        </p>
      </div>

      {/* Order history */}
      <section className="overflow-hidden rounded-xl border border-border bg-background">
        <h2 className="border-b border-border px-5 py-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Order history ({customer.orders.length})
        </h2>
        {customer.orders.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Placed</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customer.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {dateFormatter.format(new Date(order.createdAt))}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {priceFormatter.format(order.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Cancelled orders appear here for the full history but don&apos;t count
          toward the totals above.
        </p>
      </section>
    </div>
  );
}
