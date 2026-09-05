// SPDX-License-Identifier: AGPL-3.0-or-later
// render/palette — the colours, and the ratios that were measured rather than hoped for.
//
// ========================= CHOSEN ON LUMINANCE, NOT ON HUE =========================
// Every distinction here is carried by a large luminance gap first and a hue difference second.
// That ordering is the safety net: the colour-vision matrices barely move a luminance gap, which
// is why the table below is nearly flat across protanopia, deuteranopia and tritanopia. A palette
// that separated by hue would score beautifully in normal vision and collapse in one of them.
//
// ========================= THE UNLIT TILE WAS A REAL FAILURE =========================
// ⚠️ Spike 0 measured the provisional mat colour #2E3B4E at 1.58:1 against the background — well
// under the 3:1 floor of WCAG 1.4.11 for non-text. On screen the mat DISSOLVED into the ground
// and a player could not see where the unplayed tiles were. It reads as a moody backdrop in a
// screenshot, which is exactly why it survived until something measured it.
//
// #686878 came out of tests/palette-search.cjs, which sweeps the blue-grey family and keeps only
// what clears 3:1 on BOTH sides — against the ground and against the lit tile — in normal vision
// and in all three simulations. 423 colours qualified; this is the one whose weakest link is
// highest, because a mat that screams against the ground while barely separating from the lit
// tile has spent its whole budget on the wrong distinction.
//
//   mode      ink/lit   lit/unlit   unlit/ground
//   normal      12.77        3.77           3.51
//   protan      12.19        3.53           3.53
//   deuter      13.14        3.91           3.51
//   tritan      12.22        3.60           3.52
//
// Re-run the search rather than trusting the table; tests/palette.node.test.ts asserts it.
//
// ========================= AND COLOUR IS NEVER THE ONLY CHANNEL =========================
// A lit tile also RISES (render/mat). Height is the non-colour channel WCAG 1.4.1 asks for, it is
// the mole leaving its hole, and it replaces the original's blink — which is a photosensitivity
// risk under WCAG 2.3.1. The contrast below is the second channel, not the first.

export const GROUND = '#0B0F14';
/** An unlit tile: on the mat, not in play. */
export const TILE_IDLE = '#686878';
/** A lit tile: in play, and risen. */
export const TILE_LIT = '#F2D479';
/** The number on a lit tile. */
export const INK = '#1A1206';

/**
 * Stroke width in world units.
 *
 * Carried from the chess game's measured knee. Canvas2D antialiases every path and gives no way
 * to turn it off, so a hairline stroke is a grey smudge rather than an edge; the stroke is drawn
 * in the tile's OWN fill colour, which makes it a hard edge on an antialiased fill rather than a
 * grid line.
 */
export const STROKE = 1.5;

/** Floors this palette is held to. Non-text contrast, WCAG 1.4.11. */
export const CONTRAST_FLOOR = 3;
/** What the glyph clears, and by a wide margin: WCAG 1.4.6, enhanced. */
export const TEXT_CONTRAST_TARGET = 7;

export type Rgb = readonly [number, number, number];

export function rgbOf(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance, per the WCAG 2.x definition. */
export function relativeLuminance(rgb: Rgb): number {
  const channel = (v: number): number => {
    const s = Math.min(255, Math.max(0, v)) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** Contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
