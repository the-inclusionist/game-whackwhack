// SPDX-License-Identifier: AGPL-3.0-or-later
// The invariant that fails silently.
//
// ⚠️ `Zdog.Illustration` defaults `pixelRatio` to `devicePixelRatio` and, given no explicit size,
// measures the ELEMENT. This canvas is displayed at a whole multiple of its resolution, so left
// alone the backing store comes out several times too large, the low resolution that is pillar 5
// of the engine evaporates, and NOTHING anywhere reports an error — the game simply stops being a
// pixel game while every other test stays green. `pixelRatio = 1` plus an explicit `setSize` is
// the defence, and this file is what keeps both lines in render/zdog-stage.

import { afterEach, describe, expect, it } from 'vitest';
import { LOGICAL_H, LOGICAL_W, SOURCE_MULTIPLE } from '../app/js/render/resolution.ts';
import { CAMERA, createZdogStage } from '../app/js/render/zdog-stage.ts';
import { createMat } from '../app/js/render/mat.ts';
import { MAT_CELLS, MAT_COLS } from '../app/js/rules/grid.ts';

const made: { destroy(): void }[] = [];
function stage(width?: number, height?: number) {
  const s = createZdogStage(width === undefined ? {} : { width, height });
  made.push(s);
  return s;
}

afterEach(() => {
  for (const s of made) s.destroy();
  made.length = 0;
  document.body.replaceChildren();
});

describe('[Resolution] the backing store is the logical size, whatever CSS says', () => {
  it('is 640 by 360 in real pixels', () => {
    const s = stage();
    expect(s.canvas.width).toBe(LOGICAL_W);
    expect(s.canvas.height).toBe(LOGICAL_H);
  });

  it('stays at the logical size while the element measures four times that', () => {
    // The trap, stated as an assertion: measuring the ELEMENT does not give you the resolution.
    const s = stage();
    s.canvas.style.width = `${LOGICAL_W * 4}px`;
    s.canvas.style.height = `${LOGICAL_H * 4}px`;
    s.canvas.style.imageRendering = 'pixelated';
    document.body.appendChild(s.canvas);

    s.render();

    expect(s.canvas.width).toBe(LOGICAL_W);
    expect(s.canvas.height).toBe(LOGICAL_H);
    expect(Math.round(s.canvas.getBoundingClientRect().width)).toBe(LOGICAL_W * 4);
  });

  it('survives a device pixel ratio above one', () => {
    // ⚠️ THE ACTUAL TRAP, and it needs staging. Headless Chromium reports devicePixelRatio 1, so
    // a stage built here would come out right even with `pixelRatio = 1` deleted — the gate would
    // be green and worthless. Zdog reads window.devicePixelRatio at construction, so forcing it to
    // 3 first is what reproduces the HiDPI machine this would otherwise only break on.
    const real = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    try {
      const s = stage();
      expect(window.devicePixelRatio).toBe(3);
      // 1920 instead of 640 is what a missing `pixelRatio = 1` produces, in silence.
      expect(s.canvas.width).toBe(LOGICAL_W);
      expect(s.canvas.height).toBe(LOGICAL_H);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: real, configurable: true });
    }
  });

  it('is a whole multiple of the engine base, so it integer-scales beside it', () => {
    expect(LOGICAL_W).toBe(320 * SOURCE_MULTIPLE);
    expect(Number.isInteger(SOURCE_MULTIPLE)).toBe(true);
    expect(LOGICAL_W / LOGICAL_H).toBeCloseTo(16 / 9, 5);
  });

  it('reports a viewport that matches the canvas it drew into', () => {
    // Picking inverts this projection. If the viewport and the canvas ever disagree, clicks land
    // on the wrong tile with nothing to indicate why.
    const s = stage();
    const v = s.viewport();
    expect(v.width).toBe(s.canvas.width);
    expect(v.height).toBe(s.canvas.height);
    expect(v.zoom).toBeCloseTo(CAMERA.zoom, 6);
  });
});

describe('[Canvas] the stage actually draws', () => {
  it('leaves the canvas untouched before anything is added', () => {
    const s = stage();
    const ctx = s.canvas.getContext('2d');
    expect(ctx).not.toBeNull();
    s.render();
    const [, , , alpha] = ctx!.getImageData(0, 0, 1, 1).data;
    expect(alpha).toBe(0);
  });

  it('honours an overridden size, which is how a spike measures another resolution', () => {
    const s = stage(320, 180);
    expect(s.canvas.width).toBe(320);
    expect(s.canvas.height).toBe(180);
    // The zoom scales with the source so the SAME world fills the SAME fraction of the frame.
    expect(s.viewport().zoom).toBeCloseTo(CAMERA.zoom / 2, 6);
  });
});

