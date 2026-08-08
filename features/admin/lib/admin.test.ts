import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import { getAdminKpis } from "./admin";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

describe("admin KPIs (ticket 07)", () => {
  it("aggregates live counts and sales across the store tables", async () => {
    const supabase = createMockSupabase({
      products: [
        { id: "p1", name: "Cube" },
        { id: "p2", name: "Pyraminx" },
        { id: "p3", name: "Retired", status: "inactive" },
      ],
      customers: [{ id: "c1" }, { id: "c2" }],
      orders: [
        { id: "o1", status: "pending", total_amount: 25.5 },
        { id: "o2", status: "completed", total_amount: 40.0 },
        { id: "o3", status: "cancelled", total_amount: 999.99 },
        { id: "o4", status: "pending", total_amount: 10.0 },
      ],
    });

    const kpis = await getAdminKpis(toClient(supabase));

    expect(kpis).toEqual({
      totalProducts: 3,
      totalOrders: 4,
      pendingOrders: 2,
      completedOrders: 1,
      totalCustomers: 2,
      // Cancelled order (999.99) is excluded from sales (ADR-0002).
      totalSales: 25.5 + 40.0 + 10.0,
    });
  });

  it("reports zeroes when the store is empty", async () => {
    const supabase = createMockSupabase({
      products: [],
      customers: [],
      orders: [],
    });

    const kpis = await getAdminKpis(toClient(supabase));

    expect(kpis).toEqual({
      totalProducts: 0,
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      totalCustomers: 0,
      totalSales: 0,
    });
  });

  it("excludes cancelled orders from total sales but counts them in total orders", async () => {
    const supabase = createMockSupabase({
      products: [],
      customers: [],
      orders: [
        { id: "o1", status: "cancelled", total_amount: 100 },
        { id: "o2", status: "cancelled", total_amount: 50 },
        { id: "o3", status: "shipped", total_amount: 12.34 },
      ],
    });

    const kpis = await getAdminKpis(toClient(supabase));

    expect(kpis.totalOrders).toBe(3);
    expect(kpis.totalSales).toBeCloseTo(12.34, 2);
  });

  it("fails soft to zeroes when the queries error", async () => {
    const supabase = createMockSupabase({
      products: [{ id: "p1" }],
      customers: [{ id: "c1" }],
      orders: [{ id: "o1", status: "pending", total_amount: 5 }],
    });
    supabase.failNext({ op: "select", table: "orders" });

    const kpis = await getAdminKpis(toClient(supabase));

    // The first failing query (orders count) short-circuits the parallel
    // batch only for that promise — other queries still resolve.
    expect(kpis.totalOrders).toBe(0);
    expect(kpis.totalProducts).toBe(1);
    expect(kpis.totalCustomers).toBe(1);
  });
});
