import {
  Banknote,
  CheckCircle2,
  Clock3,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import { KpiCard } from "@/features/admin/components/kpi-card";
import { AdminCharts } from "@/features/admin/components/admin-charts";
import { getAdminKpis, getAdminChartData } from "@/features/admin/lib/admin";
import { createClient } from "@/lib/supabase/server";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const [kpis, chartData] = await Promise.all([
    getAdminKpis(supabase),
    getAdminChartData(supabase),
  ]);

  const cards = [
    {
      label: "Total Products",
      value: kpis.totalProducts.toLocaleString(),
      icon: Package,
    },
    {
      label: "Total Orders",
      value: kpis.totalOrders.toLocaleString(),
      icon: ShoppingCart,
    },
    {
      label: "Pending Orders",
      value: kpis.pendingOrders.toLocaleString(),
      icon: Clock3,
    },
    {
      label: "Completed Orders",
      value: kpis.completedOrders.toLocaleString(),
      icon: CheckCircle2,
    },
    {
      label: "Total Customers",
      value: kpis.totalCustomers.toLocaleString(),
      icon: Users,
    },
    {
      label: "Total Sales",
      value: currency.format(kpis.totalSales),
      icon: Banknote,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Overview of the store, updated live as Customers place orders.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <AdminCharts data={chartData} />
    </div>
  );
}
