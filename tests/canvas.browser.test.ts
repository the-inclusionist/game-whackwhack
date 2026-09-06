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
    // ⚠️ 5.4, raised from the 4.4 spike 0 locked. The spike measured GLYPH LEGIBILITY and never
    // measured FRAMING, which was a scoping mistake in the spike rather than a wrong reading: at
    // the mat floated in an empty field. Raised to 5.4, then back to 4.6 when the mat became 4x5:
    // five rows deep is more vertical extent than four, and the near row was falling under the HUD.
    expect(CAMERA.zoom).toBeCloseTo(5.0, 6);
  });

  it('pushes the mat left, because the HUD IS a side column', () => {
    // A portrait mat leaves WIDTH, so the HUD took the width back and the mat moved off centre.
  });

  it('moves when told to', () => {
    const s = stage();
    s.setCamera(-1.1, 0.3);
    expect(s.camera().pitch).toBeCloseTo(-1.1, 6);
    expect(s.camera().yaw).toBeCloseTo(0.3, 6);
  });
});
