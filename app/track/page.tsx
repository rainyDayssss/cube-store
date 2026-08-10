import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { TrackOrderForm } from "@/features/tracking/components/track-order-form";

export const metadata: Metadata = {
  title: "Track Order — Cube Store",
  description: "Track your Cube Store order status by order number.",
};

export default function TrackOrderPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-10">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Track your order
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your order number to view the current status and details.
            </p>
          </div>
          <TrackOrderForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
