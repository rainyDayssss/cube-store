"use client";

import { useRealtimeRefresh } from "@/lib/supabase/use-realtime-refresh";

// Every table the admin surface renders: orders and their items and customers
// (new orders, status moves, spend aggregates — ADR-0004) plus the catalog
// (an Admin editing products from another tab). RLS means only Admin sessions
// ever receive the order/customer events; the subscription is inert for the
// anon role even if it were mounted on the storefront.
const ADMIN_TABLES = [
  "orders",
  "order_items",
  "customers",
  "products",
  "categories",
] as const;

/**
 * Keeps open admin tabs current with store activity (ADR-0011).
 *
 * Subscribes to Supabase Realtime (Postgres Changes) on the order, customer,
 * and catalog tables and calls `router.refresh()` on each event — so a new
 * order, a status move, a customer aggregate, or a product edit appears on
 * the open dashboard without a reload. Mounted from `AdminGate`, so it only
 * ever runs behind the auth gate. Renders nothing; scheduling lives in the
 * tested seam.
 */
export function AdminRefresh() {
  useRealtimeRefresh("admin-sync", ADMIN_TABLES);
  return null;
}
