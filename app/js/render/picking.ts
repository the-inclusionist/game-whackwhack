// SPDX-License-Identifier: AGPL-3.0-or-later
// render/picking — which square did the pointer land on.
//
// ========================= WHY THERE IS NO RAYCASTER HERE =========================
// Zdog offers no picking at all, and this game does not need one. The board is a PLANE and the
// only thing worth hitting is a SQUARE, never a mesh: a piece is selected THROUGH the square it
// stands on, which is how a chess interface should behave anyway. So the whole problem reduces to
// point-in-quadrilateral over 64 already-projected quads, which is arithmetic.
//
// The projected corners come for free. After `updateGraph()`, every `Zdog.Rect` carries its four
// corners as `pathCommands[i].endRenderPoint` — the same points the renderer is about to draw.
// Reading them costs nothing and cannot drift from what is on screen.
//
// ========================= PURE ON PURPOSE =========================
// Nothing here touches Zdog, the DOM or a canvas. That is what lets the geometry be tested in the
// node project against fixtures, and it keeps the one hard case — a degenerate quad — provable
// rather than argued about. The adapter that reads corners out of Zdog lives with the board.

export interface Point2 { readonly x: number; readonly y: number }

/**
 * A projected square.
 *
 * `depth` is Zdog's `sortValue`. Zdog sorts `flatGraph` ascending and renders in that order, so a
 * HIGHER value was drawn later and is nearer the viewer — which makes it the right tie-break when
 * a tall piece makes two squares overlap under the pointer.
 */
export interface Quad {
  readonly corners: readonly [Point2, Point2, Point2, Point2];
  readonly depth: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/**
 * Below this, a quad is treated as having collapsed to a line and hits nothing.
 *
 * Small enough that a legitimately thin square — the board seen at a steep angle — still picks.
 * The practical defence against a flat board is the camera's pitch clamp; this is the backstop
 * for the case where the clamp is bypassed or the projection degenerates for another reason.
 */
const MIN_AREA = 1e-6;

function cross(o: Point2, a: Point2, b: Point2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Absolute area by the shoelace formula. Winding-agnostic. */
export function quadArea(corners: Quad['corners']): number {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Is `p` inside the quad? The boundary counts as inside, so a click on the edge shared by two
 * squares hits both and `pickTopmost` resolves it by depth — deterministically, rather than
 * falling through to nothing.
 *
 * Assumes a convex quad, which a projected square always is: Zdog projects orthographically, and
 * an orthographic projection of a square is a parallelogram. Winding may be either way round.
 */
export function containsPoint(corners: Quad['corners'], p: Point2): boolean {
  // A collapsed quad has no non-zero cross product, so the sign test below would report EVERY
  // point as inside — an edge-on board would answer every click with an invisible square.
  if (quadArea(corners) < MIN_AREA) return false;

  let negative = false;
  let positive = false;
  for (let i = 0; i < corners.length; i++) {
    const c = cross(corners[i], corners[(i + 1) % corners.length], p);
    if (c < 0) negative = true;
    else if (c > 0) positive = true;
    if (negative && positive) return false;
  }
  return true;
}

/**
 * Index of the nearest quad containing `p`, or null. Linear over 64 quads, which at a few hundred
 * nanoseconds is not worth an acceleration structure.
 */
export function pickTopmost(quads: readonly Quad[], p: Point2): number | null {
  let best: number | null = null;
  let bestDepth = -Infinity;
  for (let i = 0; i < quads.length; i++) {
    const q = quads[i];
    if (q.depth <= bestDepth) continue;
    if (!containsPoint(q.corners, p)) continue;
    best = i;
    bestDepth = q.depth;
  }
  return best;
}

/**
 * Canvas pixels to illustration units — the inverse of what Zdog's `prerenderCanvas` applies:
 *
 *     screen = point * (pixelRatio * zoom) + (width / 2, height / 2) * pixelRatio
 *
 * `pixelRatio` is 1 by invariant throughout this game (see render/zdog-stage and the browser test
 * that guards it), so it drops out. Inverting once per click beats projecting 20 tiles forward.
 *
 * `screen` must already be in CANVAS pixels — 640×360 — not CSS pixels. The canvas is displayed at
 * a whole multiple of its resolution, so the caller divides by that factor first.
 */
export function toIllustrationSpace(screen: Point2, viewport: Viewport): Point2 {
  return {
    x: (screen.x - viewport.width / 2) / viewport.zoom,
    y: (screen.y - viewport.height / 2) / viewport.zoom,
  };
}

/** The forward direction: an illustration point to canvas pixels. */
export function toCanvasSpace(point: Point2, viewport: Viewport): Point2 {
  return {
    x: point.x * viewport.zoom + viewport.width / 2,
    y: point.y * viewport.zoom + viewport.height / 2,
  };
}

/**
 * Centre of a projected quad, in canvas pixels. Where the number goes.
 *
 * The mean of four corners rather than the midpoint of a diagonal: a projected square is a
 * parallelogram, so the two agree, and the mean stays right if the projection ever stops being
 * orthographic.
 */
export function centreOf(quad: Quad, viewport: Viewport): Point2 {
  let x = 0;
  let y = 0;
  for (const c of quad.corners) {
    x += c.x;
    y += c.y;
  }
  return toCanvasSpace({ x: x / quad.corners.length, y: y / quad.corners.length }, viewport);
}
