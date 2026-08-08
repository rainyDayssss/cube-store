import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import { getCustomerDetail, listCustomers } from "./customers";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

/**
 * The list/detail reads come from the `customer_summaries` view (ADR-0012);
 * the SQL aggregation (including the cancelled-exclusion rule) is verified by
 * supabase/verify-read-model.sql. These tests seed view-shaped rows and pin
 * the TS mapping, search, and sort.
 */

type CustomerSummaryRow = {
  id: string;
  full_name: string;
  email: string;
  contact_number: string;
  account_status: string;
  created_at: string;
  order_count: number;
  total_spent: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  total_amount: number;
  created_at: string;
};

const ada: CustomerSummaryRow = {
  id: "cu1",
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  contact_number: "+63 912 345 6789",
  account_status: "active",
  created_at: "2026-08-06T09:00:00Z",
  // o1 counts (completed); o2 is cancelled and excluded by the view.
  order_count: 1,
  total_spent: 35.97,
};

const grace: CustomerSummaryRow = {
  id: "cu2",
  full_name: "Grace Hopper",
  email: "grace@example.com",
  contact_number: "+63 900 000 0000",
  account_status: "active",
  created_at: "2026-08-07T10:00:00Z",
  order_count: 1,
  total_spent: 9.99,
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

function makeMock(summaryRows: CustomerSummaryRow[] = [ada, grace]) {
  return createMockSupabase({
    customer_summaries: summaryRows,
    orders,
  });
}

describe("listCustomers (ticket 11)", () => {
  it("maps live order counts and totals from the view (cancelled already excluded)", async () => {
    const mock = makeMock();
    const rows = await listCustomers(toClient(mock));

    const adaRow = rows.find((row) => row.id === "cu1")!;
    expect(adaRow.orderCount).toBe(1);
    expect(adaRow.totalSpent).toBeCloseTo(35.97, 2);

    const graceRow = rows.find((row) => row.id === "cu2")!;
    expect(graceRow.orderCount).toBe(1);
    expect(graceRow.totalSpent).toBeCloseTo(9.99, 2);
  });

  it("maps zero aggregates for customers without orders", async () => {
    const mock = makeMock([
      { ...ada, order_count: 0, total_spent: 0 },
    ]);
    const rows = await listCustomers(toClient(mock));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderCount: 0, totalSpent: 0 });
  });

  it("searches by name and email", async () => {
    const mock = makeMock();
    expect((await listCustomers(toClient(mock), { q: "grace" })).map((r) => r.id)).toEqual(["cu2"]);
    expect((await listCustomers(toClient(mock), { q: "ADA@" })).map((r) => r.id)).toEqual(["cu1"]);
    expect(await listCustomers(toClient(mock), { q: "nobody" })).toHaveLength(0);
  });

  it("sorts by name (default), newest, order count, and total spent", async () => {
    const mock = makeMock([
      ada,
      { ...grace, order_count: 2, total_spent: 89.99 },
    ]);

    expect((await listCustomers(toClient(mock), { sort: "name" })).map((r) => r.id)).toEqual(["cu1", "cu2"]);
    expect((await listCustomers(toClient(mock), { sort: "newest" })).map((r) => r.id)).toEqual(["cu2", "cu1"]);
    expect((await listCustomers(toClient(mock), { sort: "orders" })).map((r) => r.id)).toEqual(["cu2", "cu1"]);
    expect((await listCustomers(toClient(mock), { sort: "spent" })).map((r) => r.id)).toEqual(["cu2", "cu1"]);
  });

  it("returns an empty list when the view query fails", async () => {
    const mock = makeMock();
    mock.failNext({ op: "select", table: "customer_summaries" });
    expect(await listCustomers(toClient(mock))).toEqual([]);
  });
});

describe("getCustomerDetail (ticket 11)", () => {
  it("returns the customer with their full order history and view-provided aggregates", async () => {
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
    // the aggregates (from the view) exclude it.
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
