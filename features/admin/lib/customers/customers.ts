import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/features/admin/lib/orders/orders";

/**
 * Admin customer management (ticket 11). Reads run with the signed-in Admin's
 * session (RLS admin policies, ADR-0004). Order count and total purchase are
 * computed at query time by the `customer_summaries` view (ADR-0012) — never
 * stored — so they always reflect the live data as Orders are placed and
 * cancelled. Per the ticket, cancelled Orders are excluded from BOTH the
 * count and the total; that rule lives in the view, in one place.
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

export const CUSTOMER_SORTS = ["name", "newest", "orders-asc", "orders-desc", "spent-asc", "spent-desc"] as const;

export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  name: "Name",
  newest: "Newest customer",
  "orders-asc": "Orders: Low to High",
  "orders-desc": "Orders: High to Low",
  "spent-asc": "Spent: Low to High",
  "spent-desc": "Spent: High to Low",
};

/** Columns of the `customer_summaries` view (ADR-0012). */
type CustomerSummaryRow = {
  id: string;
  full_name: string;
  email: string;
  contact_number: string;
  account_status: string;
  created_at: string;
  order_count: number;
  total_spent: number;
};

/**
 * Every Customer with live aggregates from the `customer_summaries` view,
 * filtered by name/email search and sorted. The search and sort are
 * presentation concerns and stay here over the (small) result set; the
 * aggregation — including the cancelled-exclusion rule — lives in SQL.
 */
export async function listCustomers(
  client: SupabaseClient,
  params: { q?: string; sort?: CustomerSort } = {},
): Promise<CustomerSummary[]> {
  const { data, error } = await client.from("customer_summaries").select("*");
  if (error) return [];

  const q = params.q?.trim().toLowerCase();
  const rows = ((data ?? []) as CustomerSummaryRow[]).filter((customer) => {
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
    orderCount: Number(customer.order_count) || 0,
    totalSpent: Number(customer.total_spent) || 0,
  }));

  const byName = (a: CustomerSummary, b: CustomerSummary) =>
    a.fullName.localeCompare(b.fullName);

  switch (params.sort ?? "name") {
    case "newest":
      return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "orders-asc":
      return summaries.sort((a, b) => a.orderCount - b.orderCount || byName(a, b));
    case "orders-desc":
      return summaries.sort((a, b) => b.orderCount - a.orderCount || byName(a, b));
    case "spent-asc":
      return summaries.sort((a, b) => a.totalSpent - b.totalSpent || byName(a, b));
    case "spent-desc":
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
 * One Customer with their Order history. The summary aggregates come from the
 * `customer_summaries` view (same cancelled-exclusion rule); `orders` is a
 * direct query and includes cancelled rows so the full history is visible
 * (each carries its status badge). Returns null when the Customer no longer
 * exists.
 */
export async function getCustomerDetail(
  client: SupabaseClient,
  customerId: string,
): Promise<CustomerDetail | null> {
  const [summaryResult, ordersResult] = await Promise.all([
    client
      .from("customer_summaries")
      .select("*")
      .eq("id", customerId)
      .maybeSingle(),
    client
      .from("orders")
      .select("id, order_number, status, total_amount, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);
  if (summaryResult.error || !summaryResult.data) return null;

  const summary = summaryResult.data as CustomerSummaryRow;
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

  return {
    id: summary.id,
    fullName: summary.full_name,
    email: summary.email,
    contactNumber: summary.contact_number,
    accountStatus: summary.account_status,
    createdAt: summary.created_at,
    orderCount: Number(summary.order_count) || 0,
    totalSpent: Number(summary.total_spent) || 0,
    orders,
  };
}
