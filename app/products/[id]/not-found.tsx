import Link from "next/link";
import { SearchX } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { Button } from "@/components/ui/button";

export default function ProductNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader />
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <SearchX className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">
            Product not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This product may have been removed, is no longer active, or the link
            is out of date. Try browsing the full catalog instead.
          </p>
          <Button asChild className="mt-6">
            <Link href="/products">Browse all products</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
