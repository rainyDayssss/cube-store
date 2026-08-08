import { describe, expect, it } from "vitest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase, type MockSupabase } from "@/lib/testing/mock-supabase";
import {
  compressImage,
  createProductWithImage,
  deleteProductWithImage,
  imagePathFromUrl,
  IMAGE_MAX_DIMENSION,
  PRODUCT_IMAGE_BUCKET,
  removeProductImage,
  updateProductWithImage,
  uploadProductImage,
} from "./images";
import type { ProductInput } from "./products";

const toClient = (mock: MockSupabase) => mock as unknown as SupabaseClient;

const BUCKET_URL = (path: string) =>
  `https://mock.supabase.co/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${path}`;

const input: ProductInput = {
  name: "Gan 356 M",
  description: "Magnetic",
  price: 39.99,
  stock_quantity: 12,
  status: "active",
  category_id: "c1",
  image_url: "",
};

/** Builds a real PNG File in memory so `sharp` has something to re-encode. */
async function makePng(width = 200, height = 100): Promise<File> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();
  // Copy into a plain Uint8Array — Buffer is not assignable to BlobPart.
  return new File([new Uint8Array(buffer)], "test.png", { type: "image/png" });
}

describe("compressImage (ADR-0008)", () => {
  it("re-encodes to WebP within the max dimension", async () => {
    const file = await makePng(3200, 1600);
    const output = await compressImage(file);

    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
      IMAGE_MAX_DIMENSION,
    );
    expect(meta.width).toBe(1600); // 3200x1600 -> capped on the longest edge
    expect(meta.height).toBe(800);
  });

  it("never upscales small images", async () => {
    const file = await makePng(64, 64);
    const output = await compressImage(file);

    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(64);
  });
});

describe("imagePathFromUrl", () => {
  it("extracts a bucket path from a public URL", () => {
    expect(imagePathFromUrl(BUCKET_URL("products/abc.webp"))).toBe(
      "products/abc.webp",
    );
  });

  it("returns null for anything outside our bucket", () => {
    expect(imagePathFromUrl("https://picsum.photos/seed/cube-3x3/800/800")).toBeNull();
    expect(
      imagePathFromUrl(
        "https://mock.supabase.co/storage/v1/object/public/other-bucket/products/abc.webp",
      ),
    ).toBeNull();
    expect(imagePathFromUrl("not a url")).toBeNull();
    expect(imagePathFromUrl(null)).toBeNull();
    expect(imagePathFromUrl("")).toBeNull();
  });
});

describe("uploadProductImage (ADR-0008)", () => {
  it("uploads a compressed WebP and returns its public URL", async () => {
    const supabase = createMockSupabase();
    const result = await uploadProductImage(toClient(supabase), await makePng());

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.url).toMatch(
      new RegExp(`/object/public/${PRODUCT_IMAGE_BUCKET}/products/[a-f0-9-]+\\.webp$`),
    );

    const objects = supabase.storageObjects[PRODUCT_IMAGE_BUCKET];
    expect(objects).toHaveLength(1);
    expect(objects[0].name).toMatch(/^products\/.+\.webp$/);
    expect(objects[0].contentType).toBe("image/webp");
  });

  it("rejects files that fail client-side validation", async () => {
    const supabase = createMockSupabase();
    const gif = new File([new Uint8Array([1, 2, 3])], "x.gif", { type: "image/gif" });
    const result = await uploadProductImage(toClient(supabase), gif);

    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/JPG, PNG, or WebP/i);
    expect(supabase.storageObjects[PRODUCT_IMAGE_BUCKET]).toBeUndefined();
  });

  it("surfaces a storage upload failure", async () => {
    const supabase = createMockSupabase();
    supabase.failNext({ op: "storage-upload", table: PRODUCT_IMAGE_BUCKET });

    const result = await uploadProductImage(toClient(supabase), await makePng());
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/Upload failed/i);
  });
});

describe("removeProductImage (ADR-0008)", () => {
  it("removes an object that lives in our bucket", async () => {
    const supabase = createMockSupabase();
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload("products/abc.webp", new Uint8Array([1]));

    await removeProductImage(toClient(supabase), BUCKET_URL("products/abc.webp"));
    expect(supabase.storageObjects[PRODUCT_IMAGE_BUCKET]).toEqual([]);
  });

  it("never touches URLs outside our bucket (seed images, foreign buckets)", async () => {
    const supabase = createMockSupabase();
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload("products/abc.webp", new Uint8Array([1]));

    await removeProductImage(toClient(supabase), "https://picsum.photos/seed/cube-3x3/800/800");
    expect(supabase.storageObjects[PRODUCT_IMAGE_BUCKET]).toHaveLength(1);
  });

  it("is best-effort when storage removal fails — never throws", async () => {
    const supabase = createMockSupabase();
    supabase.failNext({ op: "storage-remove", table: PRODUCT_IMAGE_BUCKET });

    await expect(
      removeProductImage(toClient(supabase), BUCKET_URL("products/abc.webp")),
    ).resolves.toBeUndefined();
  });
});

