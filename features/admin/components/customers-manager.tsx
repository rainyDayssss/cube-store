"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Users } from "lucide-react";
import {
  CUSTOMER_SORT_LABELS,
  CUSTOMER_SORTS,
  listCustomers,
  type CustomerSort,
  type CustomerSummary,
} from "@/features/admin/lib/customers/customers";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

/**
 * The list is small (guest checkout customers), so the manager re-fetches
 * through the seam when the sort changes — keeping the aggregates live — and
 * filters the search in memory for instant feedback.
 */
export function CustomersManager({
  initialCustomers,
  initialSort,
}: {
  initialCustomers: CustomerSummary[];
  initialSort: CustomerSort;
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [searchDraft, setSearchDraft] = useState("");
  const [sort, setSort] = useState<CustomerSort>(initialSort);
  const [refreshing, setRefreshing] = useState(false);
  // Synchronous in-flight guard: `refreshing` state applies on the next
  // render, so a rapid double-change could otherwise fire two refetches and
  // let a slower earlier response overwrite a newer one.
  const inFlightRef = useRef(false);

  async function handleSortChange(next: CustomerSort) {
    if (next === sort || inFlightRef.current) return;
    inFlightRef.current = true;
    setSort(next);
    setRefreshing(true);
    try {
      const supabase = createClient();
      setCustomers(await listCustomers(supabase, { sort: next }));
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = searchDraft.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (customer) =>
        customer.fullName.toLowerCase().includes(q) ||
        customer.email.toLowerCase().includes(q) ||
        customer.contactNumber.replace(/\s+/g, "").includes(q.replace(/\s+/g, "")),
    );
  }, [customers, searchDraft]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search by name, email, or number…"
            aria-label="Search customers"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="admin-customer-sort" className="sr-only">
            Sort customers
          </label>
          <div className="flex items-center gap-2">
            <select
              id="admin-customer-sort"
              value={sort}
              disabled={refreshing}
              onChange={(event) => void handleSortChange(event.target.value as CustomerSort)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              {CUSTOMER_SORTS.map((value) => (
                <option key={value} value={value}>
                  {CUSTOMER_SORT_LABELS[value]}
                </option>
              ))}
            </select>
            {refreshing && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {customers.length === 0 ? (
            <>
              <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
              No customers yet — they&apos;re created at checkout when guests
              place their first order.
            </>
          ) : (
            "No customers match this search."
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-background">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Total spent</th>
                <th className="px-4 py-3 font-medium">First order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {customer.fullName}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {customer.email}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {customer.contactNumber}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {customer.orderCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium">
                    {priceFormatter.format(customer.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {dateFormatter.format(new Date(customer.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Order counts and totals exclude cancelled orders (computed live, never
        stored).
      </p>
    </div>
  );
}
