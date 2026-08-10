import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentMethod } from "@/features/checkout/lib/checkout";

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

export const LIFECYCLE: Exclude<OrderStatus, "cancelled">[] = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "completed",
];

export type TrackingItem = {
  productName: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
};

export type OrderTrackingResult = {
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  deliveryAddress: string;
  createdAt: string;
  customerName: string;
  items: TrackingItem[];
};

type TrackOrderRow = {
  order_number: string;
  status: string;
  total_amount: number;
  payment_method: string;
  delivery_address: string;
  created_at: string;
  customer_name: string;
  items: {
    product_name: string;
    image_url: string | null;
    quantity: number;
    unit_price: number;
  }[] | null;
};

/**
 * Order tracking (ticket 14): looks up an order by number via the
 * `track_order` SECURITY DEFINER function. No auth required — the order
 * number is the only key. Returns null when no order matches.
 */
export async function trackOrder(
  client: SupabaseClient,
  orderNumber: string,
  email: string,
): Promise<OrderTrackingResult | null> {
  const trimmedOrder = orderNumber.trim();
  const trimmedEmail = email.trim();
  if (!trimmedOrder || !trimmedEmail) return null;

  const { data, error } = await client.rpc("track_order", {
    p_order_number: trimmedOrder,
    p_email: trimmedEmail,
  });

  if (error || !data) return null;

  const row = data as TrackOrderRow | null;
  if (!row || !row.order_number) return null;

  return {
    orderNumber: row.order_number,
    status: row.status as OrderStatus,
    totalAmount: Number(row.total_amount),
    paymentMethod: row.payment_method as PaymentMethod,
    deliveryAddress: row.delivery_address,
    createdAt: row.created_at,
    customerName: row.customer_name,
    items: (row.items ?? []).map((item) => ({
      productName: item.product_name,
      imageUrl: item.image_url,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    })),
  };
}
