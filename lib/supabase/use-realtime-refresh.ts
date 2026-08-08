"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createRealtimeRefresh } from "@/lib/supabase/realtime-refresh";

/**
 * Live page updates (ADR-0011): subscribes the current tab to Supabase
 * Realtime (Postgres Changes) on `tables` and calls `router.refresh()` on
 * each event, re-running the page's server components in one shot. Hidden
 * tabs drop change-driven refreshes and catch up the instant the tab becomes
 * visible again. The subscription lives for the component's lifetime and is
 * torn down fully on unmount (unsubscribe + removeChannel). The tested seam
 * (`createRealtimeRefresh`) owns the scheduling decisions; this hook is thin
 * glue wiring it to the router and the browser client.
 */
export function useRealtimeRefresh(
  channelName: string,
  tables: readonly string[],
  onRefresh?: () => void,
): void {
  const router = useRouter();

  useEffect(() => {
    const client = createClient();
    const channel = client.channel(channelName);
    const refresh = createRealtimeRefresh(channel, tables, () => {
      router.refresh();
      onRefresh?.();
    });
    refresh.start();
    if (document.visibilityState !== "visible") refresh.onHidden();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh.onVisible();
      } else {
        refresh.onHidden();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      refresh.stop();
      client.removeChannel(channel);
    };
    // `onRefresh` is expected to be a stable module-level function (the
    // storefront passes `emitCatalogChanged`); an inline closure here would
    // re-subscribe on every render.
  }, [channelName, onRefresh, router, tables]);
}
