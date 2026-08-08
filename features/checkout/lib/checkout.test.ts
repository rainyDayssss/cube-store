import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import {
  placeOrder,
  type CheckoutDetails,
  type CheckoutLineInput,
} from "./checkout";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

/**
 * Faithful simulation of the `place_order` Postgres function (ticket 06):
 * validates every line against live stock, rejects atomically (returns before
 * any write on failure), upserts the guest Customer by lowercased email,
 * allocates the per-day ORD-YYYYMMDD-XXXX number, inserts Order + items with
 * price snapshots, and deducts stock. Tests assert on the mock's real tables
 * via `mock.db`, so they verify the seam's behaviour end-to-end.
 */

const TEST_DAY = "20260807";

type ProductRow = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  status: string;
  image_url: string;
  category_id: string | null;
};

const cube: ProductRow = {
  id: "p1",
  name: "3x3 Speed Cube",
  price: 12.99,
  stock_quantity: 10,
  status: "active",
  image_url: "a",
  category_id: "c1",
};

const pyraminx: ProductRow = {
  id: "p2",
  name: "Pyraminx",
  price: 9.99,
  stock_quantity: 3,
  status: "active",
  image_url: "b",
  category_id: "c2",
};

const inactive: ProductRow = {
  id: "p3",
  name: "Retired Puzzle",
  price: 5.0,
  stock_quantity: 5,
  status: "inactive",
  image_url: "c",
  category_id: "c1",
};

function installPlaceOrder(mock: MockSupabase): void {
  let dayCounter = 0;

  mock.mockRpc("place_order", (args) => {
    const {
      p_full_name,
      p_email,
      p_contact_number,
      p_delivery_address,
      p_payment_method,
      p_notes,
      p_items,
    } = args as {
      p_full_name: string;
      p_email: string;
      p_contact_number: string;
      p_delivery_address: string;
      p_payment_method: string;
      p_notes: string | null;
      p_items: { product_id: string; quantity: number }[];
    };

    const products = (mock.db.products ?? []) as ProductRow[];
    const issues: {
      product_id: string;
      name: string;
      available?: number;
      requested: number;
    }[] = [];
    let total = 0;

    const seen = new Set<string>();
    for (const line of p_items) {
      if (seen.has(line.product_id)) {
        return {
          ok: false,
          code: "VALIDATION",
          message: "Your cart contains the same product more than once.",
        };
      }
      seen.add(line.product_id);
      const product = products.find((p) => p.id === line.product_id);
      if (!product || product.status !== "active") {
        return {
          ok: false,
          code: "PRODUCT_UNAVAILABLE",
          message: `"${product?.name ?? line.product_id}" is no longer available.`,
          items: [
            {
              product_id: line.product_id,
              name: product?.name ?? "Unavailable product",
              requested: line.quantity,
            },
          ],
        };
      }
      if (product.stock_quantity < line.quantity) {
        issues.push({
          product_id: product.id,
          name: product.name,
          available: product.stock_quantity,
          requested: line.quantity,
        });
      }
      total += product.price * line.quantity;
    }

    if (issues.length > 0) {
      return {
        ok: false,
        code: "INSUFFICIENT_STOCK",
        message: "Some items do not have enough stock.",
        items: issues,
      };
    }

    const email = p_email.toLowerCase();
    const existing = (mock.db.customers ?? []).find((c) => c.email === email);
    const customerId = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      mock.db.customers = [
        ...(mock.db.customers ?? []),
        {
          id: customerId,
          full_name: p_full_name,
          email,
          contact_number: p_contact_number,
        },
      ];
    } else {
      // Simulates the function's `on conflict (email) do update`.
      existing.full_name = p_full_name;
      existing.contact_number = p_contact_number;
    }

    dayCounter += 1;
    const orderNumber = `ORD-${TEST_DAY}-${String(dayCounter).padStart(4, "0")}`;
    const orderId = crypto.randomUUID();
    mock.db.orders = [
      ...(mock.db.orders ?? []),
      {
        id: orderId,
        order_number: orderNumber,
        customer_id: customerId,
        delivery_address: p_delivery_address,
        payment_method: p_payment_method,
        status: "pending",
        total_amount: total,
        notes: p_notes ?? null,
      },
    ];

    const orderItems = (mock.db.order_items ??= []);
    for (const line of p_items) {
      const product = products.find((p) => p.id === line.product_id)!;
      orderItems.push({
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: product.id,
        quantity: line.quantity,
        unit_price: product.price,
      });
      product.stock_quantity -= line.quantity;
    }

    return {
      ok: true,
      order_id: orderId,
      order_number: orderNumber,
      total_amount: total,
    };
  });
}

function makeMock(products: ProductRow[] = [cube, pyraminx]) {
  const mock = createMockSupabase({
    products,
    customers: [],
    orders: [],
    order_items: [],
  });
  installPlaceOrder(mock);
  return mock;
}

const details: CheckoutDetails = {
  fullName: "Ada Lovelace",
  email: "ADA@example.com",
  contactNumber: "+63 912 345 6789",
  deliveryAddress: "12 Analytical Engine St, Manila",
  paymentMethod: "cod",
  notes: "Ring the doorbell twice.",
};

