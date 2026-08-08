"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  useCartStore,
  type CartReconcileResult,
} from "@/features/cart/lib/cart";
import {
  PRODUCT_COLUMNS,
  type Product,
} from "@/features/catalog/lib/catalog";
import { onCatalogChanged } from "@/features/catalog/lib/catalog-events";

/**
 * Keeps the Cart's lines in line with the live Catalog (ADR-0013).
 *
 * On mount (once the persisted cart has hydrated) and whenever the tab
 * becomes visible again, fetches the current rows for the cart's product ids
 * — anon can read the world-readable catalog (ADR-0004) — and hands them to
 * the store's `reconcile` action. That refreshes prices/stock/names, clamps
 * quantities, and flags retired Products, so the totals the Customer sees
 * match what checkout will actually charge (price snapshots, ADR-0003).
 *
 * Returns what the last reconciliation changed (or null before the first one
 * completes) so the page can tell the Customer when their cart was synced.
 * The catalog itself is already live on every storefront page (ADR-0011); a
 * cart sitting open while an Admin edits catches up the next time the
 * Customer navigates to it or returns to the tab. Checkout stays the
 * authoritative backstop either way.
 */
export function useCartReconcile(): CartReconcileResult | null {
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const reconcile = useCartStore((state) => state.reconcile);
  const [result, setResult] = useState<CartReconcileResult | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;

    let cancelled = false;
    // Monotonic sequence so a slower earlier fetch can never overwrite a
    // newer one (the same guard the admin products manager uses).
    let sequence = 0;
    // One client for the component's lifetime, not one per event.
    const supabase = createClient();
    const sync = async () => {
      const id = ++sequence;
      const ids = useCartStore.getState().items.map((item) => item.id);
      if (ids.length === 0) {
        // Cart emptied: clear any leftover notice. Returning the previous
        // state when it is already null lets React skip the re-render.
        setResult((prev) => (prev === null ? prev : null));
        return;
      }

      const { data } = await supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .in("id", ids);

      if (cancelled || id !== sequence) return;
      if (data) {
        const next = reconcile(data as Product[]);
        // Only announce genuinely new changes: a no-op reconcile (nothing
        // actually differed) returns the previous result reference, so a
        // cart sitting open is not re-rendered on every Admin edit.
        setResult((prev) =>
          next.updated.length === 0 && next.unavailable.length === 0
            ? prev
            : next,
        );
      }
    };

    void sync();

    // Re-sync when the live Catalog says something changed (ADR-0011 fires
    // `catalog:changed` on every Realtime event) — this is what makes a cart
    // sitting open react while the Customer watches.
    const unsubscribeCatalog = onCatalogChanged(() => void sync());

    // And catch up when the Customer returns to the tab.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      unsubscribeCatalog();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hasHydrated, reconcile]);

  return result;
}
