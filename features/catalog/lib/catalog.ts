import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductStatus = "active" | "inactive";

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  image_url: string;
  status: ProductStatus;
  category_id: string | null;
};

export const PRODUCT_COLUMNS =
  "id, name, description, price, stock_quantity, image_url, status, category_id";

export type CatalogSort = "newest" | "price-asc" | "price-desc";

/** The raw URL query shape of the /products listing, as Next passes it. */
export type ProductsSearchParams = {
  q?: string;
  category?: string;
  sort?: string;
  page?: string;
};

/** Type guard for URL-driven sort values — usable from server and client. */
export function isValidSort(
  value: string | null | undefined,
): value is CatalogSort {
  return value === "price-asc" || value === "price-desc";
}

/**
 * Catalog queries for the storefront. These are the read side of the single
 * testing seam: they take a Supabase client, so tests pass the mocked client
 * from `lib/testing/mock-supabase`.
 */

export async function getFeaturedCategories(client: SupabaseClient): Promise<Category[]> {
  const { data, error } = await client.from("categories").select("id, name, slug").order("name");

  if (error) return [];
  return (data ?? []) as Category[];
}

/**
 * Featured Products = the most recently added active Products. There is no
 * `featured` flag in the schema; "latest active" is the derivation used until
 * curation is needed.
 */
export async function getFeaturedProducts(
  client: SupabaseClient,
  limit = 4,
): Promise<Product[]> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .order("stock_quantity", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as Product[];
}

export type CatalogParams = {
  /** Free-text search against the product name. */
  q?: string;
  /** Filter to a single Category by id. */
  categoryId?: string | null | undefined;
  sort?: CatalogSort;
  /** 1-based page number. */
  page?: number;
  pageSize?: number;
};

export type CatalogResult = {
  products: Product[];
  /** Total rows matching the filters, before pagination (PostgREST `count`). */
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * The storefront catalog grid (ticket 03): active products only, with name
 * search, a Category filter, price sorting, and pagination — all composed in
 * one query so the URL state maps 1:1 to the result. Availability is derived
 * from `stock_quantity`; status is never used to hide stock.
 */
export async function searchCatalog(
  client: SupabaseClient,
  params: CatalogParams = {},
): Promise<CatalogResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.max(1, Math.floor(params.pageSize ?? 12));
  const sort: CatalogSort = isValidSort(params.sort) ? params.sort : "newest";
  const q = params.q?.trim();

  let query = client
    .from("products")
    .select(PRODUCT_COLUMNS, {
      count: "exact",
    })
    .eq("status", "active");

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }

  if (sort === "price-asc") {
    query = query.order("price", { ascending: true }).order("stock_quantity", { ascending: false });
  } else if (sort === "price-desc") {
    query = query.order("price", { ascending: false }).order("stock_quantity", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false }).order("stock_quantity", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  const products = error ? [] : ((data ?? []) as Product[]);
  const total = count ?? products.length;

  return {
    products,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * A single Product for the detail page. Only active Products are shown to the
 * storefront (status is visibility, stock is availability — spec); inactive or
 * unknown ids return null so the page can render its not-found state.
 */
export async function getProductById(
  client: SupabaseClient,
  id: string,
): Promise<Product | null> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("status", "active")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Product;
}

/**
 * Related Products: active Products in the same Category as the given one,
 * excluding the Product itself, newest first. Falls back to an empty list when
 * the Product has no Category or the query errors.
 */
export async function getRelatedProducts(
  client: SupabaseClient,
  categoryId: string | null,
  excludeId: string,
  limit = 4,
): Promise<Product[]> {
  if (!categoryId) return [];

  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("status", "active")
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .order("stock_quantity", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as Product[];
}
