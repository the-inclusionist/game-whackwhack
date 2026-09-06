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

/* ========================= THE DDR PALETTE, AND WHAT IT COST =========================
 * The original is a Dance Dance Revolution parody and its colours are the parody: a near-black
 * aubergine ground with hot magenta over it. Keeping that was a product decision, and it is not
 * free — the numbers below are thinner than the blue-grey palette that preceded them, and saying
 * so is the point of writing them down.
 *
 * ⚠️ TWO OF THE ORIGINAL'S OWN COLOURS DO NOT SURVIVE MEASUREMENT, and both were measured before
 * being dropped rather than rejected on principle:
 *
 *   · `#0000ff`, the original's blue, is 1.27:1 against `#1C041B`. On that ground it is very
 *     nearly invisible, for everyone.
 *   · `#c933ff`, its signature magenta, is 3.69:1 against the ground — which is fine for a large
 *     title and useless for a tile. As the LIT tile it leaves no room at all: a search over the
 *     whole colour cube found ZERO idle-tile colours that clear 3:1 against both it and the
 *     ground. And a number on it tops out at 3.92:1 in pure black, below even the 4.5 floor for
 *     text, let alone the 7 this game holds itself to.
 *
 * So the magenta stays as the ACCENT — title, focus ring, HUD highlight, where it is large — and
 * the lit tile is the bright end of the same family. Measured worst case across normal vision and
 * all three colour-vision simulations:
 *
 *   number on a lit tile   10.53      (target 7, WCAG 1.4.6)
 *   lit tile vs idle        3.38      (floor 3, WCAG 1.4.11)
 *   idle tile vs ground     3.10      (floor 3, WCAG 1.4.11)
 *
 * The last two clear by a tenth where the previous palette cleared by half. That is the cost of
 * the aesthetic, it is real, and a contributor tempted to nudge any of these should re-run
 * tests/palette-search.cjs rather than guess.
 */

/** The original's own background, kept unchanged. */
export const GROUND = '#1C041B';
/** An unlit tile: on the mat, not in play. */
export const TILE_IDLE = '#8A4AA6';
/** A lit tile: in play, and risen. */
export const TILE_LIT = '#FFFFFF';
/**
 * The number on a lit tile — the GROUND colour, so the digit reads as a hole punched through the
 * tile rather than as paint laid on it. It is also what buys the 10.53:1.
 */
export const INK = '#1C041B';
/**
 * The original's signature magenta, kept for large type and focus rings.
 *
 * ⚠️ 3.69:1 against the ground. That clears the 3:1 floor for LARGE text and for a focus
 * indicator, and does NOT clear the 4.5:1 for body text. Nothing small is drawn in it.
 */
export const ACCENT = '#C933FF';

/**
 * ========================= A LIT TILE COOLS AS ITS TIME RUNS OUT =========================
 * The original animates its slab's colour over the slab's lifetime, and it is the only thing on
 * screen that says how long is left. This game had NO visual channel for that at all — the tile
 * rose and then simply vanished — so a player could only learn the deadline by losing to it.
 *
 * ⚠️ AND COLOUR IS NOT THE ONLY CHANNEL CARRYING IT. Height carries "this tile is in play" and
 * cooling carries "and not for much longer"; WCAG 1.4.1 is about not encoding information in
 * colour ALONE, and the tile also sinks as it cools. Someone who cannot see the hue shift still
 * sees the tile settle.
 *
 * ⚠️ THE TILE LIGHTS TO WHITE AND COOLS TO PINK, and that direction is not the one I built first.
 * I had it lighting to the pink and cooling to a slightly darker pink, which measured worse on
 * every axis. Starting at white is strictly better and it was the Dev's call:
 *
 *   number on the hot tile (white)   19.37    was 10.53
 *   number on the cold tile (pink)   10.53    was  7.87
 *   hot → cold, as the eye reads it   1.72    was  1.34   ← the cooling is MORE visible
 *   cold tile vs idle                 3.38    floor 3
 *
 * The lesson is worth keeping: I had reasoned the cold end down towards the idle colour to make
 * the change dramatic, and that spent the number's legibility to say something HEIGHT was already
 * saying. Anchoring the HOT end at white instead buys the same drama out of the bright end, where
 * there was room to spare.
 */
export const TILE_LIT_COLD = '#FAAAFA';

/** Linear mix of two hex colours, `t` from 0 (a) to 1 (b). */
export function mixHex(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  const k = Math.min(1, Math.max(0, t));
  const channel = (i: 0 | 1 | 2): string =>
    Math.round(x[i] + (y[i] - x[i]) * k).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`.toUpperCase();
}

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
