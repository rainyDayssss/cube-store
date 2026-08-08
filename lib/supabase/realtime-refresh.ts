/**
 * Realtime-driven page refresh (ADR-0011).
 *
 * Storefront and admin tabs keep current with each other's changes by
 * subscribing to Supabase Realtime (Postgres Changes) on the tables the page
 * renders, and calling `router.refresh()` on each event — re-running the
 * page's server components (which query Supabase per request) in one shot.
 *
 * The seam is deliberately small and infrastructure-only: it owns "subscribe
 * to these tables, call `refresh` when a row changes, but not while the tab
 * is hidden". Event payloads are ignored — they are a trigger, never data.
 * RLS governs which events arrive: only rows the subscriber could SELECT are
 * broadcast, so an anonymous storefront tab never receives order events
 * (ADR-0004) while an Admin session receives everything.
 *
 * Tests inject a fake channel (mirroring how the catalog poller's seam
 * injected timers); the real caller passes a supabase-js channel from
 * `client.channel(name)`.
 */

export type RealtimeChangePayload = {
  eventType: string;
};

/**
 * The minimal structural subset of supabase-js's `RealtimeChannel` used here.
 * supabase-js's channel satisfies it structurally.
 */
export type RealtimeRefreshChannel = {
  on(
    event: "postgres_changes",
    filter: { event: "*"; schema: "public"; table: string },
    callback: (payload: RealtimeChangePayload) => void,
  ): unknown;
  subscribe(): unknown;
  unsubscribe(): unknown;
};

export type RealtimeRefreshScheduler = {
  /** Subscribe to the channel (idempotent). Change events refresh the page while visible. */
  start: () => void;
  /** A hidden tab drops change-driven refreshes (no wasted server re-renders). */
  onHidden: () => void;
  /** Returning to the tab refreshes immediately (catch-up), then resumes live updates. */
  onVisible: () => void;
  /** Unsubscribe and release the channel (idempotent). */
  stop: () => void;
};

export function createRealtimeRefresh(
  channel: RealtimeRefreshChannel,
  tables: readonly string[],
  refresh: () => void,
): RealtimeRefreshScheduler {
  let subscribed = false;
  let hidden = false;

  for (const table of tables) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => {
        // `subscribed` guards straggler events still in flight after stop()
        // (the real client can deliver a message past unsubscribe).
        if (subscribed && !hidden) refresh();
      },
    );
  }

  return {
    start() {
      if (subscribed) return;
      subscribed = true;
      channel.subscribe();
    },
    onHidden() {
      hidden = true;
    },
    onVisible() {
      hidden = false;
      // The tab may have missed events while hidden — catch up immediately
      // instead of waiting for the next change.
      refresh();
    },
    stop() {
      if (!subscribed) return;
      subscribed = false;
      channel.unsubscribe();
    },
  };
}