function lines(...items: CheckoutLineInput[]): CheckoutLineInput[] {
  return items;
}

describe("placeOrder (ticket 06)", () => {
  it("creates the Customer, Order, and items, deducts stock, and snapshots prices", async () => {
    const mock = makeMock();
    const result = await placeOrder(
      toClient(mock),
      details,
      lines({ productId: "p1", quantity: 2 }, { productId: "p2", quantity: 1 }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Order number: per-day sequential format.
    expect(result.orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(result.orderNumber).toBe(`ORD-${TEST_DAY}-0001`);
    expect(result.totalAmount).toBeCloseTo(12.99 * 2 + 9.99, 2);

    // Customer upserted by lowercased email.
    expect(mock.db.customers).toHaveLength(1);
    expect(mock.db.customers[0]).toMatchObject({
      email: "ada@example.com",
      full_name: "Ada Lovelace",
    });

    // Order row references the customer; items snapshot unit prices (ADR-0003).
    const order = mock.db.orders![0];
    expect(order).toMatchObject({
      customer_id: mock.db.customers[0].id,
      total_amount: result.totalAmount,
      payment_method: "cod",
      status: "pending",
    });
    const itemRows = mock.db.order_items!.filter((i) => i.order_id === order.id);
    expect(itemRows).toHaveLength(2);
    expect(itemRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product_id: "p1", quantity: 2, unit_price: 12.99 }),
        expect.objectContaining({ product_id: "p2", quantity: 1, unit_price: 9.99 }),
      ]),
    );

    // Stock deducted (ADR-0002).
    const products = mock.db.products as ProductRow[];
    expect(products.find((p) => p.id === "p1")!.stock_quantity).toBe(8);
    expect(products.find((p) => p.id === "p2")!.stock_quantity).toBe(2);
  });

  it("allocates unique sequential order numbers across orders", async () => {
    const mock = makeMock();

    const first = await placeOrder(
      toClient(mock),
      details,
      lines({ productId: "p1", quantity: 1 }),
    );
    const second = await placeOrder(
      toClient(mock),
      { ...details, email: "other@example.com" },
      lines({ productId: "p2", quantity: 1 }),
    );

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.orderNumber).toBe(`ORD-${TEST_DAY}-0001`);
    expect(second.orderNumber).toBe(`ORD-${TEST_DAY}-0002`);
    expect(first.orderNumber).not.toBe(second.orderNumber);
  });

  it("reuses the same Customer row for repeat orders with the same email", async () => {
    const mock = makeMock();

    await placeOrder(toClient(mock), details, lines({ productId: "p1", quantity: 1 }));
    await placeOrder(
      toClient(mock),
      { ...details, contactNumber: "+1 555 0100" },
      lines({ productId: "p2", quantity: 1 }),
    );

    expect(mock.db.customers).toHaveLength(1);
    expect(mock.db.orders).toHaveLength(2);
    expect(mock.db.orders![0].customer_id).toBe(mock.db.orders![1].customer_id);
    // Contact info refreshed on the shared row.
    expect(mock.db.customers[0].contact_number).toBe("+1 555 0100");
  });

  it("rejects atomically when a line's stock is stale — no partial writes", async () => {
    const mock = makeMock();

    const result = await placeOrder(
      toClient(mock),
      details,
      lines({ productId: "p1", quantity: 2 }, { productId: "p2", quantity: 99 }),
    );

    expect(result).toMatchObject({
      ok: false,
      code: "INSUFFICIENT_STOCK",
      items: [{ productId: "p2", name: "Pyraminx", available: 3, requested: 99 }],
    });
    if (result.ok) return;

    // Atomicity: nothing was written and stock is untouched.
    expect(mock.db.customers).toHaveLength(0);
    expect(mock.db.orders).toHaveLength(0);
    expect(mock.db.order_items).toHaveLength(0);
    expect((mock.db.products as ProductRow[])[1].stock_quantity).toBe(3);
  });

  it("rejects when a cart line is no longer available (inactive product)", async () => {
    const mock = makeMock([cube, pyraminx, inactive]);

    const result = await placeOrder(
      toClient(mock),
      details,
      lines({ productId: "p3", quantity: 1 }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PRODUCT_UNAVAILABLE");
    expect(mock.db.orders).toHaveLength(0);
  });

  it("rejects carts that repeat the same product (would bypass per-line stock checks)", async () => {
    const mock = makeMock();

    const result = await placeOrder(
      toClient(mock),
      details,
      lines({ productId: "p1", quantity: 5 }, { productId: "p1", quantity: 5 }),
    );

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(mock.db.orders).toHaveLength(0);
    expect(mock.db.order_items).toHaveLength(0);
  });

  it("surfaces RPC-level failures as UNKNOWN", async () => {
    const mock = makeMock();
    mock.failNext({ op: "rpc", table: "place_order" });

    const result = await placeOrder(
      toClient(mock),
      details,
      lines({ productId: "p1", quantity: 1 }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("UNKNOWN");
    expect(result.message).toBe("Simulated failure");
    expect(mock.db.orders).toHaveLength(0);
  });
});

