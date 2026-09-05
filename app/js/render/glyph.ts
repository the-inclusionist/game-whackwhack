// SPDX-License-Identifier: AGPL-3.0-or-later
// render/glyph — a number as seven-segment strokes, in a unit box.
//
// ========================= WHY SEVEN SEGMENTS =========================
// Not nostalgia. At the size a tile affords, a proportional face loses its thin strokes into the
// antialiasing and a 6 starts looking like a 5. A segment layout has no thin strokes and no
// optional parts: each digit is a SET, present or absent, so the failure mode is a missing bar
// rather than a blurred curve. An ambiguous digit here is a curriculum error, not a style choice.
//
// ========================= DATA, WITH NO RENDERER IN SIGHT =========================
// This module knows nothing about Zdog, Pixi or a canvas. It answers "where are the strokes" in a
// unit box, and the caller scales and places them. That is what lets the layout be tested in the
// node project — including the one property that matters and is invisible on screen: that two
// different numbers never produce the same set of segments.
//
// Measured in docs/spike-0-symbol-legibility.md, which locked the height at 9 world units on a
// 16-unit tile and the stroke at 1.5.

/** Corners and midpoints of the digit box: 3 wide, 5 tall, y increasing DOWNWARD as Zdog does. */
const P: Readonly<Record<string, readonly [number, number]>> = {
  a: [0, 0], b: [3, 0],
  c: [0, 2.5], d: [3, 2.5],
  e: [0, 5], f: [3, 5],
};

const SEGMENT: Readonly<Record<string, readonly [string, string]>> = {
  top: ['a', 'b'],
  topLeft: ['a', 'c'],
  topRight: ['b', 'd'],
  middle: ['c', 'd'],
  bottomLeft: ['c', 'e'],
  bottomRight: ['d', 'f'],
  bottom: ['e', 'f'],
};

/** Which segments each digit lights. */
export const DIGIT_SEGMENTS: Readonly<Record<string, readonly string[]>> = {
  '0': ['top', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'bottom'],
  '1': ['topRight', 'bottomRight'],
  '2': ['top', 'topRight', 'middle', 'bottomLeft', 'bottom'],
  '3': ['top', 'topRight', 'middle', 'bottomRight', 'bottom'],
  '4': ['topLeft', 'topRight', 'middle', 'bottomRight'],
  '5': ['top', 'topLeft', 'middle', 'bottomRight', 'bottom'],
  '6': ['top', 'topLeft', 'middle', 'bottomLeft', 'bottomRight', 'bottom'],
  '7': ['top', 'topRight', 'bottomRight'],
  '8': ['top', 'topLeft', 'topRight', 'middle', 'bottomLeft', 'bottomRight', 'bottom'],
  '9': ['top', 'topLeft', 'topRight', 'middle', 'bottomRight', 'bottom'],
};

/**
 * Per-digit horizontal nudge, in grid steps.
 *
 * ⚠️ Only the 1 needs one, and it needs it badly. A seven-segment 1 is the RIGHT-HAND BAR ALONE,
 * so it hugs the right edge of its cell and ends up nearly touching the next digit: "12" reads as
 * one crowded mark rather than two digits. Tabular figures solve this by centring the 1 in its
 * own advance, and that is what this does — it moves the bar half a box to the left, which puts
 * it in the middle of the cell it owns.
 */
const DIGIT_NUDGE: Readonly<Record<string, number>> = { '1': -1.5 };

/** The glyph's height on a 16-unit tile. Locked by spike 0. */
export const GLYPH_HEIGHT = 9;

/** Gap between digits, as a fraction of one grid step. */
const DIGIT_GAP = 1.1;
const DIGIT_BOX_W = 3;
const DIGIT_BOX_H = 5;

export interface Point2 { readonly x: number; readonly y: number }
export interface Stroke { readonly from: Point2; readonly to: Point2 }

/**
 * The strokes for `text`, centred on the origin, `height` units tall.
 *
 * Characters with no segment table are skipped rather than throwing: the caller renders whatever
 * the category put on the tile, and a category that produced a letter is a bug in the category,
 * caught by its own tests, not a reason to take the frame down mid-round.
 */
export function strokesFor(text: string, height: number = GLYPH_HEIGHT): Stroke[] {
  const step = height / DIGIT_BOX_H;
  const boxW = DIGIT_BOX_W * step;
  const gap = DIGIT_GAP * step;
  const digits = [...text].filter((ch) => DIGIT_SEGMENTS[ch] !== undefined);
  if (digits.length === 0) return [];

  const total = digits.length * boxW + (digits.length - 1) * gap;
  const out: Stroke[] = [];

  digits.forEach((ch, i) => {
    const originX = -total / 2 + i * (boxW + gap) + (DIGIT_NUDGE[ch] ?? 0) * step;
    for (const name of DIGIT_SEGMENTS[ch]) {
      const [k0, k1] = SEGMENT[name];
      out.push({
        from: { x: originX + P[k0][0] * step, y: -height / 2 + P[k0][1] * step },
        to: { x: originX + P[k1][0] * step, y: -height / 2 + P[k1][1] * step },
      });
    }
  });
  return out;
}

/** How wide `text` will be, in the same units as `height`. Needed to check it fits a tile. */
export function widthOf(text: string, height: number = GLYPH_HEIGHT): number {
  const step = height / DIGIT_BOX_H;
  const digits = [...text].filter((ch) => DIGIT_SEGMENTS[ch] !== undefined).length;
  if (digits === 0) return 0;
  return digits * DIGIT_BOX_W * step + (digits - 1) * DIGIT_GAP * step;
}
