import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import {
  createCategory,
  deleteCategory,
  listCategoriesWithCounts,
  renameCategory,
  slugify,
} from "./categories";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

describe("slugify", () => {
  it("derives URL slugs from display names", () => {
    expect(slugify("Speed Cubes")).toBe("speed-cubes");
    expect(slugify("  Pyraminx & Co.  ")).toBe("pyraminx-co");
    expect(slugify("4x4  Master Cube")).toBe("4x4-master-cube");
    expect(slugify("   ")).toBe("category");
  });
});

describe("admin categories (ticket 08)", () => {
  it("lists categories with live product counts", async () => {
    const supabase = createMockSupabase({
      categories: [
        { id: "c1", name: "Speed Cubes", slug: "speed-cubes" },
        { id: "c2", name: "Puzzles", slug: "puzzles" },
      ],
      products: [
        { id: "p1", category_id: "c1" },
        { id: "p2", category_id: "c1" },
        { id: "p3", category_id: "c2" },
        { id: "p4", category_id: null }, // uncategorised — counts nowhere
      ],
    });

    const categories = await listCategoriesWithCounts(toClient(supabase));

    expect(categories).toEqual([
      expect.objectContaining({ id: "c2", name: "Puzzles", productCount: 1 }),
      expect.objectContaining({ id: "c1", name: "Speed Cubes", productCount: 2 }),
    ]);
  });

  it("creates a category with a derived slug", async () => {
    const supabase = createMockSupabase({ categories: [] });

    const result = await createCategory(toClient(supabase), "Collectibles");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.category).toMatchObject({ name: "Collectibles", slug: "collectibles" });
    expect(supabase.db.categories).toHaveLength(1);
  });

  it("rejects duplicate names and appends a counter to colliding slugs", async () => {
    const supabase = createMockSupabase({
      categories: [{ id: "c1", name: "Speed Cubes", slug: "speed-cubes" }],
    });

    const dupName = await createCategory(toClient(supabase), "speed cubes");
    expect(dupName).toMatchObject({ ok: false });
    if (dupName.ok) return;
    expect(dupName.message).toMatch(/already exists/i);

    // A different name that slugifies to the same slug gets a -2 suffix.
    const dupSlug = await createCategory(toClient(supabase), "Speed-Cubes!");
    expect(dupSlug.ok).toBe(true);
    if (!dupSlug.ok) return;
    expect(dupSlug.category.slug).toBe("speed-cubes-2");
  });

  it("rejects an empty name", async () => {
    const supabase = createMockSupabase({ categories: [] });

    expect(await createCategory(toClient(supabase), "   ")).toMatchObject({
      ok: false,
    });
  });

  it("renames a category and re-derives its slug", async () => {
    const supabase = createMockSupabase({
      categories: [{ id: "c1", name: "Speed Cubes", slug: "speed-cubes" }],
    });

    const result = await renameCategory(toClient(supabase), "c1", "Blindfold Cubes");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.category).toMatchObject({ name: "Blindfold Cubes", slug: "blindfold-cubes" });
    expect(supabase.db.categories[0]).toMatchObject({
      name: "Blindfold Cubes",
      slug: "blindfold-cubes",
    });
  });

  it("blocks a rename onto another category's name", async () => {
    const supabase = createMockSupabase({
      categories: [
        { id: "c1", name: "Speed Cubes", slug: "speed-cubes" },
        { id: "c2", name: "Puzzles", slug: "puzzles" },
      ],
    });

    const result = await renameCategory(toClient(supabase), "c1", "puzzles");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/already has that name/i);
  });

  it("deletes an unreferenced category", async () => {
    const supabase = createMockSupabase({
      categories: [
        { id: "c1", name: "Speed Cubes", slug: "speed-cubes" },
        { id: "c2", name: "Empty", slug: "empty" },
      ],
      products: [{ id: "p1", category_id: "c1" }],
    });

    const result = await deleteCategory(toClient(supabase), "c2");

    expect(result).toEqual({ ok: true });
    expect(supabase.db.categories.map((c) => c.id)).toEqual(["c1"]);
  });

  it("blocks deleting a category that still has products", async () => {
    const supabase = createMockSupabase({
      categories: [{ id: "c1", name: "Speed Cubes", slug: "speed-cubes" }],
      products: [{ id: "p1", category_id: "c1" }],
    });

    const result = await deleteCategory(toClient(supabase), "c1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/still has 1 product/i);
    expect(supabase.db.categories).toHaveLength(1);
  });

  it("maps a database FK violation (23503) to the same friendly guard", async () => {
    const supabase = createMockSupabase({
      categories: [{ id: "c1", name: "Speed Cubes", slug: "speed-cubes" }],
      products: [], // pre-check passes — the DB itself rejects the delete
    });
    // Simulate the ON DELETE RESTRICT race: a product appears after the
    // pre-check, and the delete is rejected by the database.
    supabase.failNext({
      op: "delete",
      table: "categories",
      error: { code: "23503", message: 'update or delete on table "categories" violates foreign key constraint' },
    });

    const result = await deleteCategory(toClient(supabase), "c1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/still has products/i);
  });
});
