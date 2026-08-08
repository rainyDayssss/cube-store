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
