"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    title: "New Arrivals",
    description: "Fresh speed cubes and puzzles just landed in the store.",
    gradient: "from-blue-900/80 to-indigo-900/80",
    image: "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=1200&h=400&fit=crop",
  },
  {
    title: "Summer Sale",
    description: "Up to 20% off selected cubes — limited time only.",
    gradient: "from-amber-900/80 to-orange-900/80",
    image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&h=400&fit=crop",
  },
  {
    title: "Collectors Edition",
    description: "Premium puzzles for the serious enthusiast.",
    gradient: "from-emerald-900/80 to-teal-900/80",
    image: "https://images.unsplash.com/photo-1560343776-97e7d202ff0e?w=1200&h=400&fit=crop",
  },
];

export function PromoCarousel() {
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

  function prev() {
    setCurrent((i) => (i - 1 + SLIDES.length) % SLIDES.length);
    startAutoplay();
  }

  function next() {
    setCurrent((i) => (i + 1) % SLIDES.length);
    startAutoplay();
  }

  return (
    <section
      aria-label="Promotions"
      className="mx-auto w-full max-w-5xl px-5 py-8"
    >
      <div className="relative overflow-hidden rounded-2xl">
        {/* Slides */}
        <div className="relative h-48 sm:h-64">
          {SLIDES.map((slide, index) => (
            <div
              key={index}
              aria-hidden={index !== current}
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cover bg-center px-6 text-center text-white transition-opacity duration-500",
                index === current ? "opacity-100" : "opacity-0",
              )}
              style={{ backgroundImage: `url(${slide.image})` }}
            >
              {/* Gradient overlay for text readability */}
              <div className={cn("absolute inset-0 bg-gradient-to-br", slide.gradient)} />
              <div className="relative z-10">
                <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {slide.title}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/90 sm:text-base">
                  {slide.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Arrows */}
        <button
          type="button"
          onClick={prev}
          aria-label="Previous promotion"
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white transition-colors hover:bg-black/50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next promotion"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white transition-colors hover:bg-black/50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === current ? "true" : undefined}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                index === current
                  ? "bg-white"
                  : "bg-white/50 hover:bg-white/75",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
