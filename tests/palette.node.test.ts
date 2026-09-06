// SPDX-License-Identifier: AGPL-3.0-or-later
// The palette is held to measured floors, in normal vision and under all three colour-vision
// simulations. These are the assertions that would have caught the defect spike 0 found: the
// provisional mat colour sat at 1.58:1 against the background and looked perfectly fine.

import { describe, expect, it } from 'vitest';
import {
  CONTRAST_FLOOR, GROUND, INK, STROKE, TEXT_CONTRAST_TARGET, TILE_IDLE, TILE_LIT,
  contrastRatio, relativeLuminance, rgbOf, type Rgb,
} from '../app/js/render/palette.ts';
import { GLYPH_HEIGHT } from '../app/js/render/glyph.ts';
import { LOGICAL_H, LOGICAL_W, SOURCE_MULTIPLE, TILE, UI_BASE_W } from '../app/js/render/resolution.ts';

/** Machado, Oliveira & Fernandes (2009) at severity 1.0 — the same matrices the engine installs. */
const CVD: Readonly<Record<string, readonly number[]>> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuter: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900],
};

function simulate(matrix: readonly number[], rgb: Rgb): Rgb {
  return [
    matrix[0] * rgb[0] + matrix[1] * rgb[1] + matrix[2] * rgb[2],
    matrix[3] * rgb[0] + matrix[4] * rgb[1] + matrix[5] * rgb[2],
    matrix[6] * rgb[0] + matrix[7] * rgb[1] + matrix[8] * rgb[2],
  ];
}

const MODES = ['normal', 'protan', 'deuter', 'tritan'] as const;
function ratioIn(mode: string, a: string, b: string): number {
  const f = (hex: string): Rgb => (mode === 'normal' ? rgbOf(hex) : simulate(CVD[mode], rgbOf(hex)));
  return contrastRatio(f(a), f(b));
}

describe('[Right] the contrast helpers agree with the WCAG definition', () => {
  it('gives black against white the maximum 21:1', () => {
    expect(contrastRatio(rgbOf('#000000'), rgbOf('#FFFFFF'))).toBeCloseTo(21, 2);
  });

  it('gives a colour against itself exactly 1', () => {
    expect(contrastRatio(rgbOf(TILE_LIT), rgbOf(TILE_LIT))).toBeCloseTo(1, 10);
  });

  it('is symmetric', () => {
    expect(contrastRatio(rgbOf(INK), rgbOf(TILE_LIT)))
      .toBeCloseTo(contrastRatio(rgbOf(TILE_LIT), rgbOf(INK)), 10);
  });

  it('puts white at luminance 1 and black at 0', () => {
    expect(relativeLuminance(rgbOf('#FFFFFF'))).toBeCloseTo(1, 6);
    expect(relativeLuminance(rgbOf('#000000'))).toBeCloseTo(0, 6);
  });
});

describe('[Right] the unlit tile is visible against the background', () => {
  // THE regression from spike 0. #2E3B4E measured 1.58:1 here, the mat dissolved into the ground,
  // and nothing but a measurement was ever going to say so.
  it.each(MODES)('clears the 3:1 floor in %s vision', (mode) => {
    expect(ratioIn(mode, TILE_IDLE, GROUND)).toBeGreaterThanOrEqual(CONTRAST_FLOOR);
  });

  it('clears the floor, though not by much: that is what the DDR palette costs', () => {
    expect(ratioIn('normal', TILE_IDLE, GROUND)).toBeGreaterThan(3.0);
  });
});

describe('[Right] a lit tile separates from an unlit one', () => {
  it.each(MODES)('clears the 3:1 floor in %s vision', (mode) => {
    expect(ratioIn(mode, TILE_LIT, TILE_IDLE)).toBeGreaterThanOrEqual(CONTRAST_FLOOR);
  });
});

describe('[Right] the number is comfortably readable on its tile', () => {
  it.each(MODES)('clears the enhanced 7:1 target in %s vision', (mode) => {
    expect(ratioIn(mode, INK, TILE_LIT)).toBeGreaterThanOrEqual(TEXT_CONTRAST_TARGET);
  });

  it('clears it by a wide margin, because the glyph is the content', () => {
    // The number is drawn in the GROUND colour, so the digit reads as a hole punched through the
    // tile rather than as paint on it — which is also where the margin comes from.
    expect(ratioIn('normal', INK, TILE_LIT)).toBeGreaterThan(10);
  });
});

describe('[Interface] the palette survives colour vision because it is built on luminance', () => {
  it('barely moves under any simulation', () => {
    // The property that makes the three blocks above pass rather than a lucky set of hues: if
    // any pair were separated by hue instead of lightness, one matrix would collapse it.
    for (const [a, b] of [[INK, TILE_LIT], [TILE_LIT, TILE_IDLE], [TILE_IDLE, GROUND]]) {
      const normal = ratioIn('normal', a, b);
      for (const mode of ['protan', 'deuter', 'tritan']) {
        const drift = Math.abs(ratioIn(mode, a, b) - normal) / normal;
        expect(drift, `${a} vs ${b} in ${mode}`).toBeLessThan(0.12);
      }
    }
  });
});

describe('[Right] the resolution is double the engine, and the world is not', () => {
  it('draws at 640 by 360', () => {
    expect(LOGICAL_W).toBe(640);
    expect(LOGICAL_H).toBe(360);
    expect(SOURCE_MULTIPLE).toBe(2);
  });

  it('is sixteen by nine', () => {
    expect(LOGICAL_W / LOGICAL_H).toBeCloseTo(16 / 9, 10);
  });

  it('leaves the world unit alone', () => {
    // The whole point of the doubling: finer raster, same geometry.
    expect(TILE).toBe(16);
  });

  it('measures the UI against the ENGINE width, not this game\'s', () => {
    // Type and tap targets are sized for a hand and an eye; neither cares that the art is drawn
    // at double density. Measuring against 640 would halve every control.
    expect(UI_BASE_W).toBe(320);
    expect(UI_BASE_W).toBe(LOGICAL_W / SOURCE_MULTIPLE);
  });
});

// ⚠️ THREE DESCRIBES WERE REMOVED HERE, and they were the seven-segment layout's: that a glyph
// fitted its tile, that no two digits drew the same set of bars, and what happened to a character
// the segments could not draw. The segments are gone -- the numbers are set in Atkinson
// Hyperlegible now -- and every one of those questions still matters, so they moved rather than
// died: tests/glyph.browser.test.ts asks the same three of the real face, by MEASURING it, which
// is the only way to ask them of a font.


describe('[Interface] the stroke weight is the chess game\'s measured knee', () => {
  it('is 1.5 world units', () => {
    expect(STROKE).toBe(1.5);
  });

  it('is thin enough that a digit keeps its counters', () => {
    // At 1.5 on a 9-unit glyph the box is 5.4 units wide and the strokes are 1.5, leaving a real
    // hole in a 0, a 6, an 8 and a 9. Much fatter and the counters close.
    expect(STROKE).toBeLessThan((GLYPH_HEIGHT / 5) * 3 / 2);
  });
});
