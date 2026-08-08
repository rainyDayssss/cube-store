/**
 * Storefront catalog refresh scheduling (ADR-0010).
 *
 * The storefront keeps open tabs current with Admin changes by re-fetching on
 * a fixed interval while the tab is visible. The `CatalogRefresh` client
 * component is thin glue over this pure seam, which is what the tests pin:
 * the `refresh` callback and timer functions are injected, so the unit tests
 * run against a fake clock with no DOM.
 */

export const CATALOG_POLL_INTERVAL_MS = 10_000;

export type CatalogRefreshTimers = {
  setInterval: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearInterval: (handle: ReturnType<typeof setInterval>) => void;
};

export type CatalogRefreshOptions = {
  intervalMs?: number;
  timers?: CatalogRefreshTimers;
};

export type CatalogRefreshScheduler = {
  /** On mount: begin the poll loop only if the tab is already visible. */
  startIfVisible: (isVisible: boolean) => void;
  /** On the tab becoming visible: re-fetch immediately, then resume polling. */
  onVisible: () => void;
  /** On the tab being hidden: pause polling until it returns. */
  onHidden: () => void;
  /** On unmount: stop polling and release the timer. */
  dispose: () => void;
};

export function createCatalogRefresh(
  refresh: () => void,
  options: CatalogRefreshOptions = {},
): CatalogRefreshScheduler {
  const intervalMs = options.intervalMs ?? CATALOG_POLL_INTERVAL_MS;
  const { setInterval: setTimer, clearInterval: clearTimer } = options.timers ?? {
    setInterval,
    clearInterval,
  };

  let handle: ReturnType<typeof setInterval> | null = null;

  function startLoop() {
    if (handle === null) {
      handle = setTimer(refresh, intervalMs);
    }
  }

  function stopLoop() {
    if (handle !== null) {
      clearTimer(handle);
      handle = null;
    }
  }

  return {
    startIfVisible(isVisible) {
      if (isVisible) startLoop();
    },
    onVisible() {
      refresh();
      startLoop();
    },
    onHidden() {
      stopLoop();
    },
    dispose() {
      stopLoop();
    },
  };
}
