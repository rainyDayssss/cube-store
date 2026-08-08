import { describe, expect, it } from "vitest";
import { createMockSupabase } from "./mock-supabase";

type Product = {
  id: string;
  name: string;
  status: string;
  price: number;
  stock_quantity: number;
};

const products: Product[] = [
  { id: "p1", name: "3x3 Speed Cube", status: "active", price: 12.99, stock_quantity: 50 },
  { id: "p2", name: "2x2 Mini Cube", status: "active", price: 8.99, stock_quantity: 0 },
  { id: "p3", name: "Gold Cube", status: "inactive", price: 89.99, stock_quantity: 5 },
];

describe("mock supabase harness", () => {
  it("selects rows and applies eq filters", async () => {
    const supabase = createMockSupabase({ products });
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active");

    expect(error).toBeNull();
    expect((data as Product[]).map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("supports range comparison filters (gt/gte/lt/lte)", async () => {
    const supabase = createMockSupabase({ products });

    const inStock = await supabase.from("products").select("id").gt("stock_quantity", 0);
    expect((inStock.data as { id: string }[]).map((p) => p.id)).toEqual(["p1", "p3"]);

    const affordable = await supabase.from("products").select("id").lte("price", 10);
    expect((affordable.data as { id: string }[]).map((p) => p.id)).toEqual(["p2"]);

    const pricey = await supabase.from("products").select("id").gte("price", 50);
    expect((pricey.data as { id: string }[]).map((p) => p.id)).toEqual(["p3"]);

    const cheap = await supabase.from("products").select("id").lt("price", 10);
    expect((cheap.data as { id: string }[]).map((p) => p.id)).toEqual(["p2"]);
  });

  it("supports neq and in filters", async () => {
    const supabase = createMockSupabase({ products });

    const notActive = await supabase.from("products").select("id").neq("status", "active");
    expect((notActive.data as { id: string }[]).map((p) => p.id)).toEqual(["p3"]);

    const subset = await supabase.from("products").select("id").in("id", ["p1", "p3"]);
    expect((subset.data as { id: string }[]).map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("searches with ilike and returns copies, not live rows", async () => {
    const supabase = createMockSupabase({ products });
    const { data } = await supabase.from("products").select("*").ilike("name", "%cube%");

    expect((data as Product[]).map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    (data as Product[])[0].name = "mutated";
    expect(supabase.db.products[0].name).toBe("3x3 Speed Cube");
  });

  it("orders, limits, and ranges", async () => {
    const supabase = createMockSupabase({ products });
    const cheapest = await supabase
      .from("products")
      .select("*")
      .order("price", { ascending: true })
      .limit(2);
    expect((cheapest.data as Product[]).map((p) => p.id)).toEqual(["p2", "p1"]);

    const priciest = await supabase
      .from("products")
      .select("*")
      .order("price", { ascending: false })
      .range(0, 1);
    expect((priciest.data as Product[]).map((p) => p.id)).toEqual(["p3", "p1"]);
  });

  it("single returns the row and errors with PGRST116 when absent", async () => {
    const supabase = createMockSupabase({ products });
    const found = await supabase.from("products").select("*").eq("id", "p1").single();
    expect(found.error).toBeNull();
    expect((found.data as Product).name).toBe("3x3 Speed Cube");

    const missing = await supabase.from("products").select("*").eq("id", "nope").single();
    expect(missing.data).toBeNull();
    expect(missing.error?.code).toBe("PGRST116");
  });

  it("maybeSingle returns null without error when absent", async () => {
    const supabase = createMockSupabase({ products });
    const result = await supabase.from("products").select("*").eq("id", "nope").maybeSingle();
    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it("projects selected columns", async () => {
    const supabase = createMockSupabase({ products });
    const { data } = await supabase.from("products").select("id,name").eq("id", "p1").single();
    expect(data).toEqual({ id: "p1", name: "3x3 Speed Cube" });
  });

  it("inserts rows and returns them when .select() is chained", async () => {
    const supabase = createMockSupabase();
    const { data, error } = await supabase
      .from("customers")
      .insert({ full_name: "Ada Lovelace", email: "ada@example.com" })
      .select("*")
      .single();

    expect(error).toBeNull();
    expect((data as { email: string }).email).toBe("ada@example.com");
    expect(supabase.db.customers).toHaveLength(1);
  });

  it("updates matching rows", async () => {
    const supabase = createMockSupabase({ products });
    const { data } = await supabase
      .from("products")
      .update({ status: "inactive" })
      .eq("id", "p2")
      .select("id,status");

    expect((data as { id: string }[])[0].id).toBe("p2");
    expect(supabase.db.products.find((p) => p.id === "p2")?.status).toBe("inactive");
  });

  it("deletes matching rows and can return them with .select()", async () => {
    const supabase = createMockSupabase({ products });
    const { data } = await supabase.from("products").delete().eq("id", "p3").select("id,name");
    expect((data as { id: string }[])[0].id).toBe("p3");
    expect(supabase.db.products.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("injects failures for failure-path tests and leaves no rows behind", async () => {
    const supabase = createMockSupabase({ products });
    supabase.failNext({ op: "insert", table: "customers" });
    const { data, error } = await supabase.from("customers").insert({ full_name: "Ada" });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(supabase.db.customers).toBeUndefined();
  });

  it("mocks RPCs and rejects unmocked ones", async () => {
    const supabase = createMockSupabase();
    supabase.mockRpc("get_order_status", () => ({ status: "pending" }));

    const handled = await supabase.rpc("get_order_status", { order_number: "ORD-20260804-0001" });
    expect(handled.error).toBeNull();
    expect(handled.data).toEqual({ status: "pending" });

    const unmocked = await supabase.rpc("place_order", {});
    expect(unmocked.data).toBeNull();
    expect(unmocked.error?.message).toContain("place_order");
  });
});
