// SPDX-License-Identifier: AGPL-3.0-or-later
// The numbers on the tiles, measured against the face that actually draws them.
//
// ========================= WHY THIS FILE IS IN THE BROWSER PROJECT =========================
// ⚠️ THE THREE QUESTIONS HERE USED TO BE ANSWERED IN THE NODE PROJECT, in tests/palette, against a
// seven-segment layout: does a number fit its tile, is it centred, do two digits ever draw the same
// shape. That worked because the layout was DATA — a set of bars in a unit box — and arithmetic on
// data needs no browser.
//
// The numbers are set in Atkinson Hyperlegible now, and the same three questions have become
// questions about a FONT. There is no arithmetic that answers them: how wide "18" is, how much of
// the em box a digit fills, and whether a 6 and a 9 rasterise differently are all facts about a
// file, readable only by asking a text engine to draw it. Moving the tests into a real browser is
// what keeps them true rather than plausible.
//
// ========================= AND THE FACE IS LOADED FIRST, DELIBERATELY =========================
// `@font-face` is lazy: a declared face is not fetched until something asks to draw with it, so
// `document.fonts.ready` resolves immediately with nothing loaded and every measurement below
// silently reads the fallback. That mistake already cost this repository four commits of a title
// in the wrong typeface. `document.fonts.load` is the request.

import { beforeAll, describe, expect, it } from 'vitest';
import {
  DIGIT_HEIGHT_RATIO, GLYPH_FAMILY, GLYPH_HEIGHT, fontFor, fontSizeFor,
} from '../app/js/render/glyph.ts';
import { CAMERA } from '../app/js/render/zdog-stage.ts';
import { CATEGORIES } from '../app/js/rules/category.ts';
import { TILE } from '../app/js/render/resolution.ts';
import '../app/css/style.css';

const DIGITS = '0123456789';
let ctx: CanvasRenderingContext2D;

/** The digit height the game actually draws, in canvas pixels. */
const HEIGHT_PX = GLYPH_HEIGHT * CAMERA.zoom;

function measure(text: string, font = fontFor(HEIGHT_PX)): TextMetrics {
  ctx.font = font;
  return ctx.measureText(text);
}

const inkHeight = (m: TextMetrics): number =>
  m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;

beforeAll(async () => {
  await document.fonts.load(`100px '${GLYPH_FAMILY}'`, DIGITS);
  await document.fonts.ready;
  const got = document.createElement('canvas').getContext('2d');
  if (!got) throw new Error('no 2d context to measure with');
  ctx = got;
});

describe('[Interface] the face is really loaded, or nothing below means anything', () => {
  it('is available to the canvas', () => {
    expect(document.fonts.check(`100px '${GLYPH_FAMILY}'`)).toBe(true);
  });

  it('draws digits differently from the fallback', () => {
    // ⚠️ The check above passes on a face that loaded with no glyphs in it — which is exactly what
    // happened to Press Start 2P here, as the cyrillic-ext subset. Comparing an advance against
    // the fallback reaches past the family NAME to the file.
    const own = measure('0').width;
    const fallback = measure('0', `${fontSizeFor(HEIGHT_PX)}px sans-serif`).width;
    expect(own).not.toBe(fallback);
  });

  it('has every digit, not merely some of them', () => {
    // A subset missing one digit would draw the fallback for that one alone, at a different width,
    // and only for the numbers that contain it.
    for (const digit of DIGITS) {
      expect(inkHeight(measure(digit)), digit).toBeGreaterThan(0);
    }
  });
});

