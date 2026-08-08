import { describe, expect, it, vi } from "vitest";
import {
  createRealtimeRefresh,
  type RealtimeRefreshChannel,
} from "./realtime-refresh";

type EmittableChannel = RealtimeRefreshChannel & {
  emit(table: string, eventType?: string): void;
};

/** A fake channel: registers one handler per table, emits test events. */
function createFakeChannel(): EmittableChannel {
  const handlers = new Map<string, (payload: { eventType: string }) => void>();
  const channel = {
    on(
      _event: "postgres_changes",
      filter: { event: "*"; schema: "public"; table: string },
      callback: (payload: { eventType: string }) => void,
    ) {
      handlers.set(filter.table, callback);
      return channel;
    },
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    emit(table: string, eventType = "INSERT") {
      handlers.get(table)?.({ eventType });
    },
  };
  return channel;
}

describe("realtime refresh scheduler (ADR-0011)", () => {
  it("start subscribes the channel once (idempotent)", () => {
    const channel = createFakeChannel();
    const refresh = createRealtimeRefresh(channel, ["products"], vi.fn());

    refresh.start();
    refresh.start();

    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  it("refreshes on INSERT, UPDATE, and DELETE for a subscribed table", () => {
    const channel = createFakeChannel();
    const onRefresh = vi.fn();
    const refresh = createRealtimeRefresh(channel, ["products"], onRefresh);

    refresh.start();
    channel.emit("products", "INSERT");
    channel.emit("products", "UPDATE");
    channel.emit("products", "DELETE");

    expect(onRefresh).toHaveBeenCalledTimes(3);
  });

  it("ignores events for tables that are not subscribed", () => {
    const channel = createFakeChannel();
    const onRefresh = vi.fn();
    const refresh = createRealtimeRefresh(
      channel,
      ["products", "categories"],
      onRefresh,
    );

    refresh.start();
    channel.emit("orders", "INSERT");
    channel.emit("customers", "UPDATE");

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("drops change events while the tab is hidden", () => {
    const channel = createFakeChannel();
    const onRefresh = vi.fn();
    const refresh = createRealtimeRefresh(channel, ["products"], onRefresh);

    refresh.start();
    refresh.onHidden();
    channel.emit("products", "INSERT");

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("onVisible refreshes immediately (catch-up) and resumes live events", () => {
    const channel = createFakeChannel();
    const onRefresh = vi.fn();
    const refresh = createRealtimeRefresh(channel, ["products"], onRefresh);

    refresh.start();
    refresh.onHidden();
    refresh.onVisible();
    expect(onRefresh).toHaveBeenCalledTimes(1); // instant catch-up on return

    channel.emit("products", "UPDATE");
    expect(onRefresh).toHaveBeenCalledTimes(2); // events resume
  });

  it("stop unsubscribes once and drops events afterwards", () => {
    const channel = createFakeChannel();
    const onRefresh = vi.fn();
    const refresh = createRealtimeRefresh(channel, ["products"], onRefresh);

    refresh.start();
    refresh.stop();
    refresh.stop(); // idempotent

    expect(channel.unsubscribe).toHaveBeenCalledTimes(1);

    channel.emit("products", "INSERT");
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
