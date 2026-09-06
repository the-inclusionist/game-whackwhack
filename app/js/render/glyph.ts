// SPDX-License-Identifier: AGPL-3.0-or-later
// render/glyph — how big a number on a tile is, and in what.
//
// ========================= THIS FILE USED TO BE SEVEN SEGMENTS =========================
// ⚠️ It held a segment layout — a digit as a set of bars in a unit box — and the reasoning was
// sound at the time it was written. Spike 0 measured that "at the size a tile affords, a
// PROPORTIONAL FACE loses its thin strokes into the antialiasing and a 6 starts looking like a 5",
// and a segment has no thin strokes and no optional parts, so the failure mode was a missing bar
// rather than a blurred curve.
//
// That finding was about proportional faces IN GENERAL, and it did not test the one face drawn to
// answer it. The Dev's call: Atkinson Hyperlegible, by the Braille Institute, whose entire design
// brief is disambiguating the characters low vision confuses — and the pairs it separates are the
// ones a tile can carry: 6 against 9, 1 against l against I, 0 against O. A segment display makes
// every digit out of the same seven bars, which is robust against blur and does nothing at all
// about confusion; this face is the other way round. For a mat of numbers a child has to READ, the
// second trade is the better one.
//
// So the seven-segment data, `strokesFor` and `widthOf` are gone with the thing that used them,
// and what is left is the sizing — which is now the only decision this module owns.
//
// ========================= THE NUMBERS BELOW ARE MEASURED =========================
// Every one of them was read off the face in a browser, not taken from a specimen.

/**
 * The height of a digit, in world units, on a 16-unit tile.
 *
 * ⚠️ EIGHT, down from nine. "Os números devem ser um pouco menores" — and smaller is affordable
 * here in a way it was not before: a segment digit needs its bars far enough apart to stay
 * separate, while this face keeps its counters open by design. At the camera's zoom of 5 that is
 * 40 canvas pixels of digit, against the 45 the segments drew.
 */
export const GLYPH_HEIGHT = 8;

/**
 * A digit's height as a fraction of the font size, for Atkinson Hyperlegible.
 *
 * ⚠️ MEASURED, and it has to be: `font-size` is the em box, and how much of it a digit fills is a
 * property of the face. At 100 px this one reports `actualBoundingBoxAscent` 69 and
 * `actualBoundingBoxDescent` 1 for "0" — 70 px of digit, so 0.70. Setting the font size to the
 * height directly would draw digits 30% smaller than asked for, which is exactly the kind of
 * quiet miss the tile has no room for. tests/glyph.browser.test.ts re-measures it against the
 * real face, so a font update that changes the ratio fails rather than shrinks the numbers.
 */
export const DIGIT_HEIGHT_RATIO = 0.70;

/** The family, once, so the stylesheet and the canvas cannot name it differently. */
export const GLYPH_FAMILY = 'Atkinson Hyperlegible';

/**
 * The fallback, and it is `sans-serif` rather than `monospace` on purpose: if the face has not
 * loaded, a proportional fallback at least keeps a two-digit number inside its tile, where a
 * monospaced one at the same size would push it over the edge.
 */
export const GLYPH_FALLBACK = 'sans-serif';

/** The font size that draws a digit `height` tall. */
export function fontSizeFor(height: number): number {
  return height / DIGIT_HEIGHT_RATIO;
}

/**
 * The Canvas2D `font` string for a digit of `height` CANVAS pixels.
 *
 * ⚠️ Canvas pixels, not world units — the caller multiplies by the viewport zoom first. Putting
 * the zoom in here would make this module know about the camera, which is the boundary that keeps
 * it testable without a stage.
 */
export function fontFor(heightPx: number): string {
  return `${fontSizeFor(heightPx)}px '${GLYPH_FAMILY}', ${GLYPH_FALLBACK}`;
}
