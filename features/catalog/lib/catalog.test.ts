import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import {
  getFeaturedCategories,
  getFeaturedProducts,
  getProductById,
  getRelatedProducts,
  searchCatalog,
} from "./catalog";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

describe("catalog service", () => {
  it("returns categories ordered by name", async () => {
    const supabase = createMockSupabase({
      categories: [
        { id: "c2", name: "Collectibles", slug: "collectibles" },
        { id: "c1", name: "Accessories", slug: "accessories" },
      ],
    });

    const categories = await getFeaturedCategories(toClient(supabase));

    expect(categories.map((c) => c.name)).toEqual(["Accessories", "Collectibles"]);
  });

  it("returns only active products, newest first, capped at the limit", async () => {
    const supabase = createMockSupabase({
      products: [
        { id: "p1", name: "Old cube", status: "active", price: 10, stock_quantity: 5, image_url: "a", category_id: "c1", created_at: "2026-01-01T00:00:00Z" },
        { id: "p2", name: "New cube", status: "active", price: 20, stock_quantity: 0, image_url: "b", category_id: "c1", created_at: "2026-07-01T00:00:00Z" },
        { id: "p3", name: "Hidden cube", status: "inactive", price: 30, stock_quantity: 9, image_url: "c", category_id: "c2", created_at: "2026-08-01T00:00:00Z" },
      ],
    });

    const products = await getFeaturedProducts(toClient(supabase), 2);

    expect(products.map((p) => p.id)).toEqual(["p2", "p1"]);
  });

  it("returns an empty array when the query errors", async () => {
    const supabase = createMockSupabase();
    supabase.failNext({ op: "select", table: "products" });

    expect(await getFeaturedProducts(toClient(supabase))).toEqual([]);
  });

  it("returns empty arrays when tables are empty", async () => {
    const supabase = createMockSupabase({ products: [], categories: [] });

    expect(await getFeaturedProducts(toClient(supabase))).toEqual([]);
    expect(await getFeaturedCategories(toClient(supabase))).toEqual([]);
  });
});

describe("catalog search (ticket 03)", () => {
  const seed = () =>
    createMockSupabase({
      products: [
        { id: "p1", name: "3x3 Speed Cube", status: "active", price: 12.99, stock_quantity: 5, image_url: "a", category_id: "c1", created_at: "2026-01-01T00:00:00Z" },
        { id: "p2", name: "4x4 Master Cube", status: "active", price: 19.99, stock_quantity: 0, image_url: "b", category_id: "c1", created_at: "2026-02-01T00:00:00Z" },
        { id: "p3", name: "Pyraminx", status: "active", price: 9.99, stock_quantity: 3, image_url: "c", category_id: "c2", created_at: "2026-03-01T00:00:00Z" },
        { id: "p4", name: "Hidden Cube", status: "inactive", price: 5.0, stock_quantity: 9, image_url: "d", category_id: "c1", created_at: "2026-04-01T00:00:00Z" },
        { id: "p5", name: "2x2 Mini Cube", status: "active", price: 8.99, stock_quantity: 1, image_url: "e", category_id: "c1", created_at: "2026-05-01T00:00:00Z" },
      ],
    });

  it("returns only active products, newest first, with a count", async () => {
    const supabase = seed();
    const result = await searchCatalog(toClient(supabase));

    expect(result.total).toBe(4);
    expect(result.products.map((p) => p.id)).toEqual(["p5", "p3", "p2", "p1"]);
  });

  it("filters by name search (case-insensitive, substring)", async () => {
    const supabase = seed();
    const result = await searchCatalog(toClient(supabase), { q: "cube" });

    expect(result.products.map((p) => p.id)).toEqual(["p5", "p2", "p1"]);
    expect(result.total).toBe(3);
  });

  it("composes search and category filter", async () => {
    const supabase = seed();
    const result = await searchCatalog(toClient(supabase), { q: "cube", categoryId: "c1" });

    expect(result.products.map((p) => p.id)).toEqual(["p5", "p2", "p1"]);
  });

  it("sorts by price ascending and descending", async () => {
    const supabase = seed();
    const asc = await searchCatalog(toClient(supabase), { sort: "price-asc" });
    expect(asc.products.map((p) => p.price)).toEqual([8.99, 9.99, 12.99, 19.99]);

    const desc = await searchCatalog(toClient(supabase), { sort: "price-desc" });
    expect(desc.products.map((p) => p.price)).toEqual([19.99, 12.99, 9.99, 8.99]);
  });

  it("paginates with correct page windows and totalPages", async () => {
    const supabase = seed();
    const page1 = await searchCatalog(toClient(supabase), { page: 1, pageSize: 2 });
    expect(page1.products.map((p) => p.id)).toEqual(["p5", "p3"]);
    expect(page1.totalPages).toBe(2);
    expect(page1.total).toBe(4);

    const page2 = await searchCatalog(toClient(supabase), { page: 2, pageSize: 2 });
    expect(page2.products.map((p) => p.id)).toEqual(["p2", "p1"]);

    const beyond = await searchCatalog(toClient(supabase), { page: 9, pageSize: 2 });
    expect(beyond.products).toEqual([]);
    expect(beyond.totalPages).toBe(2);
  });

  it("clamps invalid pages to 1", async () => {
    const supabase = seed();
    const result = await searchCatalog(toClient(supabase), { page: -3 });
    expect(result.page).toBe(1);
  });

  it("returns an empty result on query error", async () => {
    const supabase = seed();
    supabase.failNext({ op: "select", table: "products" });

    const result = await searchCatalog(toClient(supabase));
    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });
});

