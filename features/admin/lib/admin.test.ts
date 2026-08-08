import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import { getAdminKpis } from "./admin";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

const EMPTY = {
  totalProducts: 0,
  totalOrders: 0,
  pendingOrders: 0,
  completedOrders: 0,
  totalCustomers: 0,
  totalSales: 0,
};

function mockKpis(kpis: {
  total_products: number;
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_customers: number;
  total_sales: number;
}): MockSupabase {
  const mock = createMockSupabase();
  mock.mockRpc("get_admin_kpis", () => ({ ok: true, kpis }));
  return mock;
}

describe("admin KPIs (ticket 07)", () => {
  it("maps the six aggregates returned by the get_admin_kpis RPC", async () => {
    // The SQL itself (counts, and total_sales excluding cancelled) is verified
    // by supabase/verify-read-model.sql — this pins the TS mapping.
    const mock = mockKpis({
      total_products: 3,
      total_orders: 4,
      pending_orders: 2,
      completed_orders: 1,
      total_customers: 2,
      total_sales: 75.5,
    });

    const kpis = await getAdminKpis(toClient(mock));

    expect(kpis).toEqual({
      totalProducts: 3,
      totalOrders: 4,
      pendingOrders: 2,
      completedOrders: 1,
      totalCustomers: 2,
      totalSales: 75.5,
    });
  });

  it("reports zeroes when the store is empty", async () => {
    const mock = mockKpis({
      total_products: 0,
      total_orders: 0,
      pending_orders: 0,
      completed_orders: 0,
      total_customers: 0,
      total_sales: 0,
    });

    expect(await getAdminKpis(toClient(mock))).toEqual(EMPTY);
  });

  it("fails soft to zeroes when the RPC errors", async () => {
    const mock = createMockSupabase();
    mock.failNext({ op: "rpc", table: "get_admin_kpis" });

    expect(await getAdminKpis(toClient(mock))).toEqual(EMPTY);
  });

  it("fails soft to zeroes when the function refuses a non-admin caller", async () => {
    const mock = createMockSupabase();
    mock.mockRpc("get_admin_kpis", () => ({
      ok: false,
      message: "Admins only.",
    }));

    expect(await getAdminKpis(toClient(mock))).toEqual(EMPTY);
  });
});
