import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Guest checkout (ticket 06) — the single seam for ordering behaviour.
 *
 * `placeOrder` delegates to the `place_order` Postgres function, which runs
 * as one atomic SECURITY DEFINER transaction: it row-locks and re-validates
 * stock for every cart line, upserts the guest Customer by email, inserts the
 * Order + items with price snapshots, deducts stock, and allocates the
 * per-day ORD-YYYYMMDD-XXXX number. Everything the client needs to trust —
 * stock truth, prices, atomicity — lives in that function, never here.
 *
 * This module only shapes the RPC call and maps the response into a typed
 * result. Tests exercise it against the mocked client with a faithful
 * simulation of the function's behaviour (see checkout.test.ts).
 */

export type PaymentMethod = "cod" | "ewallet" | "bank_transfer";

export type CheckoutDetails = {
  fullName: string;
  email: string;
  contactNumber: string;
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
  notes?: string;
};

export type CheckoutLineInput = {
  productId: string;
  quantity: number;
};

/** A single rejected cart line, with what stock actually allowed. */
export type CheckoutLineIssue = {
  productId: string;
  name: string;
  /** Only present when the product exists but stock is too low. */
  available?: number;
  requested: number;
};

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      totalAmount: number;
    }
  | {
      ok: false;
      code: "INSUFFICIENT_STOCK" | "PRODUCT_UNAVAILABLE";
      message: string;
      items: CheckoutLineIssue[];
    }
  | {
      ok: false;
      code: "VALIDATION";
      message: string;
      /** Which form field, when the Server Action rejected the input. */
      field?: string;
    }
  | {
      ok: false;
      code: "UNKNOWN";
      message: string;
    };

export async function placeOrder(
  client: SupabaseClient,
  details: CheckoutDetails,
  items: CheckoutLineInput[],
): Promise<PlaceOrderResult> {
  const { data, error } = await client.rpc("place_order", {
    p_full_name: details.fullName,
    p_email: details.email,
    p_contact_number: details.contactNumber,
    p_delivery_address: details.deliveryAddress,
    p_payment_method: details.paymentMethod,
    p_notes: details.notes?.trim() ? details.notes : null,
    p_items: items.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
    })),
  });

  // Transport/DB-level failure (network, timeout, unapplied migration).
  if (error) {
    return { ok: false, code: "UNKNOWN", message: error.message };
  }

  // The function answers with snake_case keys (product_id, order_id, ...);
  // map the response into the camelCase public shape below.
  const result = data as
    | {
        ok?: boolean;
        order_id?: string;
        order_number?: string;
        total_amount?: number;
        code?: string;
        message?: string;
        items?: {
          product_id: string;
          name: string;
          available?: number;
          requested: number;
        }[];
      }
    | null
    | undefined;

  if (!result || result.ok !== true) {
    const code = result?.code;
    if (code === "INSUFFICIENT_STOCK" || code === "PRODUCT_UNAVAILABLE") {
      return {
        ok: false,
        code,
        message: result?.message ?? "Your order could not be placed.",
        items: (result?.items ?? []).map((line) => ({
          productId: line.product_id,
          name: line.name,
          available: line.available,
          requested: line.requested,
        })),
      };
    }
    if (code === "VALIDATION") {
      return {
        ok: false,
        code: "VALIDATION",
        message: result?.message ?? "Your order details need a second look.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN",
      message: result?.message ?? "Something went wrong placing your order.",
    };
  }

  return {
    ok: true,
    orderId: result.order_id ?? "",
    orderNumber: result.order_number ?? "",
    totalAmount: result.total_amount ?? 0,
  };
}
