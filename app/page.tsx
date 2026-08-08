import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { Hero } from "@/features/catalog/components/hero";
import { PromoCarousel } from "@/features/catalog/components/promo-carousel";
import {
  FeaturedCatalog,
  FeaturedCatalogSkeleton,
} from "@/features/catalog/components/featured-catalog";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader />
      <main className="flex-1">
        <Hero />
        <PromoCarousel />
        <Suspense fallback={<FeaturedCatalogSkeleton />}>
          <FeaturedCatalog />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
