import { redirect } from "next/navigation";
import { AdminNav } from "@/features/admin/components/admin-nav";
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
      <AdminNav />
      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
