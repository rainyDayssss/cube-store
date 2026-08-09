import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import {
  canTransition,
  getOrderDetail,
  listOrders,
  nextTransitions,
  ordersToCsv,
  transitionOrderStatus,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "./orders";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

/**
 * The list/detail reads come from the `order_summaries` / `order_details`
 * views (ADR-0012); the SQL joins and the "Deleted product" label are
 * verified by supabase/verify-read-model.sql. These tests seed view-shaped
 * rows and pin the TS mapping, filters, and search.
 *
 * The `transition_order_status` RPC is simulated faithfully below (ticket 10):
 * enforces the lifecycle (one step forward or backward, no skipping; cancel
 * from any non-terminal state; terminal states immutable) and restores stock
 * on cancel inside the same operation. Tests assert on the mock's real tables
 * via `mock.db`.
 */

function installTransitionOrderStatus(mock: MockSupabase): void {
  mock.mockRpc("transition_order_status", (args) => {
    const { p_order_id, p_new_status } = args as {
      p_order_id: string;
      p_new_status: string;
    };
    const orders = (mock.db.orders ?? []) as {
      id: string;
      status: string;
    }[];
    const order = orders.find((o) => o.id === p_order_id);
    if (!order) return { ok: false, message: "That order no longer exists." };
    const from = order.status;

    if (!(p_new_status in ORDER_STATUS_LABELS)) {
      return { ok: false, message: "Unknown order status." };
    }
    if (p_new_status === from) {
      return { ok: false, message: `Order is already ${from}.` };
    }
    if (from === "completed" || from === "cancelled") {
      return {
        ok: false,
        message: `${
          from.charAt(0).toUpperCase() + from.slice(1)
        } orders cannot be changed.`,
      };
    }
    if (p_new_status !== "cancelled" && !canTransition(from as OrderStatus, p_new_status as OrderStatus)) {
      // Bidirectional lifecycle (migration 20260809000001): one step forward
      // or backward, no skipping. `canTransition` is the same rule the SQL
      // function enforces, so the mock can never drift from it.
      return {
        ok: false,
        message: `Cannot move an order from ${from} directly to ${p_new_status}.`,
      };
    }

    if (p_new_status === "cancelled") {
      const items = (mock.db.order_items ?? []) as {
        order_id: string;
        product_id: string | null;
        quantity: number;
      }[];
      for (const item of items) {
        if (item.order_id !== order.id || item.product_id === null) continue;
        const product = (mock.db.products ?? []).find(
          (p) => p.id === item.product_id,
        ) as { stock_quantity: number } | undefined;
        if (product) product.stock_quantity += item.quantity;
      }
    }

    order.status = p_new_status;
    return { ok: true, status: p_new_status };
  });
}

type ProductRow = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  status: string;
  image_url: string;
  category_id: string | null;
};

type CustomerRow = {
  id: string;
  full_name: string;
  email: string;
  contact_number: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  delivery_address: string;
  payment_method: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
};

type OrderSummaryRow = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  items_count: number;
};

type OrderDetailRow = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  delivery_address: string;
  payment_method: string;
  customer_name: string;
  customer_email: string;
  customer_contact_number: string;
  items: {
    id: string;
    product_id: string | null;
    product_name: string;
    image_url: string | null;
    quantity: number;
    unit_price: number;
  }[];
};

const cube: ProductRow = {
  id: "p1",
  name: "3x3 Speed Cube",
  price: 12.99,
  stock_quantity: 10,
  status: "active",
  image_url: "https://img/cube.jpg",
  category_id: "c1",
};

const pyraminx: ProductRow = {
  id: "p2",
  name: "Pyraminx",
  price: 9.99,
  stock_quantity: 3,
  status: "active",
  image_url: "https://img/pyraminx.jpg",
  category_id: "c2",
};

const ada: CustomerRow = {
  id: "cu1",
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  contact_number: "+63 912 345 6789",
};

const grace: CustomerRow = {
  id: "cu2",
  full_name: "Grace Hopper",
  email: "grace@example.com",
  contact_number: "+63 900 000 0000",
};

const order1: OrderRow = {
  id: "o1",
  order_number: "ORD-20260807-0001",
  customer_id: "cu1",
  delivery_address: "12 Analytical Engine St, Manila",
  payment_method: "cod",
  status: "pending",
  total_amount: 35.97,
  notes: "Ring twice",
  created_at: "2026-08-07T09:00:00Z",
};

const order2: OrderRow = {
  id: "o2",
  order_number: "ORD-20260807-0002",
  customer_id: "cu2",
  delivery_address: "1 Compiler Lane, Quezon City",
  payment_method: "ewallet",
  status: "completed",
  total_amount: 9.99,
  notes: null,
  created_at: "2026-08-07T10:00:00Z",
};

