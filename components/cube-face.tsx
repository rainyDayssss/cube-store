"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SOLVED_FACE, STICKER_COLORS } from "@/components/cube-palette";

function scramble<T>(source: readonly T[]): T[] {
  const copy = [...source];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SIZES = {
  sm: { cell: "h-2.5 w-2.5", gap: "gap-[3px]", pad: "p-[3px]", radius: "rounded-md" },
  md: { cell: "h-5 w-5", gap: "gap-1", pad: "p-1", radius: "rounded-lg" },
} as const;

/**
 * A 3×3 sticker face — the store's signature mark. With `animated` it scrambles
 * a couple of times on load, then solves itself back to the ordered face
 * (skipped entirely when the user prefers reduced motion). Used in the hero as
 * the one memorable moment; chrome like the header brand mark renders it static.
 */
export function CubeFace({
  size = "md",
  animated = false,
  className,
}: {
  size?: keyof typeof SIZES;
  animated?: boolean;
  className?: string;
}) {
  const [cells, setCells] = useState(() => [...SOLVED_FACE]);
  const started = useRef(false);

  useEffect(() => {
    if (!animated || started.current) return;
    started.current = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    let steps = 0;
    const timer = setInterval(() => {
      steps += 1;
      if (steps >= 3) {
        clearInterval(timer);
        setCells([...SOLVED_FACE]);
      } else {
        setCells(scramble(SOLVED_FACE));
      }
    }, 260);
    return () => clearInterval(timer);
  }, [animated]);

  const s = SIZES[size];

  return (
    <div
      aria-hidden
      className={cn(
        "inline-grid grid-cols-3 border border-border bg-background shadow-sm",
        s.gap,
        s.pad,
        s.radius,
        className,
      )}
    >
      {cells.map((stickerIndex, index) => (
        <span
          key={index}
          className={cn("rounded-[3px]", s.cell)}
          style={{ backgroundColor: STICKER_COLORS[stickerIndex] }}
        />
      ))}
    </div>
  );
}
