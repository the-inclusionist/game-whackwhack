// SPDX-License-Identifier: AGPL-3.0-or-later
// render/camera — where the viewer stands, and the three limits that matter.
//
// No DOM here: state and arithmetic, so it runs in the node project. The key listeners live in the
// composition root, which is also the only place that knows the canvas is displayed at a whole
// multiple of its resolution.
//
// ========================= NO DRAG. AT ALL. =========================
// The chess game supports dragging and pays for it with a one-second hold before a press becomes a
// rotation, because pointing at a square and spinning the board are the same gesture there. This
// game cannot pay that: the pointer IS the hammer, and a child holding still on a tile for a
// second while the wave expires would be punished for trying to look around.
//
// So the camera moves by keyboard only. That satisfies WCAG 2.5.7 — nothing may require a drag —
// trivially rather than by compensation, and it removes the one gesture conflict this game would
// otherwise have. The original whackwhack tilts its mat with `mousemove`, which excludes keyboard
// and touch entirely and is exactly the thing not to reproduce.
//
// ========================= THE YAW IS CLAMPED, AND THE CHESS GAME'S IS NOT =========================
// ⚠️ A deliberate divergence, and the reason is the grid mirror. A player walks this mat with the
// arrow keys, in GRID space: right means the next column. Turn the board a quarter turn and "right"
// still means the next column while the eye sees it move downwards — the keyboard and the picture
// would disagree about which way is which, and the child holding the keyboard is the one who loses.
//
// A chess player genuinely needs to see the board from the other side, so there the full turn earns
// its cost. Here it buys the character of the original — a mat that leans — and nothing else, so it
// is bounded to a lean: three nudges either way, at which point the mat is unmistakably the same
// mat, seen from slightly aside.

/** Straight down. Past this the mat would start turning over. */
export const PITCH_STEEPEST = -Math.PI / 2;

/**
 * The shallowest view allowed. Not a matter of taste: at pitch 0 the mat lies in the view plane
 * and every tile projects to a LINE. `picking` rejects degenerate quads by design, so the mat
 * would simply stop answering clicks — with no error, no warning, and nothing on screen to explain
 * it. This clamp makes that state unreachable; the area guard in `picking` is the backstop.
 */
export const PITCH_SHALLOWEST = -0.42;

/** The framing measured in docs/spike-0-symbol-legibility.md. */
export const PITCH_DEFAULT = -0.9;

/** A quarter turn is exactly twelve nudges, so a step is a size a person can predict. */
export const NUDGE_YAW = Math.PI / 24;
export const NUDGE_PITCH = Math.PI / 36;

/** Three nudges either side of square-on. See the note above on why this is bounded at all. */
export const YAW_LIMIT = NUDGE_YAW * 3;

/**
 * How far the pointer may tip the mat from its default pitch, either way.
 *
 * Three nudges' worth, so the two ways of holding this control reach the same place — a player who
 * learns the lean with a mouse and then uses the keyboard should not find a view they cannot get
 * back to, and the reverse.
 */
export const POINT_PITCH_RANGE = NUDGE_PITCH * 3;

export interface CameraState {
  readonly pitch: number;
  readonly yaw: number;
}

export type NudgeDirection = 'left' | 'right' | 'up' | 'down';

export interface Camera {
  nudge(direction: NudgeDirection): CameraState;
  /**
   * Leans towards a pointer, in NORMALISED coordinates: −1 … 1 on each axis, 0 being square-on.
   *
   * ⚠️ ABSOLUTE, not relative — it is a position, not a gesture. That is what keeps it from
   * accumulating against `nudge`: whichever input spoke last decides where the mat is, which is
   * what a hand expects of a control it can reach two ways.
   */
  point(x: number, y: number): CameraState;
  set(state: CameraState): CameraState;
  reset(): CameraState;
  snapshot(): CameraState;
}

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_SHALLOWEST, Math.max(PITCH_STEEPEST, pitch));
}

/** Clamped rather than wrapped: this camera leans, it does not orbit. */
export function clampYaw(yaw: number): number {
  return Math.min(YAW_LIMIT, Math.max(-YAW_LIMIT, yaw));
}

export function createCamera(initial: CameraState = { pitch: PITCH_DEFAULT, yaw: 0 }): Camera {
  let pitch = clampPitch(initial.pitch);
  let yaw = clampYaw(initial.yaw);

  const snapshot = (): CameraState => ({ pitch, yaw });

  return {
    snapshot,

    /**
     * ========================= THE HAND MOVES THE MAT, NOT THE CAMERA =========================
     * `left` leans the mat as a hand pushing its near edge left would, and `up` tips the near edge
     * down so more of the top surface comes into view — the way you tilt a tray towards yourself
     * to see what is on it. Naming the directions after the CAMERA instead would invert both, and
     * a control that moves the opposite way to its label is a control that gets abandoned.
     */
    nudge(direction) {
      if (direction === 'left') yaw = clampYaw(yaw + NUDGE_YAW);
      else if (direction === 'right') yaw = clampYaw(yaw - NUDGE_YAW);
      else if (direction === 'up') pitch = clampPitch(pitch + NUDGE_PITCH);
      else pitch = clampPitch(pitch - NUDGE_PITCH);
      return snapshot();
    },

    point(x, y) {
      const nx = Math.max(-1, Math.min(1, x));
      const ny = Math.max(-1, Math.min(1, y));
      // The pointer reaches the SAME limits the keyboard does, so neither way of holding the
      // control shows the player something the other cannot.
      yaw = clampYaw(nx * YAW_LIMIT);
      pitch = clampPitch(PITCH_DEFAULT + ny * POINT_PITCH_RANGE);
      return snapshot();
    },

    set(state) {
      pitch = clampPitch(state.pitch);
      yaw = clampYaw(state.yaw);
      return snapshot();
    },

    reset() {
      pitch = PITCH_DEFAULT;
      yaw = 0;
      return snapshot();
    },
  };
}
