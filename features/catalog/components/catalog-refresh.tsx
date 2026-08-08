"use client";

import { useRealtimeRefresh } from "@/lib/supabase/use-realtime-refresh";
import { emitCatalogChanged } from "@/features/catalog/lib/catalog-events";

// The catalog tables an anonymous tab can read (RLS world-readable, ADR-0004):
// Realtime broadcasts their changes to storefront tabs. Order tables are NOT
// listed — guests cannot SELECT them, so those events would never arrive
// anyway, and omitting them keeps the subscription surface explicit.
const CATALOG_TABLES = ["products", "categories"] as const;

/**
 * Keeps open storefront tabs current with Admin catalog changes (ADR-0011).
 *
 * Subscribes to Supabase Realtime (Postgres Changes) on the catalog tables
 * and calls `router.refresh()` on each event, re-running the page's server
 * components so products, categories, stock badges, and featured lists all
 * re-fetch in one shot — no manual reload, within milliseconds of the change.
 * Mounted from `StorefrontHeader`, so it runs on every storefront page and is
 * structurally absent from the admin surface. Renders nothing; scheduling
 * lives in the tested seam.
 */
export function CatalogRefresh() {
  // The refresh callback also fires the `catalog:changed` DOM event so
  // client pieces (the Cart's reconcile, ADR-0013) can react without
  // coupling to this component.
  useRealtimeRefresh("catalog-sync", CATALOG_TABLES, emitCatalogChanged);
  return null;
}
