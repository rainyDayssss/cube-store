"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Product } from "@/features/catalog/lib/catalog";

/**
 * The shopping Cart (ticket 05): a client-side selection of Products, persisted
 * to localStorage so it survives refreshes and visits. Quantities are capped at
 * the stock snapshot taken when the item was added — a UX guarantee only; stock
 * is re-validated server-side at checkout (ticket 06), never here.
 */

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url: string;
  stock_quantity: number;
  quantity: number;
  /**
   * Set by reconciliation (ADR-0013) when the Product no longer exists or is
   * no longer active. Unavailable lines stay visible so the Customer can see
   * and remove them; they block checkout until removed.
   */
  unavailable?: boolean;
};

export type CartReconcileResult = {
  /** Product ids whose display data or quantity changed to match the catalog. */
  updated: string[];
  /** Product ids newly flagged as unavailable (deleted or retired). */
  unavailable: string[];
};

export type CartState = {
  items: CartItem[];
  /** Adds a Product (or increments an existing line) capped at stock. */
  addItem: (product: Product, quantity?: number) => void;
  /** Sets a line's quantity; clamped to [1, stock]. */
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  /** Success callback seam: checkout (ticket 06) calls this after an Order. */
  clearCart: () => void;
  /**
   * Brings the cart in line with the live Catalog (ADR-0013): refreshes
   * prices/stock/names/images, clamps quantities to live stock, and flags
   * retired Products. Returns what changed so the UI can tell the Customer.
   */
  reconcile: (liveProducts: readonly Product[]) => CartReconcileResult;
  /** True once localStorage has been rehydrated on the client. */
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
};

// localStorage is only available on the client. Zustand's persist middleware
// runs during module init, so on the server we hand it a no-op storage —
// nothing is ever hydrated there, and it never writes.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const clientStorage = createJSONStorage(() =>
  typeof window !== "undefined" ? window.localStorage : noopStorage,
);

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      hasHydrated: false,
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

      addItem: (product, quantity = 1) =>
        set((state) => {
          // Never let an out-of-stock Product into the cart as a phantom
          // zero-quantity line — the UI blocks this, but the store is the seam.
          if (product.stock_quantity <= 0) return state;

          const existing = state.items.find((item) => item.id === product.id);
          const qty = Math.max(1, Math.floor(quantity));

          if (existing) {
            return {
              items: state.items.map((item) =>
                item.id === product.id
                  ? {
                      ...item,
                      quantity: Math.min(
                        item.quantity + qty,
                        item.stock_quantity,
                      ),
                    }
                  : item,
              ),
            };
          }

          const line: CartItem = {
            id: product.id,
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            stock_quantity: product.stock_quantity,
            quantity: Math.min(qty, product.stock_quantity),
          };
          return { items: [...state.items, line] };
        }),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === productId
              ? {
                  ...item,
                  // Clamp to [1, stock]. If stock dropped to 0 after adding,
                  // hold the line at 1 rather than creating a zero-quantity row
                  // (the cart page flags it as out of stock for removal).
                  quantity: Math.min(
                    Math.max(1, Math.floor(quantity)),
                    Math.max(1, item.stock_quantity),
                  ),
                }
              : item,
          ),
        })),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== productId),
        })),

      clearCart: () => set({ items: [] }),

      // `useCartStore` is referenced only when the action runs (after the
      // store exists), so the circular reference is safe.
      reconcile: (liveProducts) => {
        const current = useCartStore.getState().items;
        const { items, result } = reconcileCart(current, liveProducts);
        // Nothing changed: keep the same array reference so subscribers and
        // localStorage are not touched on every page visit or Realtime event.
        if (result.updated.length === 0 && result.unavailable.length === 0) {
          return { updated: [], unavailable: [] };
        }
        set({ items });
        return result;
      },
    }),
    {
      name: "cube-store-cart",
      storage: clientStorage,
      // Only cart lines are persisted — the hydration flag is transient.
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/** Derived: total number of units in the cart. */
export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Derived: subtotal before shipping (prices are snapshots at add time). */
export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Brings cart lines in line with the live Catalog (ADR-0013). For every line:
 * refresh name/price/image/stock from the current Product row, clamp the
 * quantity to live stock (holding at 1 like `updateQuantity`), and flag
 * Products that are gone or no longer active. Deleted Products simply do not
 * appear in the fetched list; retired ones come back with `status !== "active"`.
 * Only genuinely new changes are reported, so the UI never re-announces an
 * already-synced cart.
 */
export function reconcileCart(
  items: CartItem[],
  liveProducts: readonly Product[],
): { items: CartItem[]; result: CartReconcileResult } {
  const live = new Map(liveProducts.map((product) => [product.id, product]));
  const result: CartReconcileResult = { updated: [], unavailable: [] };

  const nextItems = items.map((item) => {
    const product = live.get(item.id);

    // Deleted or retired: flag, keep the line visible for removal, and do not
    // touch its snapshot data (it is the only record left of what was bought).
    if (!product || product.status !== "active") {
      if (!item.unavailable) result.unavailable.push(item.id);
      return { ...item, unavailable: true };
    }

    const quantity = Math.min(item.quantity, Math.max(1, product.stock_quantity));
    const changed =
      item.name !== product.name ||
      item.price !== product.price ||
      item.image_url !== product.image_url ||
      item.stock_quantity !== product.stock_quantity ||
      item.quantity !== quantity ||
      item.unavailable === true;
    if (changed) result.updated.push(item.id);

    return {
      ...item,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      stock_quantity: product.stock_quantity,
      quantity,
      unavailable: false,
    };
  });

  return { items: nextItems, result };
}
