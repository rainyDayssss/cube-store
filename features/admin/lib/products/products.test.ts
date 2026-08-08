import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import {
  createProduct,
  deleteProduct,
  IMAGE_MAX_BYTES,
  listAdminProducts,
  updateProduct,
  updateProductStatus,
  validateImageFile,
  type ProductInput,
} from "./products";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

const productRows = [
  { id: "p1", name: "3x3 Speed Cube", description: "Classic", price: 12.99, stock_quantity: 50, image_url: "a", status: "active", category_id: "c1", created_at: "2026-01-01T00:00:00Z" },
  { id: "p2", name: "Pyraminx", description: null, price: 9.99, stock_quantity: 3, image_url: "b", status: "active", category_id: "c2", created_at: "2026-02-01T00:00:00Z" },
  { id: "p3", name: "Retired Cube", description: null, price: 5.0, stock_quantity: 0, image_url: "c", status: "inactive", category_id: "c1", created_at: "2026-03-01T00:00:00Z" },
];

const categories = [
  { id: "c1", name: "Speed Cubes", slug: "speed-cubes" },
  { id: "c2", name: "Puzzles", slug: "puzzles" },
];

function seed() {
  return createMockSupabase({ products: productRows, categories });
}

const input: ProductInput = {
  name: "Gan 356 M",
  description: "Magnetic",
  price: 39.99,
  stock_quantity: 12,
  status: "active",
  category_id: "c1",
  image_url: "https://example.com/gan.jpg",
};


describe("validateImageFile", () => {
  it("accepts jpg/png/webp within 5 MB", () => {
    expect(validateImageFile({ size: 1024, type: "image/jpeg" })).toBeNull();
    expect(validateImageFile({ size: IMAGE_MAX_BYTES, type: "image/png" })).toBeNull();
    expect(validateImageFile({ size: 100, type: "image/webp" })).toBeNull();
  });

  it("rejects missing, empty, wrong-type, and oversized files", () => {
    expect(validateImageFile({ size: 0, type: "image/png" })).toMatch(/empty/i);
    expect(validateImageFile({ size: 1024, type: "image/gif" })).toMatch(/JPG, PNG, or WebP/i);
    expect(validateImageFile({ size: IMAGE_MAX_BYTES + 1, type: "image/png" })).toMatch(/5 MB/i);
  });
});

describe("admin products (ticket 09)", () => {
  it("lists all products (active and inactive) with category names, newest first", async () => {
    const supabase = seed();
    const products = await listAdminProducts(toClient(supabase));

    expect(products.map((p) => p.id)).toEqual(["p3", "p2", "p1"]);
    expect(products.find((p) => p.id === "p1")).toMatchObject({
      name: "3x3 Speed Cube",
      category_name: "Speed Cubes",
      status: "active",
    });
    expect(products.find((p) => p.id === "p2")?.category_name).toBe("Puzzles");
  });

  it("filters by name search and category", async () => {
    const supabase = seed();

    const byName = await listAdminProducts(toClient(supabase), { q: "cube" });
    expect(byName.map((p) => p.id)).toEqual(["p3", "p1"]);

    const byCategory = await listAdminProducts(toClient(supabase), { categoryId: "c2" });
    expect(byCategory.map((p) => p.id)).toEqual(["p2"]);
  });

  it("creates a product", async () => {
    const supabase = createMockSupabase({ products: [], categories });
    const result = await createProduct(toClient(supabase), input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product).toMatchObject({ name: "Gan 356 M", price: 39.99 });
    expect(supabase.db.products).toHaveLength(1);
  });

  it("updates a product's fields", async () => {
    const supabase = seed();
    const result = await updateProduct(toClient(supabase), "p2", {
      ...input,
      name: "Pyraminx Duo",
      price: 11.5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product).toMatchObject({ name: "Pyraminx Duo", price: 11.5 });
    expect(supabase.db.products.find((p) => p.id === "p2")?.price).toBe(11.5);
  });

  it("toggles product status", async () => {
    const supabase = seed();
    const result = await updateProductStatus(toClient(supabase), "p1", "inactive");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.status).toBe("inactive");
    expect(supabase.db.products.find((p) => p.id === "p1")?.status).toBe("inactive");
  });

  it("deletes a product and returns its image_url", async () => {
    const supabase = seed();
    const result = await deleteProduct(toClient(supabase), "p3");

    expect(result).toEqual({ ok: true, image_url: "c" });
    expect(supabase.db.products.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("rejects an update that would blank the image (product must always have one)", async () => {
    const supabase = seed();
    const result = await updateProduct(toClient(supabase), "p2", {
      ...input,
      image_url: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/image/i);
    }
    expect(supabase.db.products.find((p) => p.id === "p2")?.image_url).toBe("b");
  });

  it("fails soft with a friendly message when a write errors", async () => {
    const supabase = seed();
    supabase.failNext({ op: "insert", table: "products" });

    const result = await createProduct(toClient(supabase), input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.length).toBeGreaterThan(0);
    expect(supabase.db.products).toHaveLength(3); // nothing inserted
  });
});
