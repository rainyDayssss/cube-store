import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import AdminGate from "@/features/admin/components/admin-gate";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/30">
          <div className="flex flex-col items-center gap-3">
            <ShieldCheck className="h-8 w-8 animate-pulse text-primary" />
            <p className="text-sm text-muted-foreground">
              Checking your session…
            </p>
          </div>
        </div>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
