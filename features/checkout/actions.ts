"use server";

import { createClient } from "@/lib/supabase/server";
import {
  placeOrder,
  type CheckoutDetails,
  type CheckoutLineInput,
  type PaymentMethod,
  type PlaceOrderResult,
} from "@/features/checkout/lib/checkout";

/**
 * Guest checkout submission (ticket 06). Runs on the server, so the write
 * path is never trusted from the client (ADR-0004). It re-validates the form
 * and cart shape, then delegates to the atomic `place_order` Postgres
 * function, which re-checks live stock and rejects with per-item detail.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAYMENT_METHODS: PaymentMethod[] = ["cod", "ewallet", "bank_transfer"];

export type CheckoutActionResponse = PlaceOrderResult;

export async function submitCheckout(input: {
  details: CheckoutDetails;
  items: CheckoutLineInput[];
}): Promise<CheckoutActionResponse> {
  const { details, items } = input;

  // --- server-side form validation (authoritative, ADR-0004 — the client
  // pass is convenience only). ---
  if (
    !details ||
    typeof details.fullName !== "string" ||
    !details.fullName.trim()
  ) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Full name is required.",
      field: "fullName",
    };
  }
  if (typeof details.email !== "string" || !EMAIL_RE.test(details.email.trim())) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Enter a valid email address.",
      field: "email",
    };
  }
  if (
    typeof details.contactNumber !== "string" ||
    !details.contactNumber.trim()
  ) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Contact number is required.",
      field: "contactNumber",
    };
  }
  if (
    typeof details.deliveryAddress !== "string" ||
    !details.deliveryAddress.trim()
  ) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Delivery address is required.",
      field: "deliveryAddress",
    };
  }
  if (!PAYMENT_METHODS.includes(details.paymentMethod as PaymentMethod)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Choose a payment method.",
      field: "paymentMethod",
    };
  }

  // --- cart shape validation (server-only: the client's cart is trusted last) ---
  if (!Array.isArray(items) || items.length === 0) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Your cart is empty. Add a few cubes before checking out.",
    };
  }
  for (const line of items) {
    if (
      !line ||
      typeof line.productId !== "string" ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1
    ) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Your cart contains an invalid line. Review it and try again.",
      };
    }
  }

  const supabase = await createClient();
  return placeOrder(supabase, details, items);
}
