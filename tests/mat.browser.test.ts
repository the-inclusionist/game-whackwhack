// SPDX-License-Identifier: AGPL-3.0-or-later
// The mat as it actually rasterises: does a lit tile rise, does a click land on the tile under it,
// and does the number end up inside the tile it belongs to.
//
// These need a real canvas because they are about PROJECTED geometry — the corners Zdog computes
// and then draws. Asserting them against a fixture would be asserting my own arithmetic; asserting
// them against the renderer's own path commands is the only version that cannot drift from what a
// player sees.

import { afterEach, describe, expect, it } from 'vitest';
import { MAT_CELLS, MAT_COLS, cellOfSpot } from '../app/js/rules/grid.ts';
import { INK, TILE_IDLE, TILE_LIT, rgbOf } from '../app/js/render/palette.ts';
import { createMat } from '../app/js/render/mat.ts';
import { createZdogStage } from '../app/js/render/zdog-stage.ts';
import { centreOf, containsPoint, pickTopmost, toIllustrationSpace } from '../app/js/render/picking.ts';
import { stampGlyphs } from '../app/js/render/glyph-pass.ts';

const made: { destroy(): void }[] = [];

function scene(lit: number[] = []) {
  const stage = createZdogStage();
  const mat = createMat(stage.root);
  made.push(mat, stage);
  mat.setLit(lit);
  stage.render();
  return { stage, mat, ctx: stage.canvas.getContext('2d')! };
}

afterEach(() => {
  for (const m of made) m.destroy();
  made.length = 0;
});

function pixelAt(ctx: CanvasRenderingContext2D, x: number, y: number): [number, number, number] {
  const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return [d[0], d[1], d[2]];
}

function near(a: readonly number[], b: readonly number[], eps = 10): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) <= eps);
}

describe('[Right] the mat has twenty tiles and draws them all', () => {
  it('projects one quad per cell', () => {
    expect(scene().mat.quads()).toHaveLength(MAT_CELLS);
  });

  it('gives every quad a real area, so none has collapsed to a line', () => {
    // A collapsed quad hits nothing and is invisible, and at a steep enough pitch the whole mat
    // does exactly that without erroring.
    for (const quad of scene().mat.quads()) {
      const xs = quad.corners.map((c) => c.x);
      const ys = quad.corners.map((c) => c.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.5);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.5);
    }
  });

  it('keeps every tile inside the frame', () => {
    const { stage, mat } = scene();
    const v = stage.viewport();
    for (const quad of mat.quads()) {
      for (const c of quad.corners) {
        const p = { x: c.x * v.zoom + v.width / 2, y: c.y * v.zoom + v.height / 2 };
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(v.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(v.height);
      }
    }
  });
});

describe('[Right] a lit tile RISES, which is the primary signal', () => {
  // Not colour, and above all not a blink: height is the non-colour channel WCAG 1.4.1 asks for,
  // and the original's blinking slab is a photosensitivity risk under WCAG 2.3.1.
  it('sits higher on screen than the same tile unlit', () => {
    const idle = scene().mat.quads();
    const lit = scene([7]).mat.quads();
    const top = (q: typeof idle[number]) => Math.min(...q.corners.map((c) => c.y));
    expect(top(lit[7])).toBeLessThan(top(idle[7]));
  });

  it('rises by a visible amount, not a hairline', () => {
    const { stage } = scene();
    const v = stage.viewport();
    const idle = scene().mat.quads();
    const lit = scene([7]).mat.quads();
    const top = (q: typeof idle[number]) => Math.min(...q.corners.map((c) => c.y)) * v.zoom;
    expect(top(idle[7]) - top(lit[7])).toBeGreaterThan(8);
  });

  it('leaves every other tile where it was', () => {
    const idle = scene().mat.quads();
    const lit = scene([7]).mat.quads();
    for (let cell = 0; cell < MAT_CELLS; cell++) {
      if (cell === 7) continue;
      expect(lit[cell].corners[0].y).toBeCloseTo(idle[cell].corners[0].y, 6);
    }
  });
});

