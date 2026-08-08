import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CubeFace } from "@/components/cube-face";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      {/* Faint lattice — the cube's face grid, faded toward the edges. */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 -z-20 [mask-image:radial-gradient(ellipse_55%_55%_at_50%_30%,black,transparent)]"
      />
      {/* Cobalt glow behind the headline. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-80 max-w-3xl rounded-full bg-gradient-to-b from-primary/15 to-transparent blur-3xl"
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-5 py-20 text-center sm:py-24">
        {/* The signature: a sticker face that scrambles and solves itself. */}
        <CubeFace size="md" animated />

        <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
          Fresh stock every week
        </span>

        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
          Everything you need, <span className="text-primary">cubed</span>.
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          Speed cubes, puzzles, and collectibles — curated, stocked, and ready
          to ship from the Cube Store.
        </p>

        <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/products">Shop the catalog</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Link href="/#categories">Browse by category</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