describe("product details (ticket 04)", () => {
  const seed = () =>
    createMockSupabase({
      products: [
        { id: "p1", name: "3x3 Speed Cube", status: "active", price: 12.99, stock_quantity: 5, image_url: "a", category_id: "c1", created_at: "2026-01-01T00:00:00Z" },
        { id: "p2", name: "4x4 Master Cube", status: "active", price: 19.99, stock_quantity: 0, image_url: "b", category_id: "c1", created_at: "2026-02-01T00:00:00Z" },
        { id: "p3", name: "Pyraminx", status: "active", price: 9.99, stock_quantity: 3, image_url: "c", category_id: "c2", created_at: "2026-03-01T00:00:00Z" },
        { id: "p4", name: "Hidden Cube", status: "inactive", price: 5.0, stock_quantity: 9, image_url: "d", category_id: "c1", created_at: "2026-04-01T00:00:00Z" },
        { id: "p5", name: "Retro Cube", status: "active", price: 49.99, stock_quantity: 1, image_url: "e", category_id: "c1", created_at: "2026-05-01T00:00:00Z" },
      ],
    });

  it("returns an active product by id", async () => {
    const supabase = seed();
    const product = await getProductById(toClient(supabase), "p1");

    expect(product?.name).toBe("3x3 Speed Cube");
    expect(product?.stock_quantity).toBe(5);
  });

  it("returns null for an unknown id", async () => {
    const supabase = seed();
    expect(await getProductById(toClient(supabase), "nope")).toBeNull();
  });

  it("returns null for an inactive product (storefront visibility rule)", async () => {
    const supabase = seed();
    expect(await getProductById(toClient(supabase), "p4")).toBeNull();
  });

  it("returns an empty list on query error", async () => {
    const supabase = seed();
    supabase.failNext({ op: "select", table: "products" });

    expect(await getProductById(toClient(supabase), "p1")).toBeNull();
  });

  it("returns same-category active products, excluding itself, newest first", async () => {
    const supabase = seed();
    const related = await getRelatedProducts(toClient(supabase), "c1", "p1");

    expect(related.map((p) => p.id)).toEqual(["p5", "p2"]);
  });

  it("caps related products at the limit and skips inactive siblings", async () => {
    const supabase = seed();
    const related = await getRelatedProducts(toClient(supabase), "c1", "p1", 1);

    expect(related.map((p) => p.id)).toEqual(["p5"]);
    expect(related.some((p) => p.status === "inactive")).toBe(false);
  });

  it("returns an empty list when the product has no category or the query errors", async () => {
    const supabase = seed();
    expect(await getRelatedProducts(toClient(supabase), null, "p1")).toEqual([]);

    supabase.failNext({ op: "select", table: "products" });
    expect(await getRelatedProducts(toClient(supabase), "c1", "p1")).toEqual([]);
  });
});
