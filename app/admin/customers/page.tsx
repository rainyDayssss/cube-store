import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_SORTS,
  listCustomers,
  type CustomerSort,
} from "@/features/admin/lib/customers/customers";
import { CustomersManager } from "@/features/admin/components/customers-manager";

export const metadata: Metadata = {
  title: "Customers — Cube Store Admin",
  description: "Customer list with live order counts and total spend.",
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const activeSort = (CUSTOMER_SORTS.includes(sort as CustomerSort)
    ? sort
    : "name") as CustomerSort;

  const supabase = await createClient();
  const customers = await listCustomers(supabase, { sort: activeSort });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-muted-foreground">
          Order counts and total spend are computed live — cancelled orders are
          excluded from both.
        </p>
      </div>

      <CustomersManager initialCustomers={customers} initialSort={activeSort} />
    </div>
  );
}