describe("createProductWithImage", () => {
  it("uploads the image and creates the product pointing at its URL", async () => {
    const supabase = createMockSupabase({ products: [], categories: [] });
    const result = await createProductWithImage(
      toClient(supabase),
      input,
      await makePng(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.image_url).toContain(`/public/${PRODUCT_IMAGE_BUCKET}/`);
    expect(supabase.db.products).toHaveLength(1);
    expect(supabase.storageObjects[PRODUCT_IMAGE_BUCKET]).toHaveLength(1);
  });

  it("fails without creating a product when the image upload fails", async () => {
    const supabase = createMockSupabase({ products: [], categories: [] });
    supabase.failNext({ op: "storage-upload", table: PRODUCT_IMAGE_BUCKET });

    const result = await createProductWithImage(toClient(supabase), input, await makePng());
    expect(result.ok).toBe(false);
    expect(supabase.db.products).toHaveLength(0);
  });

  it("removes the uploaded object when the DB insert fails (no orphan)", async () => {
    const supabase = createMockSupabase({ products: [], categories: [] });
    supabase.failNext({ op: "insert", table: "products" });

    const result = await createProductWithImage(toClient(supabase), input, await makePng());
    expect(result.ok).toBe(false);
    expect(supabase.db.products).toHaveLength(0);
    expect(supabase.storageObjects[PRODUCT_IMAGE_BUCKET]).toEqual([]);
  });
});

describe("updateProductWithImage (ADR-0008)", () => {
  const row = {
    id: "p1",
    name: "3x3 Speed Cube",
    description: "Classic",
    price: 12.99,
    stock_quantity: 50,
    image_url: BUCKET_URL("products/old.webp"),
    status: "active",
    category_id: "c1",
    created_at: "2026-01-01T00:00:00Z",
  };

  it("replaces the image and best-effort removes the old object", async () => {
    const supabase = createMockSupabase({ products: [row] });
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload("products/old.webp", new Uint8Array([1]));

    const result = await updateProductWithImage(
      toClient(supabase),
      "p1",
      input,
      await makePng(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.image_url).toMatch(/\.webp$/);
    expect(result.product.image_url).not.toBe(row.image_url);
    // Old object removed; exactly the new one remains.
    const objects = supabase.storageObjects[PRODUCT_IMAGE_BUCKET];
    expect(objects).toHaveLength(1);
    expect(objects[0].name).not.toBe("products/old.webp");
  });

  it("keeps the existing image when no new file is provided", async () => {
    const supabase = createMockSupabase({ products: [row] });
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload("products/old.webp", new Uint8Array([1]));

    const result = await updateProductWithImage(toClient(supabase), "p1", input, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.image_url).toBe(row.image_url);
    expect(supabase.storageObjects[PRODUCT_IMAGE_BUCKET]).toHaveLength(1); // untouched
  });

  it("rejects an update that would blank the image (DB has none, no new file)", async () => {
    const supabase = createMockSupabase({ products: [{ ...row, image_url: "" }] });

    const result = await updateProductWithImage(toClient(supabase), "p1", input, null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/image/i);
  });

  it("still saves when removal of the old image fails (best-effort)", async () => {
    const supabase = createMockSupabase({ products: [row] });
    supabase.failNext({ op: "storage-remove", table: PRODUCT_IMAGE_BUCKET });

    const result = await updateProductWithImage(
      toClient(supabase),
      "p1",
      input,
      await makePng(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.image_url).not.toBe(row.image_url);
  });
});

describe("deleteProductWithImage (ADR-0008)", () => {
  const row = {
    id: "p1",
    name: "3x3 Speed Cube",
    description: "Classic",
    price: 12.99,
    stock_quantity: 50,
    image_url: BUCKET_URL("products/abc.webp"),
    status: "active",
    category_id: "c1",
    created_at: "2026-01-01T00:00:00Z",
  };

  it("deletes the product and its image object", async () => {
    const supabase = createMockSupabase({ products: [row] });
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload("products/abc.webp", new Uint8Array([1]));

    const result = await deleteProductWithImage(toClient(supabase), "p1");

    expect(result).toEqual({ ok: true });
    expect(supabase.db.products).toEqual([]);
    expect(supabase.storageObjects[PRODUCT_IMAGE_BUCKET]).toEqual([]);
  });

  it("does not touch external (seed) image URLs on delete", async () => {
    const supabase = createMockSupabase({
      products: [{ ...row, image_url: "https://picsum.photos/seed/cube-3x3/800/800" }],
    });
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload("products/abc.webp", new Uint8Array([1]));

    const result = await deleteProductWithImage(toClient(supabase), "p1");

    expect(result).toEqual({ ok: true });
    expect(supabase.db.products).toEqual([]);
    expect(supabase.storageObjects[PRODUCT_IMAGE_BUCKET]).toHaveLength(1); // untouched
  });

  it("still deletes the product when image removal fails (best-effort)", async () => {
    const supabase = createMockSupabase({ products: [row] });
    supabase.failNext({ op: "storage-remove", table: PRODUCT_IMAGE_BUCKET });

    const result = await deleteProductWithImage(toClient(supabase), "p1");

    expect(result).toEqual({ ok: true });
    expect(supabase.db.products).toEqual([]);
  });
});
