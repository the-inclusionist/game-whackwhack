// SPDX-License-Identifier: AGPL-3.0-or-later
// render/zdog-stage — the illustration and the canvas that goes into the document.
//
// ========================= THERE IS NO COMPOSITOR =========================
// The chess game used to send this canvas to a PixiJS texture and draw it as a sprite. It measured
// what that cost — 601.90 KB raw against 137.07 KB, 183.55 KB gzipped against 45.61 KB — and
// removed it: 465 KB raw to draw one canvas into another. The two reasons it was there both
// evaporated. The HUD moved to the DOM, because at 7 px tall canvas text is illegible, does not
// scale with the reader's own type setting, and is invisible to a screen reader. And the
// colour-vision correction was always a CSS filter on the region, never a Pixi filter.
//
// This game is built without that seam from the start. Zdog draws into the canvas that IS in the
// document, `render/frame-ticker` supplies the clock in the shape `core/loop` expects, and the
// numbers are stamped on afterwards by a Canvas2D pass — which is exactly the arrangement spike 0
// measured when it chose candidate (b).
//
// One whole bug class went with the compositor: there is no second copy of the picture, so it
// cannot go stale, so the silent freeze that a missing `texture.update()` used to cause is not a
// thing that can happen here.
//
// ========================= THE INVARIANT THIS FILE EXISTS TO HOLD =========================
// ⚠️ `Zdog.Illustration` up-rezzes for HiDPI, and the obvious defence does not work.
//
// The chess game writes `illo.pixelRatio = 1` and then `illo.setSize(w, h)`. That order is
// BACKWARDS, and it passes only because headless Chromium and most development machines report a
// devicePixelRatio of 1. Read Zdog's own `setSizeCanvas`:
//
//     var pixelRatio = this.pixelRatio = window.devicePixelRatio || 1;   // OVERWRITES
//     this.element.width = this.canvasWidth = width * pixelRatio;
//     if ( needsHighPixelRatioSizing ) { this.element.style.width = width + 'px'; ... }
//
// `setSize` re-reads `window.devicePixelRatio` and throws away whatever `pixelRatio` was set to,
// so assigning it first accomplishes nothing. On a 3x screen the canvas comes out 1920x1080, the
// low resolution that is pillar 5 of the engine evaporates, and NOTHING reports an error — and as
// a second injury Zdog stamps an inline `style.width` in CSS pixels, which then fights the
// engine's own layout for control of the element's size.
//
// So the size is set FIRST and the up-rez is undone after, on every field `prerenderCanvas` reads:
// `pixelRatio`, `canvasWidth`, `canvasHeight`, and the element's own attributes. The inline style
// Zdog may have stamped is removed, because sizing the region belongs to `ui/layout`.
//
// tests/canvas.browser.test.ts forces devicePixelRatio to 3 before building a stage, which is what
// makes this a real gate rather than one that happens to be green on this machine.

import Zdog, { type Anchor, type Illustration } from 'zdog';
import { LOGICAL_H, LOGICAL_W } from './resolution.ts';
import type { Viewport } from './picking.ts';

/** Camera and framing. Every number measured in docs/spike-0-symbol-legibility.md. */
export const CAMERA = {
  /**
   * Pitch in radians. Negative tilts the far edge of the mat away from the viewer.
   *
   * −0.9 rather than the chess game's −1: shallower, because a steeper pitch squeezes five rows
   * into too little screen height to keep the tiles apart.
   */
  pitch: -0.9,
  yaw: 0,
  /**
   * ⚠️ THIS NUMBER HAS MOVED TWICE, AND BOTH MOVES WERE CORRECTIONS TO A REAL MISTAKE.
   *
   * Spike 0 fixed 4.4 while measuring GLYPH LEGIBILITY and never measured FRAMING — a scoping
   * mistake in the spike, not a wrong reading. At 4.4 the mat floated in an empty field. 5.4 fixed
   * that for a mat 5 wide and 4 deep.
   *
   * Then the mat became 4 wide and 5 DEEP, which is the shape the original's own stylesheet uses,
   * and depth costs vertical room: five rows at 5.4 ran off the bottom of the frame. 5.0 is what
   * fits `MAT_ROWS × TILE × sin(pitch) + TILE_RISE × cos(pitch)` inside 360 with margin.
   */
  zoom: 5.0,
  /**
   * ⚠️ PUSHES THE MAT LEFT to clear the HUD column, which owns 27.5% of the frame.
   *
   * It was 0 while the HUD was a bottom band. The mat turning portrait moved the HUD back to a
   * column — a portrait mat leaves WIDTH, a landscape one leaves height — and this moved with it.
   *
   * In WORLD units: the zoom already scales it to the screen, and scaling it here as well is what
   * pushed the chess board off the left edge the first time anyone tried.
   */
  offsetX: -17,
  /**
   * Centred vertically. It was −6 while the HUD was a band across the bottom, lifting the mat so
   * the near row did not vanish under it — which it had been doing, and was reported as tiles
   * being cut off. With the HUD in a column there is nothing at the bottom to clear.
   */
  offsetY: 0,
} as const;