// View-shaped rows (what `order_summaries` / `order_details` would return for
// the base data above — the SQL that produces them is verified separately).
const orderSummaries: OrderSummaryRow[] = [
  {
    id: "o1",
    order_number: "ORD-20260807-0001",
    status: "pending",
    total_amount: 35.97,
    created_at: "2026-08-07T09:00:00Z",
    customer_name: "Ada Lovelace",
    customer_email: "ada@example.com",
    items_count: 3,
  },
  {
    id: "o2",
    order_number: "ORD-20260807-0002",
    status: "completed",
    total_amount: 9.99,
    created_at: "2026-08-07T10:00:00Z",
    customer_name: "Grace Hopper",
    customer_email: "grace@example.com",
    items_count: 1,
  },
];

const orderDetails: OrderDetailRow[] = [
  {
    id: "o1",
    order_number: "ORD-20260807-0001",
    status: "pending",
    total_amount: 35.97,
    notes: "Ring twice",
    created_at: "2026-08-07T09:00:00Z",
    delivery_address: "12 Analytical Engine St, Manila",
    payment_method: "cod",
    customer_name: "Ada Lovelace",
    customer_email: "ada@example.com",
    customer_contact_number: "+63 912 345 6789",
    items: [
      {
        id: "i1",
        product_id: "p1",
        product_name: "3x3 Speed Cube",
        image_url: "https://img/cube.jpg",
        quantity: 2,
        unit_price: 12.99,
      },
      {
        id: "i2",
        product_id: "p2",
        product_name: "Pyraminx",
        image_url: "https://img/pyraminx.jpg",
        quantity: 1,
        unit_price: 9.99,
      },
    ],
  },
  {
    id: "o2",
    order_number: "ORD-20260807-0002",
    status: "completed",
    total_amount: 9.99,
    notes: null,
    created_at: "2026-08-07T10:00:00Z",
    delivery_address: "1 Compiler Lane, Quezon City",
    payment_method: "ewallet",
    customer_name: "Grace Hopper",
    customer_email: "grace@example.com",
    customer_contact_number: "+63 900 000 0000",
    items: [
      {
        id: "i3",
        product_id: "p2",
        product_name: "Pyraminx",
        image_url: "https://img/pyraminx.jpg",
        quantity: 1,
        unit_price: 9.99,
      },
    ],
  },
];

function makeMock(orders: OrderRow[] = [order1, order2]) {
  const mock = createMockSupabase({
    products: [cube, pyraminx],
    customers: [ada, grace],
    orders,
    order_items: [
      { id: "i1", order_id: "o1", product_id: "p1", quantity: 2, unit_price: 12.99 },
      { id: "i2", order_id: "o1", product_id: "p2", quantity: 1, unit_price: 9.99 },
      { id: "i3", order_id: "o2", product_id: "p2", quantity: 1, unit_price: 9.99 },
    ],
    order_summaries: orderSummaries,
    order_details: orderDetails,
  });
  installTransitionOrderStatus(mock);
  return mock;
}

describe("listOrders (ticket 10)", () => {
  it("maps the joined view rows (customer, item count), newest first", async () => {
    const mock = makeMock();
    const rows = await listOrders(toClient(mock));

    expect(rows.map((row) => row.orderNumber)).toEqual([
      "ORD-20260807-0002",
      "ORD-20260807-0001",
    ]);
    expect(rows[0]).toMatchObject({
      status: "completed",
      totalAmount: 9.99,
      itemsCount: 1,
      customerName: "Grace Hopper",
      customerEmail: "grace@example.com",
    });
    expect(rows[1]).toMatchObject({
      status: "pending",
      totalAmount: 35.97,
      itemsCount: 3,
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
    });
  });

  it("filters by status", async () => {
    const mock = makeMock();
    const pending = await listOrders(toClient(mock), { status: "pending" });
    expect(pending).toHaveLength(1);
    expect(pending[0].orderNumber).toBe("ORD-20260807-0001");

    const cancelled = await listOrders(toClient(mock), { status: "cancelled" });
    expect(cancelled).toHaveLength(0);
  });

  it("searches by order number, customer name, and email", async () => {
    const mock = makeMock();

    expect((await listOrders(toClient(mock), { q: "0002" })).map((r) => r.id)).toEqual(["o2"]);
    expect((await listOrders(toClient(mock), { q: "hopper" })).map((r) => r.id)).toEqual(["o2"]);
    expect((await listOrders(toClient(mock), { q: "ada@example" })).map((r) => r.id)).toEqual(["o1"]);
    expect(await listOrders(toClient(mock), { q: "nope" })).toHaveLength(0);
  });

  it("returns an empty list when the view query fails", async () => {
    const mock = makeMock();
    mock.failNext({ op: "select", table: "order_summaries" });
    expect(await listOrders(toClient(mock))).toEqual([]);
  });
});

