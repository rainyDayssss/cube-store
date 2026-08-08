/**
 * Live-catalog DOM event contract (ADR-0011 / ADR-0013).
 *
 * `CatalogRefresh` dispatches `catalog:changed` whenever Realtime says a
 * catalog row changed; client pieces that want to react to live changes
 * without importing each other (the Cart reconciles its lines — ADR-0013)
 * subscribe with `onCatalogChanged`. The event is intentionally payload-free:
 * subscribers re-fetch what they care about.
 */

const CATALOG_CHANGED_EVENT = "catalog:changed";

/** Fires the event. No-op on the server (there is no DOM). */
export function emitCatalogChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CATALOG_CHANGED_EVENT));
}

/**
 * Subscribes to live catalog changes; returns an unsubscribe function.
 * No-op (returns a no-op unsubscribe) on the server, mirroring the guard on
 * `emitCatalogChanged` — this is only ever called from client `useEffect`
 * bodies, but staying server-safe keeps the module symmetric.
 */
export function onCatalogChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CATALOG_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CATALOG_CHANGED_EVENT, handler);
}
