import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentMethod } from "@/features/checkout/lib/checkout";

/**
 * Admin order management (ticket 10). Reads come from the database read model
 * (ADR-0012): the `order_summaries` and `order_details` views (migration
 * 20260808000002) join Orders with Customers and line items in SQL, so this
 * module only shapes the query and maps the view columns. The views are
 * `security_invoker`, so reads run with the signed-in Admin's session and the
 * RLS admin policies apply (ADR-0004).
 *
 * Status changes go through the `transition_order_status` Postgres function —
 * the same single-seam shape as `placeOrder` (ticket 06) — which enforces the
 * lifecycle and restores stock on cancel inside one transaction (ADR-0002).
 * This module only shapes the RPC call and maps the response; the trust
 * boundary lives in the function.
 *
 * Lifecycle: pending → confirmed → preparing → shipped → completed, with
 * `cancelled` as an alternative terminal state reachable from any state
 * except completed. The UI only ever offers legal moves (`nextTransitions`);
 * the function re-checks them as the authoritative guard.
 */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  shipped: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  ewallet: "E-wallet",
  bank_transfer: "Bank transfer",
};

const LIFECYCLE: Exclude<OrderStatus, "cancelled">[] = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "completed",
];

/**
 * Whether a move from `from` to `to` is legal: either the next lifecycle step
 * or a cancel from any non-terminal state. Mirrors the SQL guard in
 * `transition_order_status`.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (from === "completed" || from === "cancelled") return false;
  if (to === "cancelled") return true;
  const fromIndex = LIFECYCLE.indexOf(from as (typeof LIFECYCLE)[number]);
  const toIndex = LIFECYCLE.indexOf(to as (typeof LIFECYCLE)[number]);
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

/** The legal next statuses for a row, in display order (next step, then cancel). */
export function nextTransitions(from: OrderStatus): OrderStatus[] {
  const moves: OrderStatus[] = [];
  const fromIndex = LIFECYCLE.indexOf(from as (typeof LIFECYCLE)[number]);
  if (fromIndex >= 0 && fromIndex < LIFECYCLE.length - 1) {
    moves.push(LIFECYCLE[fromIndex + 1]);
  }
  if (from !== "completed" && from !== "cancelled") moves.push("cancelled");
  return moves;
}

export type OrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  /** Total quantity of items on the order. */
  itemsCount: number;
  customerName: string;
  customerEmail: string;
};

/** Columns of the `order_summaries` view (ADR-0012). */
type OrderSummaryRow = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  items_count: number;
};

/**
 * Orders newest first, filtered by status and/or a search term that matches
 * order number, customer name, or customer email. The join with Customers and
 * the item count live in the `order_summaries` view; the search term is
 * applied here over the (small) result set.
 */
export async function listOrders(
  client: SupabaseClient,
  params: { status?: OrderStatus; q?: string } = {},
): Promise<OrderListItem[]> {
  let query = client
    .from("order_summaries")
    .select("*")
    .order("created_at", { ascending: false });
  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;
  if (error) return [];

  const q = params.q?.trim().toLowerCase();
  const rows = ((data ?? []) as OrderSummaryRow[]).filter((row) => {
    if (!q) return true;
    return (
      row.order_number.toLowerCase().includes(q) ||
      (row.customer_name?.toLowerCase().includes(q) ?? false) ||
      (row.customer_email?.toLowerCase().includes(q) ?? false)
    );
  });

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status as OrderStatus,
    totalAmount: Number(row.total_amount),
    createdAt: row.created_at,
    itemsCount: Number(row.items_count) || 0,
    customerName: row.customer_name ?? "Unknown customer",
    customerEmail: row.customer_email ?? "",
  }));
}

export type OrderItemDetail = {
  id: string;
  productId: string | null;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  /** Price snapshot at purchase time (ADR-0003). */
  unitPrice: number;
  lineTotal: number;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  customer: { fullName: string; email: string; contactNumber: string };
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
  items: OrderItemDetail[];
};

/** Columns of the `order_details` view (ADR-0012) — items is a jsonb array. */
type OrderDetailRow = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  delivery_address: string;
  payment_method: string;
  customer_name: string;
  customer_email: string;
  customer_contact_number: string;
  items: {
    id: string;
    product_id: string | null;
    product_name: string;
    image_url: string | null;
    quantity: number;
    unit_price: number;
  }[];
};

/**
 * One Order with its Customer and line items, from the `order_details` view
 * (the join and the "Deleted product" label for removed Products live in SQL,
 * ADR-0012). Returns null when the order no longer exists.
 */
export async function getOrderDetail(
  client: SupabaseClient,
  orderId: string,
): Promise<OrderDetail | null> {
  const { data, error } = await client
    .from("order_details")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as OrderDetailRow;
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status as OrderStatus,
    totalAmount: Number(row.total_amount),
    notes: row.notes,
    createdAt: row.created_at,
    customer: {
      fullName: row.customer_name,
      email: row.customer_email,
      contactNumber: row.customer_contact_number,
    },
    deliveryAddress: row.delivery_address,
    paymentMethod: row.payment_method as PaymentMethod,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      imageUrl: item.image_url,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.unit_price) * item.quantity,
    })),
  };
}

export type TransitionResult = { ok: true } | { ok: false; message: string };

/**
 * Moves an Order through the lifecycle via the `transition_order_status`
 * function (authoritative guard + atomic stock restore on cancel). The UI
 * offers only legal moves; the function re-checks them server-side.
 */
export async function transitionOrderStatus(
  client: SupabaseClient,
  orderId: string,
  newStatus: OrderStatus,
): Promise<TransitionResult> {
  const { data, error } = await client.rpc("transition_order_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const result = data as { ok?: boolean; message?: string } | null;
  if (!result || result.ok !== true) {
    return {
      ok: false,
      message: result?.message ?? "Could not update the order status.",
    };
  }
  return { ok: true };
}

/**
 * Spreadsheet-compatible CSV (RFC 4180 quoting + a UTF-8 BOM for Excel) of
 * the current order list view. Exported for direct reuse by the download.
 */
export function ordersToCsv(rows: OrderListItem[]): string {
  const header = [
    "Order number",
    "Status",
    "Customer",
    "Email",
    "Items",
    "Total",
    "Placed at",
  ];
  const lines = rows.map((row) => [
    row.orderNumber,
    ORDER_STATUS_LABELS[row.status],
    row.customerName,
    row.customerEmail,
    String(row.itemsCount),
    row.totalAmount.toFixed(2),
    row.createdAt,
  ]);
  return (
    "\uFEFF" +
    [header, ...lines]
      .map((cells) => cells.map(csvCell).join(","))
      .join("\r\n")
  );
}

function csvCell(value: string): string {
  if (/[\",\r\n]/.test(value)) {
    return `"${value.replace(/\"/g, "\"\"")}"`;
  }
  return value;
}