/**
 * How far a lit tile rises out of the mat, in world units.
 *
 * ⚠️ This is the PRIMARY signal that a tile is in play — not its colour, and above all not a
 * blink. Height is the non-colour channel WCAG 1.4.1 asks for, it is the mole leaving its hole,
 * and it replaces the original's blinking slab, which is a photosensitivity risk under WCAG 2.3.1.
 * 7 units lifts a tile 19.1 px on screen at this camera, measured.
 */
export const TILE_RISE = 7;

export interface ZdogStage {
  /** The 640×360 canvas. This one goes INTO the document; there is nothing downstream of it. */
  readonly canvas: HTMLCanvasElement;
  /** Add scene content here, not to the illustration — this anchor carries the framing. */
  readonly root: Anchor;
  /** Applies transforms, re-sorts, and draws. */
  render(): void;
  /** Transforms and sorts WITHOUT drawing — enough to read projected points for picking. */
  update(): void;
  viewport(): Viewport;
  setCamera(pitch: number, yaw: number): void;
  camera(): { pitch: number; yaw: number };
  destroy(): void;
}

export interface ZdogStageOptions {
  /** Overrides the logical size. Only for measuring what a different resolution would cost. */
  readonly width?: number;
  readonly height?: number;
  /** Injected so a test can build a stage without reaching for the global document. */
  readonly doc?: Pick<Document, 'createElement'>;
}

export function createZdogStage(options: ZdogStageOptions = {}): ZdogStage {
  const width = options.width ?? LOGICAL_W;
  const height = options.height ?? LOGICAL_H;
  const doc = options.doc ?? document;

  const canvas = doc.createElement('canvas') as HTMLCanvasElement;
  canvas.width = width;
  canvas.height = height;

  const illo: Illustration = new Zdog.Illustration({
    element: canvas,
    zoom: CAMERA.zoom * (width / LOGICAL_W),
    centered: true,
    // The engine owns the frame loop and the pointer; Zdog must not add listeners of its own.
    resize: false,
    dragRotate: false,
  });

  // ⚠️ This block is the invariant described at the top, and the ORDER is the whole point:
  // `setSize` re-reads window.devicePixelRatio and overwrites `pixelRatio`, so it has to run
  // before the correction rather than after it.
  illo.setSize(width, height);
  illo.pixelRatio = 1;
  illo.canvasWidth = width;
  illo.canvasHeight = height;
  // Read back from the illustration rather than from `width` again: it states the invariant —
  // the element and Zdog's idea of the element agree — instead of restating a number, and it
  // makes these lines textually distinct from the ones that sized the canvas before construction.
  canvas.width = illo.canvasWidth;
  canvas.height = illo.canvasHeight;
  // Zdog stamps these when it up-rezzes. Sizing the element is ui/layout's job, not Zdog's.
  canvas.style.removeProperty('width');
  canvas.style.removeProperty('height');

  illo.rotate.x = CAMERA.pitch;
  illo.rotate.y = CAMERA.yaw;

  // The offset is in WORLD units and the zoom already scales it to the screen. Scaling it here as
  // well double-counts, which is what pushed the chess board off the left edge the first time.
  const root = new Zdog.Anchor({ addTo: illo, translate: { x: CAMERA.offsetX, y: CAMERA.offsetY } });

  return {
    canvas,
    root,

    render() { illo.updateRenderGraph(); },
    update() { illo.updateGraph(); },

    viewport() {
      return { width, height, zoom: illo.zoom };
    },

    setCamera(pitch, yaw) {
      illo.rotate.x = pitch;
      illo.rotate.y = yaw;
    },

    camera() {
      return { pitch: illo.rotate.x, yaw: illo.rotate.y };
    },

    destroy() { illo.children.length = 0; },
  };
}
