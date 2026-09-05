// SPDX-License-Identifier: AGPL-3.0-or-later
// render/frame-ticker — the frame clock, in the shape the engine's `startLoop` expects.
//
// ========================= WHAT THIS REPLACED, AND WHAT IT COST =========================
// This game used to composite: Zdog drew into an offscreen canvas, PixiJS took that canvas as a
// NEAREST-sampled texture, and a sprite in the engine's layer stack put it on screen. The only
// thing that seam bought after step 8 was PixiJS's ticker, because the HUD had moved to the DOM
// and the colour-vision correction was always a CSS filter on the region — `region.style.filter`,
// not a Pixi filter. There was never one Pixi filter in this game.
//
// Measured before removing it, from two directions:
//
//   Zdog + PixiJS      601.90 KB raw   183.55 KB gzip
//   Zdog, no Pixi      137.07 KB        45.61 KB
//
// **465 KB raw and 138 KB gzipped, to draw one canvas into another canvas.** The engine's own
// figure for PixiJS is 467 kB, arrived at independently, which is about as good as this kind of
// confirmation gets. For a game that ships to school Chromebooks over school connections, that is
// not a rounding error; it is four fifths of the download.
//
// So Zdog now draws straight into the canvas in the document, and the only part of PixiJS this
// file replaces is the clock.
//
// ========================= AND ONE BUG CLASS DISAPPEARED WITH IT =========================
// The old surface had to call `texture.update()` every frame or the board froze on frame one —
// silently, with input, state and the screen reader all still working. That failure mode no longer
// exists: there is no second copy of the picture to go stale. The test that guarded it is gone
// because the bug it guarded against cannot happen.
//
// ========================= THE SHAPE IS NOT ARBITRARY =========================
// `core/loop.ts` reads `ticker.deltaTime` at the moment it calls the frame, and calls
// `ticker.remove?.(fn)` when a frame throws, so a broken game stops costing 60 wake-ups a second
// on the hardware that can least afford it. Both are honoured here.
//
// `deltaTime` is in FRAMES, not seconds — PixiJS's convention, which the engine inherited and the
// whole animation module is written against. One at 60 fps.

/** 60 fps as milliseconds, the unit `deltaTime` is measured in. */
const FRAME_MS = 1000 / 60;

export interface FrameTicker {
  /** Registered callbacks run in insertion order, once per animation frame. */
  add(fn: () => void): void;
  remove(fn: () => void): void;
  /** Frames elapsed since the previous tick. Read by `startLoop` when it calls the frame. */
  readonly deltaTime: number;
  /** Runs one tick by hand with the given delta. The only way to drive a hidden pane. */
  step(delta?: number): void;
  destroy(): void;
}

export interface FrameTickerOptions {
  /** Injected so a test can drive the clock without a real animation frame. */
  readonly raf?: (fn: (now: number) => void) => number;
  readonly cancel?: (handle: number) => void;
  readonly now?: () => number;
}

export function createFrameTicker(options: FrameTickerOptions = {}): FrameTicker {
  const raf = options.raf ?? ((fn) => requestAnimationFrame(fn));
  const cancel = options.cancel ?? ((handle) => cancelAnimationFrame(handle));
  const now = options.now ?? (() => performance.now());

  const listeners: (() => void)[] = [];
  let delta = 1;
  let last: number | null = null;
  let handle: number | null = null;
  let running = true;

  function fire(): void {
    // A copy, because `startLoop` removes its own callback from inside the callback when a frame
    // throws, and mutating the array being iterated would skip the next listener.
    for (const fn of [...listeners]) fn();
  }

  function tick(at: number): void {
    if (!running) return;
    // The first frame has no previous timestamp. One is the honest answer — zero would make every
    // animation stall for a frame, and the elapsed time since page load is not a frame delta.
    delta = last === null ? 1 : (at - last) / FRAME_MS;
    last = at;
    fire();
    handle = raf(tick);
  }

  handle = raf(tick);

  return {
    add(fn) { listeners.push(fn); },

    remove(fn) {
      const at = listeners.indexOf(fn);
      if (at >= 0) listeners.splice(at, 1);
    },

    get deltaTime() { return delta; },

    step(by = 1) {
      delta = by;
      // Keeps the real clock honest: a hand-driven step must not make the NEXT real frame report
      // the whole time that passed while the pane was hidden.
      last = now();
      fire();
    },

    destroy() {
      running = false;
      if (handle !== null) cancel(handle);
      handle = null;
      listeners.length = 0;
    },
  };
}
