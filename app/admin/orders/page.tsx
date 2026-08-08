import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  listOrders,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/features/admin/lib/orders/orders";
import { OrdersManager } from "@/features/admin/components/orders-manager";

export const metadata: Metadata = {
  title: "Orders — Cube Store Admin",
  description: "Manage orders: track fulfillment and export to CSV.",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = ORDER_STATUSES.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;

  // The manager fetches and filters client-side (status chips + search), so
  // the server hands over the full list; ?status= only sets the initial chip.
  const supabase = await createClient();
  const orders = await listOrders(supabase);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="mt-1 text-muted-foreground">
          Move orders through fulfillment, cancel to restore stock, and export
          the current view to CSV.
        </p>
      </div>

      <OrdersManager initialOrders={orders} initialStatus={activeStatus} />
    </div>
  );
}
