// SPDX-License-Identifier: AGPL-3.0-or-later
// The palette is held to measured floors, in normal vision and under all three colour-vision
// simulations. These are the assertions that would have caught the defect spike 0 found: the
// provisional mat colour sat at 1.58:1 against the background and looked perfectly fine.

import { describe, expect, it } from 'vitest';
import {
  CONTRAST_FLOOR, GROUND, INK, STROKE, TEXT_CONTRAST_TARGET, TILE_IDLE, TILE_LIT,
  contrastRatio, relativeLuminance, rgbOf, type Rgb,
} from '../app/js/render/palette.ts';
import { GLYPH_HEIGHT, strokesFor, widthOf } from '../app/js/render/glyph.ts';
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

  it('is not merely at the floor, so a later tweak has somewhere to go', () => {
    expect(ratioIn('normal', TILE_IDLE, GROUND)).toBeGreaterThan(3.4);
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
    expect(ratioIn('normal', INK, TILE_LIT)).toBeGreaterThan(12);
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

describe('[Right] the glyph fits the tile it has to sit on', () => {
  it.each(['1', '7', '12', '18', '20'])('keeps "%s" inside a 16-unit tile', (text) => {
    // Spike 0 locked a 9-unit glyph on a 16-unit tile. A number that overflowed would spill onto
    // the neighbouring tile and be read as belonging to it.
    expect(widthOf(text)).toBeLessThan(TILE);
    expect(GLYPH_HEIGHT).toBeLessThan(TILE);
  });

  it('leaves real margin, not a hairline', () => {
    expect(TILE - widthOf('18')).toBeGreaterThan(2);
  });

  it('centres a number whose digits fill their boxes', () => {
    // Measured on 88 rather than 18 on purpose: a seven-segment 1 does not fill its box, so ink
    // symmetry is the wrong question for it. See the 1-specific test below.
    const xs = strokesFor('88').flatMap((s) => [s.from.x, s.to.x]);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0, 6);
  });

  it('centres a lone 1 instead of hanging it off the right edge', () => {
    // A seven-segment 1 is the right-hand bar alone. Left where the layout puts it, it hugs the
    // edge of its cell and nearly touches the next digit — "12" reads as one crowded mark. This
    // is the assertion behind DIGIT_NUDGE.
    const xs = strokesFor('1').flatMap((s) => [s.from.x, s.to.x]);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.max(...xs)).toBeCloseTo(0, 6);
  });

  it('keeps a real gap between the 1 and the digit after it', () => {
    // The failure this prevents: two digits close enough to read as one number of a shape the
    // child was never shown.
    const step = GLYPH_HEIGHT / 5;
    const strokes = strokesFor('12');
    const oneRight = Math.max(...strokes.slice(0, 2).flatMap((s) => [s.from.x, s.to.x]));
    const twoLeft = Math.min(...strokes.slice(2).flatMap((s) => [s.from.x, s.to.x]));
    expect(twoLeft - oneRight).toBeGreaterThan(step);
  });

  it('is exactly `height` tall', () => {
    const strokes = strokesFor('8', 9);
    const ys = strokes.flatMap((s) => [s.from.y, s.to.y]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(9, 6);
  });
});

describe('[Unique] no two numbers draw the same shape', () => {
  it('gives every digit a distinct set of segments', () => {
    // The property that makes seven segments worth choosing, and the one that is invisible on
    // screen until a child reads a 6 as a 5.
    const seen = new Map<string, string>();
    for (let d = 0; d <= 9; d++) {
      const key = JSON.stringify(strokesFor(String(d)));
      expect(seen.has(key), `${d} draws the same as ${seen.get(key)}`).toBe(false);
      seen.set(key, String(d));
    }
  });

  it('gives every value in the shipped pools a distinct shape', () => {
    const seen = new Map<string, number>();
    for (let n = 1; n <= 20; n++) {
      const key = JSON.stringify(strokesFor(String(n)));
      expect(seen.has(key), `${n} draws the same as ${seen.get(key)}`).toBe(false);
      seen.set(key, n);
    }
  });
});

describe('[Zero] the glyph handles what it cannot draw', () => {
  it('returns nothing for an empty string', () => {
    expect(strokesFor('')).toEqual([]);
    expect(widthOf('')).toBe(0);
  });

  it('skips a character it has no segments for instead of throwing', () => {
    // A letter here would be a bug in a category, caught by that category's own tests. Taking
    // the frame down mid-round is a worse answer than drawing the digits that are there.
    expect(strokesFor('1a2')).toEqual(strokesFor('12'));
  });

  it('draws a two-digit number as two digits', () => {
    expect(strokesFor('18').length)
      .toBe(strokesFor('1').length + strokesFor('8').length);
  });
});

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
