"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CubeFace } from "@/components/cube-face";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    title: "New Arrivals",
    description: "Fresh puzzles, brain teasers, and desk toys just landed.",
    image: "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=1400&h=700&fit=crop",
  },
  {
    title: "Summer Sale",
    description: "Up to 20% off selected items — limited time only.",
    image: "https://images.unsplash.com/photo-1560343776-97e7d202ff0e?w=1400&h=700&fit=crop",
  },
  {
    title: "Collectors Edition",
    description: "Premium puzzles and desk objects for the serious enthusiast.",
    image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1400&h=700&fit=crop",
  },
];

export function Hero() {
  const [current, setCurrent] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoplay = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const startAutoplay = useCallback(() => {
    stopAutoplay();
    timer.current = setInterval(() => {
      setCurrent((i) => (i + 1) % SLIDES.length);
    }, 5000);
  }, [stopAutoplay]);

  useEffect(() => {
    startAutoplay();
    return () => stopAutoplay();
  }, [startAutoplay, stopAutoplay]);

  function goTo(index: number) {
    setCurrent(index);
    startAutoplay();
  }

  return (
    <section className="relative overflow-hidden">
      {/* Rotating background slides */}
      <div className="absolute inset-0 -z-30">
        {SLIDES.map((slide, index) => (
          <div
            key={index}
            aria-hidden={index !== current}
            className={cn(
              "absolute inset-0 bg-cover bg-center transition-opacity duration-1000",
              index === current
                ? "opacity-100 scale-100"
                : "opacity-0 scale-105",
            )}
            style={{
              backgroundImage: `url(${slide.image})`,
              transition: "opacity 1s ease, transform 6s ease",
            }}
          />
        ))}
      </div>

      {/* Gradient overlay — adapts to theme */}
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-background/70 via-background/40 to-background/20 dark:from-background/80 dark:via-background/60 dark:to-background/40" />

      {/* Faint lattice — the cube's face grid, faded toward the edges. */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_55%_55%_at_50%_30%,black,transparent)]"
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-5 py-12 text-center sm:py-20">
        {/* The signature: a sticker face that scrambles and solves itself. */}
        <CubeFace size="md" animated />

        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Every piece, a{" "}
          <span className="bg-gradient-to-br from-primary to-purple-600 bg-clip-text text-transparent">
            new challenge
          </span>
          .
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-foreground/70">
          Speed cubes, brain teasers, desk toys, and collectibles — curated for
          every kind of puzzler.
        </p>

        <div className="flex w-full justify-center sm:w-auto">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/products">Shop the catalog</Link>
          </Button>
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === current ? "true" : undefined}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              index === current
                ? "w-6 bg-primary"
                : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/60",
            )}
          />
        ))}
      </div>
    </section>
  );
}
