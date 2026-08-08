import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin dashboard aggregates (ticket 07). All six numbers come from the
 * `get_admin_kpis` Postgres function in one round-trip (ADR-0012) — no more
 * downloading every order row just to sum it. The function is security
 * definer with an is_admin() guard and derives sales/customer totals in SQL,
 * excluding cancelled Orders (a cancelled Order is undone, ADR-0002).
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

const EMPTY_KPIS: AdminKpis = {
  totalProducts: 0,
  totalOrders: 0,
  pendingOrders: 0,
  completedOrders: 0,
  totalCustomers: 0,
  totalSales: 0,
};

/** The jsonb shape returned by `get_admin_kpis` (snake_case keys). */
type KpisRow = {
  total_products: number;
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_customers: number;
  total_sales: number;
};

export async function getAdminKpis(client: SupabaseClient): Promise<AdminKpis> {
  const { data, error } = await client.rpc("get_admin_kpis");

  // One RPC: a failure (network, unapplied migration, or a non-admin caller
  // refused by the function) fails the whole read soft — the dashboard shows
  // zeroes rather than erroring. A non-admin refusal is indistinguishable
  // here, but that path never renders in practice: AdminGate redirects
  // non-admins away from /admin before this is ever queried.
  if (error) return { ...EMPTY_KPIS };

  const result = data as
    | { ok?: boolean; kpis?: KpisRow | null }
    | null
    | undefined;
  if (!result || result.ok !== true || !result.kpis) {
    return { ...EMPTY_KPIS };
  }

  const k = result.kpis;
  return {
    totalProducts: Number(k.total_products) || 0,
    totalOrders: Number(k.total_orders) || 0,
    pendingOrders: Number(k.pending_orders) || 0,
    completedOrders: Number(k.completed_orders) || 0,
    totalCustomers: Number(k.total_customers) || 0,
    totalSales: Number(k.total_sales) || 0,
  };
}

export type ChartDataPoint = {
  month: string;
  orders: number;
  revenue: number;
};

/**
 * Chart data for the admin dashboard: order count and revenue per month for
 * the last 6 months. Queries the `orders` table directly, excluding
 * cancelled orders, and groups by `date_trunc('month', created_at)`.
 */
export async function getAdminChartData(
  client: SupabaseClient,
): Promise<ChartDataPoint[]> {
  const now = new Date();
  const months: ChartDataPoint[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
    months.push({ month: label, orders: 0, revenue: 0 });
  }

  const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startIso = startDate.toISOString();

  const { data, error } = await client
    .from("orders")
    .select("created_at, total_amount")
    .neq("status", "cancelled")
    .gte("created_at", startIso);

  if (error) return months;

  for (const row of data ?? []) {
    const d = new Date(row.created_at);
    const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
    const point = months.find((m) => m.month === key);
    if (point) {
      point.orders += 1;
      point.revenue += Number(row.total_amount);
    }
  }

  return months;
}
