// SPDX-License-Identifier: AGPL-3.0-or-later
// render/fade — a tile that has been answered leaves, instead of vanishing between frames.
//
// ========================= WHAT THIS FIXES =========================
// ⚠️ The renderer used to light every tile in the wave and stamp every number, resolved or not, so
// a tile you had just hit sat there with its number on it. The score went up and the mat did not
// change, which reads as a broken game — and it was reported as exactly that.
//
// The fix is that a resolved tile stops being drawn. The fade is what makes the disappearance
// legible: a number that blinks out between two frames is a change a child can miss, especially
// when three others are still on the mat.
//
// ========================= REDUCED MOTION IS NOT A SETTING HERE =========================
// The duration is a parameter, and zero is a supported value that makes every fade finish
// instantly. That is what `prefers-reduced-motion` maps to, and it is why the module is written
// around a duration rather than around an animation: honouring the preference is then arithmetic
// rather than a second code path that can rot.
//
// ========================= AND IT IS PURE =========================
// No canvas, no clock of its own — `now` comes in. So the whole curve is exercised in the node
// project, including the one case an eye cannot check: that a fade which has finished is GONE
// rather than lingering at alpha zero, because a list that only grows is a leak that shows up an
// hour into a lesson.

export const FADE_MS = 260;

export interface FadingGlyph {
  readonly cell: number;
  readonly text: string;
  /** 1 at the moment it starts, 0 when it is over. */
  readonly alpha: number;
}

export interface Fades {
  /** Begins a fade for `cell`. Starting one that is already fading restarts it. */
  start(cell: number, text: string, now: number): void;
  /** Everything still visible at `now`, and nothing that is not. */
  active(now: number): FadingGlyph[];
  /** Is anything still moving? The frame loop uses this to know it must draw again. */
  busy(now: number): boolean;
  /** Drops everything. Called between rounds, so a new mat starts clean. */
  clear(): void;
}

export interface FadeOptions {
  /**
   * Milliseconds. ZERO is meaningful and supported: it is what reduced motion maps to, and it
   * makes every fade already finished, so nothing is drawn and nothing is animated.
   */
  readonly durationMs?: number;
}

export function createFades(options: FadeOptions = {}): Fades {
  const duration = Math.max(0, options.durationMs ?? FADE_MS);
  const started = new Map<number, { text: string; at: number }>();

  function alphaOf(at: number, now: number): number {
    if (duration === 0) return 0;
    const elapsed = now - at;
    if (elapsed <= 0) return 1;
    if (elapsed >= duration) return 0;
    return 1 - elapsed / duration;
  }

  /** Removes anything finished. Called by every read, so the map cannot grow across a round. */
  function sweep(now: number): void {
    for (const [cell, entry] of started) {
      if (alphaOf(entry.at, now) <= 0) started.delete(cell);
    }
  }

  return {
    start(cell, text, now) {
      // A duration of zero still records nothing rather than an entry that is instantly swept:
      // the sweep would do it, but not recording is cheaper and says the same thing.
      if (duration === 0) return;
      started.set(cell, { text, at: now });
    },

    active(now) {
      sweep(now);
      const out: FadingGlyph[] = [];
      for (const [cell, entry] of started) {
        out.push({ cell, text: entry.text, alpha: alphaOf(entry.at, now) });
      }
      return out;
    },

    busy(now) {
      sweep(now);
      return started.size > 0;
    },

    clear() { started.clear(); },
  };
}
