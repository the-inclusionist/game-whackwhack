// SPDX-License-Identifier: AGPL-3.0-or-later
// rules/grid — the mat, and the two ways of naming a place on it.
//
// A wave speaks in CELL INDICES because it draws without replacement from a flat list, and the
// engine's contract speaks in SPOTS because a grid topology has a distance in cells. Both are
// right for their own job, so the conversion lives here rather than being re-derived at each
// call site — which is where an off-by-one between row-major and column-major would hide.
//
// ⚠️ `Cell` is declared here rather than imported as the engine's `Spot`, even though the two are
// the same shape. `rules/` may not import the engine (tests/rules-boundary.node.test.ts), and
// structural typing means the declaration can hand these straight across the boundary anyway.
// The duplication is the price of the layer staying testable in milliseconds, and it is cheap.

/**
 * 4 by 5 — read off the original's own stylesheet rather than chosen: its `.gamepad__surface` is
 * `grid-template-columns: repeat(4, 1fr)` over `grid-template-rows: repeat(5, 1fr)`.
 *
 * ⚠️ I had it 5 by 4, reasoning from a 16:9 canvas, AFTER the Dev had already said "4x5 azulejos".
 * The mat is deeper than it is wide, and that costs vertical room the framing has to give back —
 * see CAMERA in render/zdog-stage, where the mat now sits above centre to clear the HUD.
 */
export const MAT_COLS = 4;
export const MAT_ROWS = 5;
export const MAT_CELLS = MAT_COLS * MAT_ROWS;

/** A place on the mat. Structurally the engine's `Spot`; see the note above. */
export interface Cell {
  readonly x: number;
  readonly y: number;
}

export function inBounds(at: Cell): boolean {
  return Number.isInteger(at.x) && Number.isInteger(at.y)
    && at.x >= 0 && at.x < MAT_COLS
    && at.y >= 0 && at.y < MAT_ROWS;
}

/** Row-major, so cell 0 is the far-left of the back row and cell 19 is the near-right. */
export function spotOfCell(cell: number): Cell {
  return { x: cell % MAT_COLS, y: Math.floor(cell / MAT_COLS) };
}

/** The inverse. Returns -1 for anything off the mat, which is a legitimate question to ask. */
export function cellOfSpot(at: Cell): number {
  return inBounds(at) ? at.y * MAT_COLS + at.x : -1;
}