describe('[Right] colour is the second channel, and it is really painted', () => {
  it('paints a lit tile in the lit colour and an idle one in the idle colour', () => {
    const { stage, mat, ctx } = scene([7]);
    const v = stage.viewport();
    const quads = mat.quads();
    expect(near(pixelAt(ctx, centreOf(quads[7], v).x, centreOf(quads[7], v).y), rgbOf(TILE_LIT)))
      .toBe(true);
    expect(near(pixelAt(ctx, centreOf(quads[2], v).x, centreOf(quads[2], v).y), rgbOf(TILE_IDLE)))
      .toBe(true);
  });

  it('repaints when the wave changes, instead of keeping the first frame', () => {
    const { stage, mat, ctx } = scene([7]);
    const v = stage.viewport();
    mat.setLit([2]);
    stage.render();
    const quads = mat.quads();
    expect(near(pixelAt(ctx, centreOf(quads[2], v).x, centreOf(quads[2], v).y), rgbOf(TILE_LIT)))
      .toBe(true);
    expect(near(pixelAt(ctx, centreOf(quads[7], v).x, centreOf(quads[7], v).y), rgbOf(TILE_IDLE)))
      .toBe(true);
  });

  it('brings the previous wave back DOWN, not just back to colour', () => {
    // Height is the primary signal, so clearing only the colour would leave a tile standing proud
    // of the mat with nothing on it — and every colour assertion above would still pass.
    const { stage, mat } = scene([7]);
    const raised = Math.min(...mat.quads()[7].corners.map((c) => c.y));
    mat.setLit([2]);
    stage.render();
    const lowered = Math.min(...mat.quads()[7].corners.map((c) => c.y));
    expect(lowered).toBeGreaterThan(raised);
    expect(lowered).toBeCloseTo(Math.min(...scene().mat.quads()[7].corners.map((c) => c.y)), 6);
  });
});

describe('[Resolution] a HiDPI screen does not move the picture off the canvas', () => {
  // ⚠️ The half of the pixelRatio invariant that asserting `canvas.width` does NOT cover. Once the
  // element size is repaired explicitly, the width is right whatever `pixelRatio` says — but
  // `prerenderCanvas` still multiplies BOTH the centring translate and the scale by it, so a
  // pixelRatio of 3 draws the mat at triple size around a centre 960 px off the right edge. The
  // canvas is the correct size and almost entirely empty, and no assertion about its dimensions
  // can see that. This one looks at where the paint actually landed.
  it('paints the lit tile where picking says it is, at devicePixelRatio 3', () => {
    const real = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    try {
      const { stage, mat, ctx } = scene([7]);
      const v = stage.viewport();
      const centre = centreOf(mat.quads()[7], v);
      expect(near(pixelAt(ctx, centre.x, centre.y), rgbOf(TILE_LIT))).toBe(true);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: real, configurable: true });
    }
  });

  it('keeps Zdog\'s idea of the backing store equal to the element, at devicePixelRatio 3', () => {
    const real = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    try {
      const { stage } = scene();
      // prerenderCanvas clears against canvasWidth/Height. Left up-rezzed they disagree with the
      // element, which is the kind of mismatch that shows up later as a stale smear on resize.
      expect(stage.canvas.width).toBe(stage.viewport().width);
      expect(stage.canvas.height).toBe(stage.viewport().height);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: real, configurable: true });
    }
  });
});

describe('[Right] a click lands on the tile under it', () => {
  it('picks each tile from its own centre', () => {
    const { stage, mat } = scene();
    const v = stage.viewport();
    const quads = mat.quads();
    for (let cell = 0; cell < MAT_CELLS; cell++) {
      const centre = centreOf(quads[cell], v);
      expect(pickTopmost(quads, toIllustrationSpace(centre, v))).toBe(cell);
    }
  });

  it('picks nothing from outside the mat', () => {
    const { stage, mat } = scene();
    const v = stage.viewport();
    expect(pickTopmost(mat.quads(), toIllustrationSpace({ x: 2, y: 2 }, v))).toBeNull();
  });

  it('agrees with the grid the declaration speaks', () => {
    // The seam where an off-by-one would put the screen reader on one tile and the pointer on
    // another, with both halves looking correct on their own.
    const { stage, mat } = scene();
    const v = stage.viewport();
    const quads = mat.quads();
    const cell = cellOfSpot({ x: 3, y: 2 });
    expect(cell).toBe(2 * MAT_COLS + 3);
    expect(pickTopmost(quads, toIllustrationSpace(centreOf(quads[cell], v), v))).toBe(cell);
  });

  it('leaves GROUND visible between two tiles, not merely a gap in the path', () => {
    // ⚠️ THE ASSERTION THE SHIPPED BUG WALKED PAST. The gutter was `TILE - GUTTER` wide with
    // `stroke: STROKE`, and a Zdog stroke extends STROKE/2 beyond the path on every side — so the
    // DRAWN width was `(TILE - GUTTER) + STROKE`, and with both constants at 1.5 that is exactly
    // TILE. The mat rendered as one continuous slab while the quads still had a gap between them,
    // so the test below (which reads the PATH) passed throughout and the Dev reported it by eye:
    // "os tiles estão sem borda nenhuma entre eles".
    //
    // This one samples the canvas. It is the only version that can tell a gap in the geometry
    // from a gap you can see.
    const { stage, mat, ctx } = scene();
    const v = stage.viewport();
    const quads = mat.quads();
    const a = centreOf(quads[0], v);
    const b = centreOf(quads[1], v);
    const seam = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    // ⚠️ TRANSPARENT, not the ground colour. Nothing paints the ground onto this canvas: the
    // mat is drawn on a clear surface and `body { background: var(--ground) }` shows through from
    // the page behind it. Asserting the GROUND's rgb here failed on `0,0,0,0` -- which is the
    // right pixel and the wrong expectation, and worth writing down because the next person to
    // sample this canvas will reach for the same wrong constant.
    const d = ctx.getImageData(Math.round(seam.x), Math.round(seam.y), 1, 1).data;
    expect(d[3], `seam alpha ${d[3]} — expected the page's ground to show through`).toBeLessThan(16);
    expect(near([d[0], d[1], d[2]], rgbOf(TILE_IDLE))).toBe(false);

    // And the tile's own centre IS painted, or the assertion above would hold for a mat that
    // drew nothing at all.
    const middle = ctx.getImageData(Math.round(a.x), Math.round(a.y), 1, 1).data;
    expect(middle[3]).toBeGreaterThan(240);
    expect(near([middle[0], middle[1], middle[2]], rgbOf(TILE_IDLE))).toBe(true);
  });

  it('does not claim a point in the gutter between two tiles', () => {
    // The gutter is what lets a player see where one tile ends. A pick that snapped across it
    // would make the mat feel continuous to the hand and discrete to the eye.
    const { stage, mat } = scene();
    const v = stage.viewport();
    const quads = mat.quads();
    const a = centreOf(quads[0], v);
    const b = centreOf(quads[1], v);
    const between = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    expect(containsPoint(quads[0].corners, toIllustrationSpace(between, v))).toBe(false);
    expect(containsPoint(quads[1].corners, toIllustrationSpace(between, v))).toBe(false);
  });
});

