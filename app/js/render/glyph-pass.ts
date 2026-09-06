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
// ========================= IT IS TEXT NOW, AND THAT REPLACED THE WHOLE-PIXEL TRICK =========
// ⚠️ This pass drew seven-segment BARS, snapped to integer coordinates and filled rather than
// stroked, because a filled rect on integer bounds is either ink or it is not — worth about 15
// points of edge smear against a stroked path, and the reason spike 0's candidate (b) beat the
// geometry ones.
//
// It draws `fillText` in Atkinson Hyperlegible now, on the Dev's call, and that trades the trick
// away knowingly. Text antialiases; there is no integer-bounds version of a curve. What is bought
// is the thing the segments never addressed: this face was drawn by the Braille Institute to
// separate the characters low vision confuses, which on a mat of numbers is 6 against 9 and 1
// against 7. Crisp-but-confusable was the worse trade for a child who has to READ the tile.
//
// What survives of the old discipline is the ORIGIN: the centre is still rounded to a whole pixel
// before the text is placed, so the glyph's own rasterisation grid does not shift from frame to
// frame as the mat leans. That is cheap and it is the half that still applies.
//
// ========================= AND IT CANNOT BE OCCLUDED, WHICH IS FINE HERE =========================
// Drawing after Zdog means nothing can cover these marks. Spike 0 tested whether anything ought
// to: across every rise from 0 to 10, a near tile covered a far tile's centre in 0 of 15 pairs.
// The reason is structural rather than lucky — only a lit tile has a number, and only a lit tile
// rises, so whatever could cover one either rose by the same amount or is unlit and therefore
// lower. If the mat ever gains tiles at different heights, this assumption is the one to re-check.

import { GLYPH_HEIGHT, fontFor } from './glyph.ts';
import { INK } from './palette.ts';
import { centreOf, type Point2, type Quad, type Viewport } from './picking.ts';

/** A number to stamp, and the tile it belongs to. */
export interface GlyphItem {
  readonly cell: number;
  readonly text: string;
  /**
   * 1 is fully inked; below 1 the glyph is LEAVING.
   *
   * ⚠️ Blending reintroduces the partial pixels the whole-pixel fill exists to avoid, and that is
   * accepted here for one reason: a fading glyph is not being READ, it is being dismissed. The
   * crispness invariant applies to the state a child has to decode, not to its exit.
   */
  readonly alpha?: number;
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
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): TextMetrics;
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
  // ⚠️ WORLD UNITS TIMES ZOOM. `GLYPH_HEIGHT` is 8 units on a 16-unit tile; the zoom turns that
  // into canvas pixels, and `fontFor` turns a digit HEIGHT into the font size that draws it —
  // which is not the same number, because a digit fills 0.70 of the em box in this face.
  ctx.font = fontFor(GLYPH_HEIGHT * viewport.zoom);
  ctx.textAlign = 'center';
  /**
   * ⚠️ `textBaseline: 'middle'` IS NOT THE MIDDLE OF A DIGIT. It centres the EM BOX, which
   * reserves room for descenders digits do not have, so every number sat low on its tile.
   * Measured: the centre of mass of "18" was 4.6 px below the tile centre on an 80 px tile —
   * a twentieth of the tile, which reads as a number resting on the bottom edge.
   *
   * The fix is to place the ink's own midpoint on the centre, and `(ascent - descent) / 2` is
   * that offset. It is MEASURED FROM THE FACE rather than tuned, so a font update moves it on
   * its own.
   *
   * ⚠️ AND IT IS MEASURED AGAINST WHATEVER BASELINE IS SET, which makes the line below almost
   * decorative: `measureText` reports its bounding box relative to the current `textBaseline`, so
   * the offset self-corrects and 'middle' would land in the same place. That was found by a
   * mutation that ESCAPED — swapping this line back to 'middle' changed nothing measurable, which
   * is the correct answer and not a hole. 'alphabetic' stays because it is the baseline the
   * offset is easiest to reason about, and the comment now says so instead of claiming the
   * placement depends on it.
   */
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText('0');
  const baseline = (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;

  const entry = ctx.globalAlpha;
  for (const item of items) {
    const quad = quads[item.cell];
    if (!quad) continue;
    const alpha = item.alpha ?? 1;
    if (alpha <= 0) continue;
    ctx.globalAlpha = entry * alpha;
    stampOne(ctx, centreOf(quad, viewport), item.text, baseline);
  }
  // Restored rather than set to 1: this pass does not own the context, and leaving it altered
  // would silently tint whatever the caller draws next.
  ctx.globalAlpha = entry;
}

function stampOne(ctx: Stamper, centre: Point2, text: string, baseline: number): void {
  // ⚠️ ROUNDED. The mat leans continuously under the pointer, so an unrounded origin lands on a
  // different sub-pixel every frame and the same digit re-rasterises slightly differently each
  // time — which reads as the number shimmering rather than the mat moving. It is the surviving
  // half of the whole-pixel discipline the segments were built around.
  ctx.fillText(text, Math.round(centre.x), Math.round(centre.y + baseline));
}
