import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentMethod } from "@/features/checkout/lib/checkout";

/**
 * Admin order management (ticket 10). Reads run with the signed-in Admin's
 * session (RLS admin policies, ADR-0004). Status changes go through the
 * `transition_order_status` Postgres function — the same single-seam shape as
 * `placeOrder` (ticket 06) — which enforces the lifecycle and restores stock
 * on cancel inside one transaction (ADR-0002). This module only shapes the
 * RPC call and maps the response; the trust boundary lives in the function.
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

type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  delivery_address: string;
  payment_method: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
};

/**
 * Orders newest first, filtered by status and/or a search term that matches
 * order number, customer name, or customer email. Customers and item counts
 * are merged client-side from parallel queries (PostgREST has no joins).
 */
export async function listOrders(
  client: SupabaseClient,
  params: { status?: OrderStatus; q?: string } = {},
): Promise<OrderListItem[]> {
  let query = client
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (params.status) {
    query = query.eq("status", params.status);
  }

  const [ordersResult, customersResult, itemsResult] = await Promise.all([
    query,
    client.from("customers").select("id, full_name, email"),
    client.from("order_items").select("order_id, quantity"),
  ]);
  if (ordersResult.error || customersResult.error || itemsResult.error) return [];

  const customers = new Map(
    (
      (customersResult.data ?? []) as {
        id: string;
        full_name: string;
        email: string;
      }[]
    ).map((customer) => [customer.id, customer]),
  );

  const itemCounts = new Map<string, number>();
  for (const item of (itemsResult.data ?? []) as {
    order_id: string;
    quantity: number;
  }[]) {
    itemCounts.set(item.order_id, (itemCounts.get(item.order_id) ?? 0) + item.quantity);
  }

  const q = params.q?.trim().toLowerCase();
  const rows = ((ordersResult.data ?? []) as OrderRow[]).filter((row) => {
    if (!q) return true;
    const customer = customers.get(row.customer_id);
    return (
      row.order_number.toLowerCase().includes(q) ||
      (customer?.full_name.toLowerCase().includes(q) ?? false) ||
      (customer?.email.toLowerCase().includes(q) ?? false)
    );
  });

  return rows.map((row) => {
    const customer = customers.get(row.customer_id);
    return {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status as OrderStatus,
      totalAmount: Number(row.total_amount),
      createdAt: row.created_at,
      itemsCount: itemCounts.get(row.id) ?? 0,
      customerName: customer?.full_name ?? "Unknown customer",
      customerEmail: customer?.email ?? "",
    };
  });
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

/**
 * One Order with its Customer and line items (product names/images joined
 * client-side). Returns null when the order no longer exists.
 */
export async function getOrderDetail(
  client: SupabaseClient,
  orderId: string,
): Promise<OrderDetail | null> {
  const orderResult = await client
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (orderResult.error || !orderResult.data) return null;
  const order = orderResult.data as OrderRow;

  const [customerResult, itemsResult, productsResult] = await Promise.all([
    client.from("customers").select("*").eq("id", order.customer_id).maybeSingle(),
    client
      .from("order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at"),
    client.from("products").select("id, name, image_url"),
  ]);
  if (customerResult.error || !customerResult.data) return null;

  const productNames = new Map(
    (
      (productsResult.data ?? []) as { id: string; name: string; image_url: string }[]
    ).map((product) => [product.id, product]),
  );

  const items: OrderItemDetail[] = ((itemsResult.data ?? []) as {
    id: string;
    product_id: string | null;
    quantity: number;
    unit_price: number;
  }[]).map((item) => {
    const product = item.product_id ? productNames.get(item.product_id) : undefined;
    return {
      id: item.id,
      productId: item.product_id,
      productName: product?.name ?? "Deleted product",
      imageUrl: product?.image_url ?? null,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.unit_price) * item.quantity,
    };
  });

  const customer = customerResult.data as {
    full_name: string;
    email: string;
    contact_number: string;
  };

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status as OrderStatus,
    totalAmount: Number(order.total_amount),
    notes: order.notes,
    createdAt: order.created_at,
    customer: {
      fullName: customer.full_name,
      email: customer.email,
      contactNumber: customer.contact_number,
    },
    deliveryAddress: order.delivery_address,
    paymentMethod: order.payment_method as PaymentMethod,
    items,
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
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
