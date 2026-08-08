"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createCatalogRefresh } from "@/features/catalog/lib/catalog-refresh";

/**
 * Keeps open storefront tabs current with Admin catalog changes (ADR-0010).
 *
 * While the tab is visible it calls `router.refresh()` on the poll interval,
 * re-running the page's server components so products, categories, stock
 * badges, and featured lists all re-fetch in one shot — no manual reload
 * needed. Polling pauses while the tab is hidden and, when the Customer
 * returns, the tab refreshes immediately instead of waiting for the next
 * tick. Mounted from `StorefrontHeader`, so it runs on every storefront page
 * and is structurally absent from the admin surface. Renders nothing; all
 * scheduling decisions live in the tested seam.
 */
export function CatalogRefresh() {
  const router = useRouter();

  useEffect(() => {
    const poll = createCatalogRefresh(() => router.refresh());
    poll.startIfVisible(document.visibilityState === "visible");

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        poll.onVisible();
      } else {
        poll.onHidden();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      poll.dispose();
    };
  }, [router]);

  return null;
}
