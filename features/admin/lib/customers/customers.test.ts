import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import { getCustomerDetail, listCustomers } from "./customers";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

type CustomerRow = {
  id: string;
  full_name: string;
  email: string;
  contact_number: string;
  account_status: string;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  total_amount: number;
  created_at: string;
};

const ada: CustomerRow = {
  id: "cu1",
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  contact_number: "+63 912 345 6789",
  account_status: "active",
  created_at: "2026-08-06T09:00:00Z",
};

const grace: CustomerRow = {
  id: "cu2",
  full_name: "Grace Hopper",
  email: "grace@example.com",
  contact_number: "+63 900 000 0000",
  account_status: "active",
  created_at: "2026-08-07T10:00:00Z",
};

const orders: OrderRow[] = [
  {
    id: "o1",
    order_number: "ORD-20260806-0001",
    customer_id: "cu1",
    status: "completed",
    total_amount: 35.97,
    created_at: "2026-08-06T09:30:00Z",
  },
  {
    id: "o2",
    order_number: "ORD-20260806-0002",
    customer_id: "cu1",
    status: "cancelled",
    total_amount: 12.99,
    created_at: "2026-08-06T10:00:00Z",
  },
  {
    id: "o3",
    order_number: "ORD-20260807-0001",
    customer_id: "cu2",
    status: "pending",
    total_amount: 9.99,
    created_at: "2026-08-07T11:00:00Z",
  },
];

function makeMock(customerRows: CustomerRow[] = [ada, grace]) {
  return createMockSupabase({
    customers: customerRows,
    orders,
  });
}

describe("listCustomers (ticket 11)", () => {
  it("computes live order counts and totals, excluding cancelled orders", async () => {
    const mock = makeMock();
    const rows = await listCustomers(toClient(mock));

    const adaRow = rows.find((row) => row.id === "cu1")!;
    // o1 counts; o2 is cancelled and excluded from BOTH count and total.
    expect(adaRow.orderCount).toBe(1);
    expect(adaRow.totalSpent).toBeCloseTo(35.97, 2);

    const graceRow = rows.find((row) => row.id === "cu2")!;
    expect(graceRow.orderCount).toBe(1);
    expect(graceRow.totalSpent).toBeCloseTo(9.99, 2);
  });

  it("gives customers with no orders zeroes instead of omitting them", async () => {
    const mock = makeMock([ada]);
    const rows = await listCustomers(toClient(mock));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderCount: 1, totalSpent: 35.97 });
  });

  it("aggregates update at query time as orders change (no stored counters)", async () => {
    const mock = makeMock();
    // A new order for Grace…
    mock.db.orders!.push({
      id: "o4",
      order_number: "ORD-20260807-0002",
      customer_id: "cu2",
      status: "confirmed",
      total_amount: 19.99,
      created_at: "2026-08-07T12:00:00Z",
    });
    // …and Ada's completed order gets cancelled.
    mock.db.orders!.find((o) => o.id === "o1")!.status = "cancelled";

    const rows = await listCustomers(toClient(mock));
    const adaRow = rows.find((row) => row.id === "cu1")!;
    const graceRow = rows.find((row) => row.id === "cu2")!;

    expect(adaRow.orderCount).toBe(0);
    expect(adaRow.totalSpent).toBe(0);
    expect(graceRow.orderCount).toBe(2);
    expect(graceRow.totalSpent).toBeCloseTo(9.99 + 19.99, 2);
  });

  it("searches by name and email", async () => {
    const mock = makeMock();
    expect((await listCustomers(toClient(mock), { q: "grace" })).map((r) => r.id)).toEqual(["cu2"]);
    expect((await listCustomers(toClient(mock), { q: "ADA@" })).map((r) => r.id)).toEqual(["cu1"]);
    expect(await listCustomers(toClient(mock), { q: "nobody" })).toHaveLength(0);
  });

  it("sorts by name (default), newest, order count, and total spent", async () => {
    const mock = makeMock();
    mock.db.orders!.push({
      id: "o5",
      order_number: "ORD-20260807-0003",
      customer_id: "cu2",
      status: "completed",
      total_amount: 89.99,
      created_at: "2026-08-07T13:00:00Z",
    });

    expect((await listCustomers(toClient(mock), { sort: "name" })).map((r) => r.id)).toEqual(["cu1", "cu2"]);
    expect((await listCustomers(toClient(mock), { sort: "newest" })).map((r) => r.id)).toEqual(["cu2", "cu1"]);
    expect((await listCustomers(toClient(mock), { sort: "orders" })).map((r) => r.id)).toEqual(["cu2", "cu1"]);
    expect((await listCustomers(toClient(mock), { sort: "spent" })).map((r) => r.id)).toEqual(["cu2", "cu1"]);
  });

  it("returns an empty list when the customer query fails", async () => {
    const mock = makeMock();
    mock.failNext({ op: "select", table: "customers" });
    expect(await listCustomers(toClient(mock))).toEqual([]);
  });
});

describe("getCustomerDetail (ticket 11)", () => {
  it("returns the customer with their full order history and active-only aggregates", async () => {
    const mock = makeMock();
    const detail = await getCustomerDetail(toClient(mock), "cu1");

    expect(detail).not.toBeNull();
    if (!detail) return;
    expect(detail).toMatchObject({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      orderCount: 1,
      totalSpent: 35.97,
    });
    // History includes the cancelled order (with its badge-worthy status);
    // aggregates exclude it.
    expect(detail.orders.map((order) => order.status)).toEqual([
      "cancelled",
      "completed",
    ]);
    expect(detail.orders[0]).toMatchObject({
      orderNumber: "ORD-20260806-0002",
      totalAmount: 12.99,
    });
  });

  it("returns null when the customer is missing", async () => {
    const mock = makeMock();
    expect(await getCustomerDetail(toClient(mock), "missing")).toBeNull();
  });
});
