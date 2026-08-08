import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CATALOG_POLL_INTERVAL_MS,
  createCatalogRefresh,
} from "./catalog-refresh";

describe("catalog refresh scheduler (ADR-0010)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes the configured poll interval (10s)", () => {
    expect(CATALOG_POLL_INTERVAL_MS).toBe(10_000);
  });

  it("startIfVisible begins the poll loop only when the tab is visible", () => {
    const refresh = vi.fn();
    const poll = createCatalogRefresh(refresh, { timers: globalThis });

    poll.startIfVisible(false);
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS * 2);
    expect(refresh).not.toHaveBeenCalled();

    poll.startIfVisible(true);
    // Mount never re-fetches immediately — the page was just rendered fresh.
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("polls the refresh callback on the interval once started", () => {
    const refresh = vi.fn();
    const poll = createCatalogRefresh(refresh, { timers: globalThis });

    poll.startIfVisible(true);
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("onVisible re-fetches immediately and resumes polling (tab returns)", () => {
    const refresh = vi.fn();
    const poll = createCatalogRefresh(refresh, { timers: globalThis });

    poll.onVisible();
    expect(refresh).toHaveBeenCalledTimes(1); // instant catch-up on return

    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("onHidden pauses polling; onVisible restarts it", () => {
    const refresh = vi.fn();
    const poll = createCatalogRefresh(refresh, { timers: globalThis });

    poll.startIfVisible(true);
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);

    poll.onHidden();
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(1);

    poll.onVisible();
    expect(refresh).toHaveBeenCalledTimes(2); // refresh on return
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("start, onVisible, onHidden and dispose are all idempotent", () => {
    const refresh = vi.fn();
    const poll = createCatalogRefresh(refresh, { timers: globalThis });

    poll.onVisible();
    poll.onVisible();
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS);
    // Two catch-up refreshes plus one interval tick — but only one live timer.
    expect(refresh).toHaveBeenCalledTimes(3);

    poll.onHidden();
    poll.onHidden();
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(3);

    poll.startIfVisible(true);
    poll.startIfVisible(true);
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it("dispose stops polling for good", () => {
    const refresh = vi.fn();
    const poll = createCatalogRefresh(refresh, { timers: globalThis });

    poll.startIfVisible(true);
    poll.dispose();
    vi.advanceTimersByTime(CATALOG_POLL_INTERVAL_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("honours a custom interval", () => {
    const refresh = vi.fn();
    const poll = createCatalogRefresh(refresh, {
      intervalMs: 1_000,
      timers: globalThis,
    });

    poll.startIfVisible(true);
    vi.advanceTimersByTime(999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
