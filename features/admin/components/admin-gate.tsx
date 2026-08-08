import { redirect } from "next/navigation";
import { AdminNav } from "@/features/admin/components/admin-nav";
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
    <div className="min-h-screen bg-muted/30">
      {/* Live updates (ADR-0011): Realtime-triggered router.refresh() so the
          open dashboard shows new orders, status moves, and customer
          aggregates without a reload. Rendered after the auth checks, so it
          never runs unauthenticated. */}
      <AdminRefresh />
      <AdminNav />
      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