describe("getOrderDetail (ticket 10)", () => {
  it("maps the joined detail row: customer, items, and snapshots", async () => {
    const mock = makeMock();
    const detail = await getOrderDetail(toClient(mock), "o1");

    expect(detail).not.toBeNull();
    if (!detail) return;
    expect(detail).toMatchObject({
      orderNumber: "ORD-20260807-0001",
      status: "pending",
      totalAmount: 35.97,
      deliveryAddress: "12 Analytical Engine St, Manila",
      paymentMethod: "cod",
      notes: "Ring twice",
      customer: {
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        contactNumber: "+63 912 345 6789",
      },
    });
    expect(detail.items).toEqual([
      expect.objectContaining({
        productName: "3x3 Speed Cube",
        quantity: 2,
        unitPrice: 12.99,
        lineTotal: 25.98,
      }),
      expect.objectContaining({
        productName: "Pyraminx",
        quantity: 1,
        unitPrice: 9.99,
        lineTotal: 9.99,
      }),
    ]);
  });

  it("labels deleted products without crashing (label comes from the view)", async () => {
    const mock = makeMock();
    // The view renders a Product deleted after purchase as "Deleted product"
    // (product_id null via on delete set null); seed that shape here.
    const detailRow = mock.db.order_details!.find((row) => row.id === "o1")!;
    (detailRow as OrderDetailRow).items = [
      ...(detailRow as OrderDetailRow).items,
      {
        id: "i4",
        product_id: null,
        product_name: "Deleted product",
        image_url: null,
        quantity: 1,
        unit_price: 5,
      },
    ];

    const detail = await getOrderDetail(toClient(mock), "o1");
    expect(detail?.items[2]).toMatchObject({
      productId: null,
      productName: "Deleted product",
      lineTotal: 5,
    });
  });

  it("returns null when the order is missing", async () => {
    const mock = makeMock();
    expect(await getOrderDetail(toClient(mock), "missing")).toBeNull();
  });
});

describe("lifecycle rules (ticket 10)", () => {
  it("allows only the next forward step and cancel from non-terminal states", () => {
    expect(nextTransitions("pending")).toEqual(["confirmed", "cancelled"]);
    expect(nextTransitions("confirmed")).toEqual(["preparing", "cancelled"]);
    expect(nextTransitions("preparing")).toEqual(["shipped", "cancelled"]);
    expect(nextTransitions("shipped")).toEqual(["completed", "cancelled"]);
    expect(nextTransitions("completed")).toEqual([]);
    expect(nextTransitions("cancelled")).toEqual([]);
  });

  it("allows one step forward or backward, cancel from non-terminal states; rejects skips and terminal moves", () => {
    // Same-status and skipping (forward or backward) are rejected.
    expect(canTransition("pending", "pending")).toBe(false);
    expect(canTransition("pending", "shipped")).toBe(false);
    expect(canTransition("preparing", "pending")).toBe(false);
    // One step forward.
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("shipped", "completed")).toBe(true);
    // One step backward — bidirectional lifecycle (migration 20260809000001).
    expect(canTransition("confirmed", "pending")).toBe(true);
    expect(canTransition("shipped", "preparing")).toBe(true);
    // Cancel from any non-terminal state.
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("shipped", "cancelled")).toBe(true);
    // Terminal states are immutable.
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(false);
    expect(canTransition("completed", "completed")).toBe(false);
    expect(canTransition("cancelled", "cancelled")).toBe(false);
  });
});

