"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  transitionOrderStatus,
  type OrderStatus,
} from "@/features/admin/lib/orders/orders";

/**
 * Moves an Order through the lifecycle. The `transition_order_status`
 * function is the authoritative guard (only legal moves, atomic stock restore
 * on cancel) — this action exists to run it with the Admin's session and to
 * revalidate the list + detail views after a successful move.
 */
export async function transitionOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const result = await transitionOrderStatus(supabase, orderId, status);
  if (result.ok) {
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
  }
  return result;
}
