import { describe, expect, it, beforeEach } from "vitest";
import {
  cartCount,
  cartSubtotal,
  useCartStore,
  type CartState,
} from "./cart";
import type { Product } from "@/features/catalog/lib/catalog";

// Each test gets a fresh store so persisted state can't leak between tests.
function freshStore(): CartState {
  useCartStore.setState({ items: [], hasHydrated: false });
  return useCartStore.getState();
}

const cube: Product = {
  id: "p1",
  name: "3x3 Speed Cube",
  description: "Classic",
  price: 12.99,
  stock_quantity: 5,
  image_url: "a",
  status: "active",
  category_id: "c1",
};

const pyraminx: Product = {
  id: "p2",
  name: "Pyraminx",
  description: "Tetrahedral",
  price: 9.99,
  stock_quantity: 2,
  image_url: "b",
  status: "active",
  category_id: "c2",
};

describe("cart store (ticket 05)", () => {
  beforeEach(() => {
    freshStore();
  });

  it("adds an item with its quantity", () => {
    const store = freshStore();
    store.addItem(cube, 2);

    expect(useCartStore.getState().items).toEqual([
      expect.objectContaining({ id: "p1", quantity: 2, price: 12.99 }),
    ]);
  });

  it("caps the added quantity at the stock snapshot", () => {
    const store = freshStore();
    store.addItem(cube, 99);

    expect(useCartStore.getState().items[0].quantity).toBe(5);
  });

  it("increments an existing line but never above stock", () => {
    const store = freshStore();
    store.addItem(cube, 3);
    store.addItem(cube, 2); // 3 + 2 = 5, exactly at stock

    expect(useCartStore.getState().items[0].quantity).toBe(5);

    store.addItem(cube, 1); // capped at 5
    expect(useCartStore.getState().items[0].quantity).toBe(5);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("updates a quantity clamped to [1, stock]", () => {
    const store = freshStore();
    store.addItem(cube, 1);
    store.updateQuantity("p1", 10);

    expect(useCartStore.getState().items[0].quantity).toBe(5);

    store.updateQuantity("p1", 0);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it("removes an item", () => {
    const store = freshStore();
    store.addItem(cube, 1);
    store.addItem(pyraminx, 1);
    store.removeItem("p1");

    expect(useCartStore.getState().items.map((i) => i.id)).toEqual(["p2"]);
  });

  it("clears the cart", () => {
    const store = freshStore();
    store.addItem(cube, 1);
    store.clearCart();

    expect(useCartStore.getState().items).toEqual([]);
  });

  it("derives the unit count and subtotal", () => {
    const store = freshStore();
    store.addItem(cube, 2); // 12.99 * 2
    store.addItem(pyraminx, 1); // 9.99

    expect(cartCount(useCartStore.getState().items)).toBe(3);
    expect(cartSubtotal(useCartStore.getState().items)).toBeCloseTo(35.97, 2);
  });

  it("refuses to add an out-of-stock product (no zero-quantity line)", () => {
    const store = freshStore();
    store.addItem({ ...cube, stock_quantity: 0 }, 1);

    expect(useCartStore.getState().items).toEqual([]);
  });

  it("holds a line at quantity 1 when its stock drops to zero after adding", () => {
    const store = freshStore();
    store.addItem(cube, 2);
    store.updateQuantity("p1", 3);
    // Simulate stock dropping to 0 after the item was added.
    const state = useCartStore.getState();
    state.updateQuantity("p1", 0);
    state.items.map((i) => ({ ...i, stock_quantity: 0 }));
    useCartStore.setState({
      items: useCartStore.getState().items.map((i) => ({
        ...i,
        stock_quantity: 0,
      })),
    });
    store.updateQuantity("p1", 5);

    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it("starts empty and unhydrated, and exposes the hydration flag setter", () => {
    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().hasHydrated).toBe(false);

    useCartStore.getState().setHasHydrated(true);
    expect(useCartStore.getState().hasHydrated).toBe(true);
  });
});