describe("transitionOrderStatus (ticket 10)", () => {
  it("walks a valid forward lifecycle pending → completed", async () => {
    const mock = makeMock();
    const client = toClient(mock);

    for (const next of ["confirmed", "preparing", "shipped", "completed"] as OrderStatus[]) {
      const result = await transitionOrderStatus(client, "o1", next);
      expect(result).toEqual({ ok: true });
    }
    expect((mock.db.orders as OrderRow[])[0].status).toBe("completed");
  });

  it("rejects an invalid forward skip", async () => {
    const mock = makeMock();
    const result = await transitionOrderStatus(toClient(mock), "o1", "shipped");
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.message).toContain("directly to");
    expect((mock.db.orders as OrderRow[])[0].status).toBe("pending");
  });

  it("allows a one-step backward move but rejects a multi-step backward skip", async () => {
    const mock = makeMock([
      { ...order1, status: "confirmed" },
      { ...order1, id: "o3", status: "preparing" },
    ]);
    const client = toClient(mock);

    const back = await transitionOrderStatus(client, "o1", "pending");
    expect(back).toEqual({ ok: true });
    expect((mock.db.orders as OrderRow[]).find((o) => o.id === "o1")!.status).toBe("pending");

    const skip = await transitionOrderStatus(client, "o3", "pending");
    expect(skip).toMatchObject({ ok: false });
    if (skip.ok) return;
    expect(skip.message).toContain("directly to");
  });

  it("rejects cancelling a completed order", async () => {
    const mock = makeMock();
    const result = await transitionOrderStatus(toClient(mock), "o2", "cancelled");
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.message).toContain("cannot be changed");
    expect((mock.db.orders as OrderRow[])[1].status).toBe("completed");
  });

  it("rejects any move from a cancelled order", async () => {
    const mock = makeMock([{ ...order1, status: "cancelled" }]);
    const result = await transitionOrderStatus(toClient(mock), "o1", "confirmed");
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an unknown status", async () => {
    const mock = makeMock();
    const result = await transitionOrderStatus(toClient(mock), "o1", "paid" as OrderStatus);
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.message).toContain("Unknown");
  });

  it("cancelling restores stock for every line, atomically (ADR-0002)", async () => {
    const mock = makeMock();
    const client = toClient(mock);
    const products = mock.db.products as ProductRow[];

    // Seeded stock is the live (post-purchase) level: p1 10, p2 3.
    const before = products.map((p) => p.stock_quantity);

    const result = await transitionOrderStatus(client, "o1", "cancelled");
    expect(result).toEqual({ ok: true });

    // Stock restored in the same operation as the status change: p1 +2, p2 +1.
    expect(products.map((p) => p.stock_quantity)).toEqual([before[0] + 2, before[1] + 1]);
    expect((mock.db.orders as OrderRow[])[0].status).toBe("cancelled");
  });

  it("cancelling skips lines whose product was deleted", async () => {
    const mock = makeMock();
    mock.db.order_items?.push({
      id: "i4",
      order_id: "o1",
      product_id: null,
      quantity: 5,
      unit_price: 5,
    });
    const products = mock.db.products as ProductRow[];
    const before = products.find((p) => p.id === "p1")!.stock_quantity;

    const result = await transitionOrderStatus(toClient(mock), "o1", "cancelled");
    expect(result).toEqual({ ok: true });
    // The deleted-product line restores nothing; the live p1 line restores +2.
    expect(products.find((p) => p.id === "p1")!.stock_quantity).toBe(before + 2);
  });

  it("does not double-restore stock on a second cancel attempt", async () => {
    const mock = makeMock();
    const client = toClient(mock);

    const products = mock.db.products as ProductRow[];
    expect((await transitionOrderStatus(client, "o1", "cancelled")).ok).toBe(true);
    const second = await transitionOrderStatus(client, "o1", "cancelled");
    expect(second.ok).toBe(false); // cancelled is terminal

    // Stock restored exactly once (p1 +2, p2 +1), never again.
    expect(products.find((p) => p.id === "p1")!.stock_quantity).toBe(12);
    expect(products.find((p) => p.id === "p2")!.stock_quantity).toBe(4);
  });

  it("surfaces RPC-level failures", async () => {
    const mock = makeMock();
    mock.failNext({ op: "rpc", table: "transition_order_status" });
    const result = await transitionOrderStatus(toClient(mock), "o1", "confirmed");
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.message).toBe("Simulated failure");
  });
});

describe("ordersToCsv (ticket 10)", () => {
  it("produces a BOM-prefixed spreadsheet file of the given rows", async () => {
    const mock = makeMock();
    const rows = await listOrders(toClient(mock));

    const csv = ordersToCsv(rows);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const [header, ...lines] = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(header).toBe(
      "Order number,Status,Customer,Email,Items,Total,Placed at",
    );
    expect(lines[0]).toBe("ORD-20260807-0002,Completed,Grace Hopper,grace@example.com,1,9.99,2026-08-07T10:00:00Z");
    expect(lines).toHaveLength(2);
  });

  it("escapes commas, quotes, and line breaks", () => {
    const csv = ordersToCsv([
      {
        id: "x",
        orderNumber: "ORD-20260807-0009",
        status: "pending",
        totalAmount: 1.5,
        createdAt: "2026-08-07T11:00:00Z",
        itemsCount: 1,
        customerName: 'Doe, "Jane"',
        customerEmail: "jane@example.com",
        paymentMethod: "cod",
      },
    ]);
    expect(csv).toContain('"Doe, ""Jane"""');
  });
});
