import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import {
  getFeaturedCategories,
  isValidSort,
  searchCatalog,
  type ProductsSearchParams,
} from "@/features/catalog/lib/catalog";
import { ProductCard } from "@/features/catalog/components/product-card";
import { CatalogToolbar } from "@/features/catalog/components/catalog-toolbar";

const PAGE_SIZE = 12;

/**
 * The `page` query param as a valid 1-based page number: missing, blank,
 * non-numeric, or below-1 values all fall back to 1.
 */
function toPage(raw: string | undefined): number {
  const page = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(page) && page >= 1 ? page : 1;
}

export async function CatalogGrid({
  searchParams,
}: {
  searchParams: Promise<ProductsSearchParams>;
}) {
  if (!hasEnvVars) {
    return <SetupHint />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  // URL state maps 1:1 to the query: sort falls back to "newest", page to 1.
  const requestedPage = toPage(params.page);
  const sort = isValidSort(params.sort) ? params.sort : "newest";
  const categorySlugSpecified = Boolean(params.category);

  // Categories are needed both for the filter dropdown and to resolve the
  // `category` slug (from the URL) into the id the products table uses, so
  // they are fetched first and the search then scopes by category in one query.
  const categories = await getFeaturedCategories(supabase);
  const activeCategory =
    categories.find((c) => c.slug === params.category) ?? null;

  // An unknown category slug in the URL is a real filter, just one that
  // matches nothing — render the empty state rather than silently dropping it.
  if (categorySlugSpecified && !activeCategory) {
    return (
      <CatalogFrame
        categories={categories}
        totalLabel="Category not found"
        toolbar
        empty={
          <EmptyResults
            hasQuery={Boolean(params.q)}
            hasCategory={false}
            title="That category doesn't exist."
            description="The category may have been renamed or removed. Try browsing all products instead."
          />
        }
      />
    );
  }

  const result = await searchCatalog(supabase, {
    q: params.q,
    categoryId: activeCategory?.id,
    sort,
    page: requestedPage,
    pageSize: PAGE_SIZE,
  });

  // A page number beyond the last page is a stale link/refresh — re-fetch at
  // the last page instead of showing a dead empty grid.
  const page = Math.min(requestedPage, result.totalPages);
  const clamped = page !== requestedPage;
  const effectiveResult = clamped
    ? await searchCatalog(supabase, {
        q: params.q,
        categoryId: activeCategory?.id,
        sort,
        page,
        pageSize: PAGE_SIZE,
      })
    : result;
  const { products, total, totalPages } = effectiveResult;

  return (
    <CatalogFrame
      categories={categories}
      totalLabel={
        total === 0
          ? "No products found"
          : `${total} product${total === 1 ? "" : "s"}${
              activeCategory ? ` in ${activeCategory.name}` : ""
            }`
      }
      toolbar
      empty={
        products.length === 0 ? (
          <EmptyResults
            hasQuery={Boolean(params.q)}
            hasCategory={Boolean(activeCategory)}
          />
        ) : undefined
      }
    >
      {products.length > 0 && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} categories={categories} />
            ))}
          </div>
          {totalPages > 1 && (
            <CatalogPagination
              page={page}
              totalPages={totalPages}
              searchParams={params}
            />
          )}
        </>
      )}
    </CatalogFrame>
  );
}

function CatalogFrame({
  categories,
  totalLabel,
  toolbar = false,
  empty,
  children,
}: {
  categories: Awaited<ReturnType<typeof getFeaturedCategories>>;
  totalLabel: string;
  toolbar?: boolean;
  empty?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">{totalLabel}</p>
      </div>

      {toolbar && <CatalogToolbar categories={categories} />}

      {empty ? <div className="mt-8">{empty}</div> : children}
    </div>
  );
}

function CatalogPagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: ProductsSearchParams;
}) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  function href(target: number) {
    // Rebuild the URL from the current filters, swapping in the target page.
    // Empty params and page 1 are omitted — page 1 is the implicit default.
    const urlParams = new URLSearchParams();
    if (searchParams.q) urlParams.set("q", searchParams.q);
    if (searchParams.category) urlParams.set("category", searchParams.category);
    if (isValidSort(searchParams.sort)) urlParams.set("sort", searchParams.sort);
    if (target > 1) urlParams.set("page", String(target));
    const qs = urlParams.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  const prev = page > 1 ? href(page - 1) : null;
  const next = page < totalPages ? href(page + 1) : null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-center gap-1"
    >
      {prev ? (
        <Link
          href={prev}
          className="inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Link>
      ) : (
        <span className="inline-flex h-9 cursor-not-allowed items-center gap-1 rounded-md px-3 text-sm font-medium text-muted-foreground/40">
          <ChevronLeft className="h-4 w-4" />
          Previous
        </span>
      )}

      {pages.map((target) => {
        const active = target === page;
        return (
          <Link
            key={target}
            href={href(target)}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
                : "inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            }
          >
            {target}
          </Link>
        );
      })}

      {next ? (
        <Link
          href={next}
          className="inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="inline-flex h-9 cursor-not-allowed items-center gap-1 rounded-md px-3 text-sm font-medium text-muted-foreground/40">
          Next
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

export function CatalogGridSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <div className="mb-6 space-y-2">
        <div className="h-8 w-40 animate-shimmer rounded-md" />
        <div className="h-4 w-56 animate-shimmer rounded-md" />
      </div>
      <div className="h-9 w-full animate-shimmer rounded-md" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-square animate-shimmer rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function EmptyResults({
  hasQuery,
  hasCategory,
  title,
  description,
}: {
  hasQuery: boolean;
  hasCategory: boolean;
  title?: string;
  description?: string;
}) {
  const showClear = hasQuery || hasCategory;
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <p className="text-sm font-medium">
        {title ??
          (showClear
            ? "No products match those filters."
            : "No products yet.")}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description ??
          (showClear
            ? "Try a different search term or category."
            : "Once the catalog has active Products, they will appear here.")}
      </p>
      {showClear && (
        <Link
          href="/products"
          className="mt-4 inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}

function SetupHint() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium">The catalog is waiting for Supabase.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Copy `.env.example` to `.env.local`, add your Supabase project keys, and
          apply the migrations in `supabase/migrations/` to load the seed catalog.
        </p>
      </div>
    </div>
  );
}
