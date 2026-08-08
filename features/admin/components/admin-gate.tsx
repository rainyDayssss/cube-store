import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { AdminRefresh } from "@/features/admin/components/admin-refresh";
import { createClient } from "@/lib/supabase/server";

export default async function AdminGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (user.app_metadata?.role !== "admin") {
    redirect("/");
  }

  return (
    <AdminShell>
      {/* Live updates (ADR-0011): Realtime-triggered router.refresh() so the
          open dashboard shows new orders, status moves, and customer
          aggregates without a reload. Rendered after the auth checks, so it
          never runs unauthenticated. */}
      <AdminRefresh />
      {children}
    </AdminShell>
  );
}