describe('[Right] the number lands inside the tile it belongs to', () => {
  it('puts ink on the lit tile', () => {
    const { stage, mat, ctx } = scene([7]);
    const v = stage.viewport();
    const quads = mat.quads();
    stampGlyphs(ctx, [{ cell: 7, text: '18' }], quads, v);

    const centre = centreOf(quads[7], v);
    let ink = 0;
    for (let dx = -20; dx <= 20; dx++) {
      for (let dy = -20; dy <= 20; dy++) {
        if (near(pixelAt(ctx, centre.x + dx, centre.y + dy), rgbOf(INK), 14)) ink++;
      }
    }
    expect(ink).toBeGreaterThan(100);
  });

  it('leaves the neighbouring tiles clean', () => {
    // A number that spilled would be read as belonging to the tile it spilled onto — a wrong
    // answer the child could not have avoided.
    const { stage, mat, ctx } = scene([7]);
    const v = stage.viewport();
    const quads = mat.quads();
    stampGlyphs(ctx, [{ cell: 7, text: '18' }], quads, v);

    for (const neighbour of [6, 8, 2, 12]) {
      const centre = centreOf(quads[neighbour], v);
      let ink = 0;
      for (let dx = -12; dx <= 12; dx++) {
        for (let dy = -12; dy <= 12; dy++) {
          if (near(pixelAt(ctx, centre.x + dx, centre.y + dy), rgbOf(INK), 14)) ink++;
        }
      }
      expect(ink, `tile ${neighbour} has ink on it`).toBe(0);
    }
  });

  it('draws crisply: almost every glyph pixel is ink, not a half-tone', () => {
    // Spike 0's whole reason for choosing this candidate. Whole-pixel fills mean a pixel is either
    // ink or it is not; a stroked path would blur both edges of every segment.
    const { stage, mat, ctx } = scene([7]);
    const v = stage.viewport();
    const quads = mat.quads();
    stampGlyphs(ctx, [{ cell: 7, text: '18' }], quads, v);

    const centre = centreOf(quads[7], v);
    const ink = rgbOf(INK);
    const tile = rgbOf(TILE_LIT);
    let exact = 0;
    let blend = 0;
    for (let dx = -22; dx <= 22; dx++) {
      for (let dy = -22; dy <= 22; dy++) {
        const p = pixelAt(ctx, centre.x + dx, centre.y + dy);
        if (near(p, ink, 12)) exact++;
        else if (!near(p, tile, 12)) blend++;
      }
    }
    expect(exact).toBeGreaterThan(0);
    expect(blend / (exact + blend)).toBeLessThan(0.12);
  });

  it('draws nothing for a tile it was given no quad for', () => {
    const { stage, mat, ctx } = scene([7]);
    const v = stage.viewport();
    expect(() => stampGlyphs(ctx, [{ cell: 999, text: '4' }], mat.quads(), v)).not.toThrow();
  });
});
