import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin dashboard aggregates (ticket 07). Runs with the signed-in Admin's
 * session, so the order/customer reads are permitted by the RLS admin
 * policies (schema, ADR-0004). Sales and customer totals exclude cancelled
 * Orders — a cancelled Order is undone (ADR-0002).
 */

export type AdminKpis = {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalCustomers: number;
  /** Sum of order totals, excluding cancelled Orders. */
  totalSales: number;
};

type CountResult = { count: number | null; error: unknown };

function countOf(result: CountResult): number {
  return result.error ? 0 : (result.count ?? 0);
}

export async function getAdminKpis(client: SupabaseClient): Promise<AdminKpis> {
  // Run the six aggregates in parallel — each is a single cheap count/sum.
  // `head: true` asks PostgREST for the count only (no row bodies).
  const [products, orders, pending, completed, customers, salesRows] =
    await Promise.all([
      client.from("products").select("id", { count: "exact", head: true }),
      client.from("orders").select("id", { count: "exact", head: true }),
      client.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      client.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed"),
      client.from("customers").select("id", { count: "exact", head: true }),
      // Total sales = every order's snapshot total except cancelled ones.
      client.from("orders").select("total_amount").neq("status", "cancelled"),
    ]);

  const totalSales =
    (salesRows.data as { total_amount: number }[] | null)?.reduce(
      (sum, row) => sum + (Number(row.total_amount) || 0),
      0,
    ) ?? 0;

  return {
    totalProducts: countOf(products),
    totalOrders: countOf(orders),
    pendingOrders: countOf(pending),
    completedOrders: countOf(completed),
    totalCustomers: countOf(customers),
    totalSales,
  };
}
