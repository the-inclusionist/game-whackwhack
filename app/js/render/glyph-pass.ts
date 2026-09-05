// SPDX-License-Identifier: AGPL-3.0-or-later
// render/glyph-pass — stamping the numbers onto the canvas Zdog just drew.
//
// ========================= WHY THE NUMBER IS NOT GEOMETRY =========================
// Zdog does no texture mapping, so "write on the tile face" was never available. Spike 0 measured
// the three ways there are, on the tilted mat at this resolution, and this is the one that won:
//
//   · flat on the face   — 22 px of ink, 23-50% edge smear, and "12" renders as "IC". Disqualified
//                          on legibility, not on the numbers: a misread digit is a curriculum error.
//   · standing upright   — 46 px, 17-25% smear, but it occupies the row BEHIND it, so two lit
//                          tiles in adjacent rows clip each other's numbers. Zdog occludes that
//                          correctly, which is the problem: a correctly hidden number is hidden.
//   · this one           — 40-47 px, 2.6-10.7% smear, inside its own tile, upright at any camera.
//
// ========================= WHOLE PIXELS, WHICH IS THE ENTIRE TRICK =========================
// ⚠️ Every rectangle is snapped to integer coordinates and filled — never stroked. A stroked path
// antialiases BOTH of its edges and no Canvas2D setting turns that off; a filled rect on integer
// bounds is either ink or it is not. That single difference is worth about 15 points of smear, and
// it is why this candidate reads crisply where the geometry ones read soft.
//
// ========================= AND IT CANNOT BE OCCLUDED, WHICH IS FINE HERE =========================
// Drawing after Zdog means nothing can cover these marks. Spike 0 tested whether anything ought
// to: across every rise from 0 to 10, a near tile covered a far tile's centre in 0 of 15 pairs.
// The reason is structural rather than lucky — only a lit tile has a number, and only a lit tile
// rises, so whatever could cover one either rose by the same amount or is unlit and therefore
// lower. If the mat ever gains tiles at different heights, this assumption is the one to re-check.

import { GLYPH_HEIGHT, strokesFor } from './glyph.ts';
import { INK, STROKE } from './palette.ts';
import { centreOf, type Point2, type Quad, type Viewport } from './picking.ts';

/** A number to stamp, and the tile it belongs to. */
export interface GlyphItem {
  readonly cell: number;
  readonly text: string;
}

/**
 * The 2D calls this pass needs. Narrow on purpose, so a test can record them without a canvas.
 *
 * `fillStyle` is widened to the full CanvasRenderingContext2D union rather than `string`, even
 * though only a string is ever assigned: a narrower property type makes a real context fail to
 * satisfy the interface, because property types are invariant.
 */
export interface Stamper {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
}

/**
 * Draws each item's number at the centre of its tile's projected quad.
 *
 * `quads` is indexed by cell, as `MatView.quads()` returns it, and must come from a stage that has
 * already run `update()` this frame — otherwise the corners are last frame's and the numbers lag
 * the mat by one frame, which looks like a rendering glitch and is really a sequencing bug.
 */
export function stampGlyphs(
  ctx: Stamper,
  items: readonly GlyphItem[],
  quads: readonly Quad[],
  viewport: Viewport,
): void {
  ctx.fillStyle = INK;
  const height = GLYPH_HEIGHT * viewport.zoom;
  const weight = Math.max(1, Math.round(STROKE * viewport.zoom));

  for (const item of items) {
    const quad = quads[item.cell];
    if (!quad) continue;
    stampOne(ctx, centreOf(quad, viewport), item.text, height, weight);
  }
}

function stampOne(
  ctx: Stamper, centre: Point2, text: string, height: number, weight: number,
): void {
  for (const stroke of strokesFor(text, height)) {
    const x0 = Math.round(centre.x + Math.min(stroke.from.x, stroke.to.x));
    const y0 = Math.round(centre.y + Math.min(stroke.from.y, stroke.to.y));
    const x1 = Math.round(centre.x + Math.max(stroke.from.x, stroke.to.x));
    const y1 = Math.round(centre.y + Math.max(stroke.from.y, stroke.to.y));
    // A segment is one unit thin in its short axis, so `max` gives it the stroke weight there and
    // its real length along the other. Writing `x1 - x0` alone would draw nothing for a vertical.
    ctx.fillRect(x0, y0, Math.max(weight, x1 - x0), Math.max(weight, y1 - y0));
  }
}
