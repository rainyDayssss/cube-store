/**
 * The store's sticker palette — the signature accent system, defined as CSS
 * variables in app/globals.css. Stickers are physical objects, so the same
 * set is used in both light and dark themes.
 */
export const STICKER_COLORS = [
  "hsl(var(--sticker-blue))",
  "hsl(var(--sticker-amber))",
  "hsl(var(--sticker-green))",
  "hsl(var(--sticker-red))",
  "hsl(var(--sticker-purple))",
];

/** The solved 3×3 face: a balanced arrangement of the five stickers. */
export const SOLVED_FACE = [0, 1, 2, 3, 4, 0, 1, 2, 3];
