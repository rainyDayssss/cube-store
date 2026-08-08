import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/features/admin/lib/orders/orders";

/**
 * Admin customer management (ticket 11). Reads run with the signed-in Admin's
 * session (RLS admin policies, ADR-0004). Order count and total purchase are
 * computed at query time from a relational join — never stored — so they
 * always reflect the live data as Orders are placed and cancelled. Per the
 * ticket, cancelled Orders are excluded from BOTH the count and the total.
 */

export type CustomerSummary = {
  id: string;
  fullName: string;
  email: string;
  contactNumber: string;
  accountStatus: string;
  createdAt: string;
  /** Non-cancelled Orders (ticket: counts reflect the same exclusion rule). */
  orderCount: number;
  /** Sum of non-cancelled Order totals, in purchase-time currency. */
  totalSpent: number;
};

export const CUSTOMER_SORTS = ["name", "newest", "orders", "spent"] as const;

export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  name: "Name",
  newest: "Newest customer",
  orders: "Most orders",
  spent: "Most spent",
};

type CustomerRow = {
  id: string;
  full_name: string;
  email: string;
  contact_number: string;
  account_status: string;
  created_at: string;
};

type OrderAggRow = {
  customer_id: string;
  status: string;
  total_amount: number;
  created_at: string;
};

/**
 * Every Customer with live aggregates, filtered by name/email search and
 * sorted. Aggregates exclude cancelled Orders (both count and total).
 */
export async function listCustomers(
  client: SupabaseClient,
  params: { q?: string; sort?: CustomerSort } = {},
): Promise<CustomerSummary[]> {
  const [customersResult, ordersResult] = await Promise.all([
    client.from("customers").select("*"),
    client.from("orders").select("customer_id, status, total_amount, created_at"),
  ]);
  if (customersResult.error || ordersResult.error) return [];

  // Aggregate at query time — no stored counters (spec, Customer aggregates).
  const counts = new Map<string, number>();
  const spent = new Map<string, number>();
  for (const order of (ordersResult.data ?? []) as OrderAggRow[]) {
    if (order.status === "cancelled") continue;
    counts.set(order.customer_id, (counts.get(order.customer_id) ?? 0) + 1);
    spent.set(
      order.customer_id,
      (spent.get(order.customer_id) ?? 0) + Number(order.total_amount),
    );
  }

  const q = params.q?.trim().toLowerCase();
  const rows = ((customersResult.data ?? []) as CustomerRow[]).filter((customer) => {
    if (!q) return true;
    return (
      customer.full_name.toLowerCase().includes(q) ||
      customer.email.toLowerCase().includes(q)
    );
  });

  const summaries: CustomerSummary[] = rows.map((customer) => ({
    id: customer.id,
    fullName: customer.full_name,
    email: customer.email,
    contactNumber: customer.contact_number,
    accountStatus: customer.account_status,
    createdAt: customer.created_at,
    orderCount: counts.get(customer.id) ?? 0,
    totalSpent: spent.get(customer.id) ?? 0,
  }));

  const byName = (a: CustomerSummary, b: CustomerSummary) =>
    a.fullName.localeCompare(b.fullName);

  switch (params.sort ?? "name") {
    case "newest":
      return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "orders":
      return summaries.sort((a, b) => b.orderCount - a.orderCount || byName(a, b));
    case "spent":
      return summaries.sort((a, b) => b.totalSpent - a.totalSpent || byName(a, b));
    default:
      return summaries.sort(byName);
  }
}

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
};

export type CustomerDetail = CustomerSummary & {
  /** All Orders (including cancelled), newest first. */
  orders: CustomerOrder[];
};

/**
 * One Customer with their Order history. The summary aggregates follow the
 * same cancelled-exclusion rule; `orders` includes cancelled rows so the full
 * history is visible (each carries its status badge). Returns null when the
 * Customer no longer exists.
 */
export async function getCustomerDetail(
  client: SupabaseClient,
  customerId: string,
): Promise<CustomerDetail | null> {
  const [customerResult, ordersResult] = await Promise.all([
    client.from("customers").select("*").eq("id", customerId).maybeSingle(),
    client
      .from("orders")
      .select("id, order_number, status, total_amount, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);
  if (customerResult.error || !customerResult.data) return null;

  const customer = customerResult.data as CustomerRow;
  const orders = ((ordersResult.data ?? []) as {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    created_at: string;
  }[]).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status as OrderStatus,
    totalAmount: Number(order.total_amount),
    createdAt: order.created_at,
  }));

  const active = orders.filter((order) => order.status !== "cancelled");
  return {
    id: customer.id,
    fullName: customer.full_name,
    email: customer.email,
    contactNumber: customer.contact_number,
    accountStatus: customer.account_status,
    createdAt: customer.created_at,
    orderCount: active.length,
    totalSpent: active.reduce((sum, order) => sum + order.totalAmount, 0),
    orders,
  };
}
