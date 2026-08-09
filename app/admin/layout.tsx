import { Suspense } from "react";
import { CubeFace } from "@/components/cube-face";
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
          <div className="flex flex-col items-center gap-4">
            <CubeFace size="md" animated />
            <p className="text-sm text-muted-foreground">
              Loading dashboard…
            </p>
          </div>
        </div>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