describe('[Right] a digit is the height the game asked for', () => {
  it('fills 0.70 of the font size, which is what the sizing is built on', () => {
    // ⚠️ MEASURED HERE AGAINST THE REAL FILE. `fontSizeFor` divides by this constant, so a font
    // update that changed the proportion would silently draw every number the wrong size. At
    // 100 px this face reports ascent 69 and descent 1 for "0".
    const m = measure('0', `100px '${GLYPH_FAMILY}'`);
    expect(inkHeight(m) / 100).toBeCloseTo(DIGIT_HEIGHT_RATIO, 2);
  });

  it('draws a digit of exactly GLYPH_HEIGHT world units at the camera zoom', () => {
    // The whole point of the ratio: ask for 40 canvas pixels of digit and get 40, not 28.
    expect(inkHeight(measure('8'))).toBeCloseTo(HEIGHT_PX, 0);
  });

  it('is SMALLER than the seven-segment layout it replaced', () => {
    // "Os números devem ser um pouco menores." The segments drew 9 world units; this draws 8.
    expect(GLYPH_HEIGHT).toBe(8);
    expect(GLYPH_HEIGHT).toBeLessThan(9);
  });
});

describe('[Right] a number fits the tile it has to sit on', () => {
  const tilePx = TILE * CAMERA.zoom;

  it.each(['0', '9', '18', '88', '20', '36'])('keeps %s inside its tile', (text) => {
    // A number that overflowed would spill onto the neighbouring tile and be read as belonging
    // to it — which on a mat of numbers is a wrong answer, not a cosmetic fault.
    expect(measure(text).width).toBeLessThan(tilePx);
  });

  it('leaves real margin on the widest number ANY category can produce', () => {
    // ⚠️ THE POOL, NOT AN ARBITRARY PAIR. The first version of this measured "88" -- the widest
    // two digits this face can draw -- and reported 5.9 px of margin on an 80 px tile, which read
    // as a failure of the sizing. It was a failure of the QUESTION: no category can put 88 on a
    // tile. The pools run 1..36, and the widest value in them is what has to fit.
    const values = new Set<number>();
    for (const category of CATEGORIES) for (const value of category.pool) values.add(value);
    const widest = Math.max(...[...values].map((v) => measure(String(v)).width));
    expect(Math.max(...values)).toBeLessThanOrEqual(36);
    // 10% of the tile, on both sides together. Measured at this size and this face; it is the
    // gap that stops two lit neighbours reading as one four-digit number.
    expect(tilePx - widest).toBeGreaterThan(tilePx * 0.10);
  });

  it('is taller than it is wide for a single digit, as a digit should be', () => {
    // A face whose digits came out wider than tall would be a sign the size was applied to the
    // wrong axis — and it would still pass every width check above.
    expect(inkHeight(measure('8'))).toBeGreaterThan(measure('8').width);
  });
});

describe('[Unique] no two digits draw the same shape', () => {
  /** Rasterises one character and returns its ink as a string, for comparison. */
  function bitmapOf(text: string): string {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#000000';
    c.font = `40px '${GLYPH_FAMILY}', sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, size / 2, size / 2);
    // Alpha only: the colour is constant, and the shape is the question.
    const data = c.getImageData(0, 0, size, size).data;
    let out = '';
    for (let i = 3; i < data.length; i += 4) out += data[i] > 127 ? '1' : '0';
    return out;
  }

  it('gives every digit a distinct rasterisation', () => {
    // ⚠️ THE PROPERTY THAT DECIDED THE FACE. Seven segments guaranteed this by construction — each
    // digit was a different SET of bars — and gave up nothing to blur, which is why spike 0 chose
    // them. It is asserted rather than assumed now, because a font can only be measured.
    const seen = new Map<string, string>();
    for (const digit of DIGITS) {
      const key = bitmapOf(digit);
      expect(seen.has(key), `${digit} draws the same as ${seen.get(key)}`).toBe(false);
      seen.set(key, digit);
    }
  });

  it('separates the pairs this face exists to separate', () => {
    // The Braille Institute's brief. 6/9 and 1/7 are the pairs a mat of numbers can actually
    // present, and 0/O is the one a segment display never solved.
    for (const [a, b] of [['6', '9'], ['1', '7'], ['0', '8'], ['3', '8']]) {
      const same = bitmapOf(a) === bitmapOf(b);
      expect(same, `${a} and ${b} rasterise identically`).toBe(false);
    }
  });
});