describe('[Interface] the camera is the one spike 0 locked', () => {
  it('starts at the measured pitch and zoom', () => {
    const s = stage();
    expect(s.camera().pitch).toBeCloseTo(CAMERA.pitch, 6);
    expect(s.camera().yaw).toBeCloseTo(0, 6);
    expect(CAMERA.pitch).toBeCloseTo(-0.9, 6);
    // ⚠️ THIS COMMENT NARRATED 5.4 AND 4.6 WHILE THE LINE BELOW ASSERTED 5.0. Three values, one
    // of them true, and the prose was the part nobody re-read. The history, corrected:
    //
    //   4.4  spike 0's value. The spike measured GLYPH LEGIBILITY and never measured FRAMING --
    //        a scoping mistake in the spike, not a wrong reading -- and at 4.4 the mat floated in
    //        an empty field.
    //   5.4  fixed that, for a mat five wide and four deep.
    //   5.0  where it is. The mat became four wide and FIVE deep, the shape the original's own
    //        stylesheet uses, and depth costs vertical room: five rows at 5.4 ran off the bottom.
    //
    // The framing block below is what makes the number checkable instead of remembered.
    expect(CAMERA.zoom).toBeCloseTo(5.0, 6);
  });

  it('pushes the mat left, because the HUD IS a side column', () => {
    // ⚠️ THIS TEST HAD AN EMPTY BODY. A name, a comment explaining the reasoning, and not one
    // assertion -- so it passed unconditionally, for every value of `offsetX` including zero, and
    // it is the exact defect the whole mutation harness exists to hunt. Found by reading, which is
    // the one way it could be found: a mutation cannot make an empty test fail either.
    expect(CAMERA.offsetX).toBeLessThan(0);
    // In WORLD units, not screen ones: the zoom already scales it, and scaling here as well is
    // what pushed the chess board off the left edge the first time anyone tried.
    expect(CAMERA.offsetX).toBeCloseTo(-17, 6);
    // A portrait mat leaves WIDTH, so the HUD took the width back and the mat moved off centre.
    // Vertically there is nothing to clear, and that is the other half of the same decision.
    expect(CAMERA.offsetY).toBe(0);
  });

  it('moves when told to', () => {
    const s = stage();
    s.setCamera(-1.1, 0.3);
    expect(s.camera().pitch).toBeCloseTo(-1.1, 6);
    expect(s.camera().yaw).toBeCloseTo(0.3, 6);
  });
});

/**
 * ========================= THE FRAMING, MEASURED RATHER THAN LOOKED AT =========================
 * ⚠️ THE GAP THIS CLOSES WAS REPORTED BY THE DEV, TWICE: "o tatame está muito embaixo, está
 * cortando os blocos da última linha", and before that a mat that floated in an empty field at
 * spike 0's zoom of 4.4. Both are framing, both were invisible to every test in this suite, and
 * both were found by a person looking at a screen.
 *
 * It is not a screenshot diff. A PNG comparison across machines and GPUs fails on antialiasing and
 * font hinting long before it fails on framing, and this repository's whole discipline is to
 * measure the thing being claimed. What is claimed here is four numbers, all read off the
 * renderer's OWN projected corners:
 *
 *   · nothing is cut off, top or bottom;
 *   · the mat clears the HUD column;
 *   · it is not tiny -- the 4.4 failure;
 *   · it is not overflowing -- the 5.4-at-five-rows failure.
 *
 * Baselines measured at 640x360: the mat spans x 82.5..387.5 of 640 and y 7.5..330.8 of 360, which
 * is 65.7% of the width the HUD leaves and 89.8% of the height. The bounds below are wide enough
 * that antialiasing cannot move them and narrow enough that either reported failure lands outside.
 */
describe('[Right] the mat is framed, and neither cut off nor lost in the frame', () => {
  /** Every projected corner, in canvas pixels, over the states that move the geometry. */
  function corners(lit: number[]): { x: number; y: number }[] {
    const s = stage();
    const mat = createMat(s.root);
    made.push(mat);
    mat.setLit(lit);
    s.render();
    const v = s.viewport();
    return mat.quads().flatMap((q) => q.corners.map((c) => ({
      x: c.x * v.zoom + v.width / 2,
      y: c.y * v.zoom + v.height / 2,
    })));
  }

  /**
   * ⚠️ THE UNION OF TWO STATES. A lit tile RISES, so an empty mat is the worst case for the bottom
   * edge and a fully lit one is the worst case for the top. Measuring one of them would leave the
   * other free to run off the frame.
   */
  function box() {
    const pts = [...corners([]), ...corners([...Array(MAT_CELLS).keys()])];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
  }

  it('cuts nothing off at the top or the bottom', () => {
    const b = box();
    const { height } = stage().viewport();
    expect(b.t, 'the far row is above the frame').toBeGreaterThanOrEqual(0);
    expect(b.b, 'the near row is below the frame').toBeLessThanOrEqual(height);
  });

  it('clears the HUD column, which owns the right 27.5%', () => {
    // ⚠️ The fraction is read from the stylesheet's own `--hud-fraction` in style.css. It is
    // repeated as a literal here on purpose: this is the assertion that would catch the two
    // drifting apart, and reading it from the same place as the code would make them agree by
    // construction and prove nothing.
    const { width } = stage().viewport();
    expect(box().r).toBeLessThanOrEqual(width * (1 - 0.275));
  });

  it('fills the height it is given, without overflowing it', () => {
    // 0.898 measured. Below 0.70 is the mat floating in an empty field; above 0.97 is the near
    // row about to fall out of the frame.
    const { height } = stage().viewport();
    const b = box();
    expect((b.b - b.t) / height).toBeGreaterThan(0.70);
    expect((b.b - b.t) / height).toBeLessThan(0.97);
  });

  it('fills the width the HUD leaves it, without crowding it', () => {
    // 0.657 measured, of the 72.5% the HUD does not take.
    const { width } = stage().viewport();
    const free = width * (1 - 0.275);
    const b = box();
    expect((b.r - b.l) / free).toBeGreaterThan(0.50);
    expect((b.r - b.l) / free).toBeLessThan(0.95);
  });

  it('puts the far row above the near one, so the mat reads as depth', () => {
    // A pitch of zero projects every row onto the same line and the mat becomes a flat strip that
    // still passes every bound above.
    const s = stage();
    const mat = createMat(s.root);
    made.push(mat);
    s.render();
    const quads = mat.quads();
    const centreY = (q: (typeof quads)[number]) =>
      q.corners.reduce((sum, c) => sum + c.y, 0) / q.corners.length;
    expect(centreY(quads[0])).toBeLessThan(centreY(quads[MAT_CELLS - MAT_COLS]));
  });
});
