// SPDX-License-Identifier: AGPL-3.0-or-later
// render/mat — the twenty tiles, and the two things that can change about one.
//
// ========================= BUILT ONCE, MUTATED IN PLACE =========================
// Twenty `Zdog.Rect`s are created at boot and never removed. A wave changes two properties on a
// few of them — the colour and the height — and nothing else. This is the chess game's board
// policy rather than its piece policy: pieces are rebuilt per move because their SHAPE changes,
// and a tile's shape never does.
//
// ========================= HEIGHT IS THE SIGNAL, COLOUR IS THE BACKUP =========================
// ⚠️ A lit tile RISES. That is the primary channel, and it is deliberate on three counts at once:
// height is the non-colour channel WCAG 1.4.1 requires, it is the mole leaving its hole, and it
// replaces the original game's blinking slab — blinking is a photosensitivity risk under WCAG
// 2.3.1, and si-em/whackwhack blinks with no `prefers-reduced-motion` guard at all.
//
// The colour change is the second channel, held to 3:1 by render/palette. Neither is alone.
//
// ========================= THE GAP IS NOT DECORATION, AND IT WAS NOT THERE =========================
// ⚠️ THE GUTTER WAS EXACTLY CANCELLED BY THE STROKE, and the arithmetic is worth writing out
// because nothing about the code looked wrong. The face was built `TILE - GUTTER` wide with
// `stroke: STROKE`, and a Zdog stroke extends STROKE/2 beyond the path on EVERY side — so the
// drawn width was `(TILE - GUTTER) + STROKE`. With GUTTER and STROKE both 1.5 that is exactly
// TILE, the tiles met edge to edge, and the mat rendered as one continuous purple slab. The Dev
// reported it as "os tiles estão sem borda nenhuma entre eles"; the comment here had been
// asserting the opposite for as long as the constant had existed.
//
// So the gap is stated as the thing that has to be true on screen — `TILE_GAP` world units of
// ground visible between two tiles — and the gutter is DERIVED from it and the stroke. Change
// either and the other follows.
//
// It matters for three reasons. A player reading a projected parallelogram at an angle cannot
// tell where one tile ends and the next begins without it. A risen tile would otherwise touch the
// one behind it on screen. And the twenty cells are the grid a keyboard player is navigating —
// invisible boundaries make the mirror's positions unverifiable by eye.

import Zdog, { type Anchor, type Rect } from 'zdog';
import { MAT_CELLS, MAT_COLS, MAT_ROWS } from '../rules/grid.ts';
import { STROKE, TILE_IDLE, TILE_LIT, TILE_LIT_COLD, mixHex } from './palette.ts';
import { TILE } from './resolution.ts';
import { TILE_RISE } from './zdog-stage.ts';
import type { Quad } from './picking.ts';

/**
 * Ground left visible between two neighbouring tiles, in world units.
 *
 * 1.5 of TILE's 16 — a little under a tenth of a tile, which at the camera's zoom of 5 is 7.5
 * source pixels and 15 CSS pixels at the k=2 floor. Measured on screen rather than chosen: at 1.0
 * the seam is a hairline that the antialiasing of a rotated edge swallows.
 */
export const TILE_GAP = 1.5;

/**
 * How much smaller than its cell a tile's PATH is drawn.
 *
 * ⚠️ The stroke is added back on both sides — see the note above — so this is the gap PLUS the
 * stroke, not the gap. Writing `TILE_GAP` here directly is the bug this file shipped with.
 */
const GUTTER = TILE_GAP + STROKE;

export interface MatView {
  /** Lights exactly the cells given, leaving every other tile idle. */
  setLit(cells: Iterable<number>): void;
  /**
   * Puts one tile part of the way up, between 0 and 1. Applied AFTER `setLit`, which resets
   * everything — that ordering is what lets a tile that has just been answered sink back down
   * instead of blinking out of existence between two frames.
   */
  setRaise(cell: number, fraction: number): void;
  /**
   * How much of this tile's time is left, 1 down to 0. Cools its colour towards `TILE_LIT_COLD`.
   *
   * Separate from `setRaise` because they answer different questions — raise says whether the tile
   * is in play, heat says for how much longer — and a tile that is fading out after being answered
   * changes one without the other.
   */
  setHeat(cell: number, fraction: number): void;
  /** The projected quads, in cell order. Valid after the stage has run `update()`. */
  quads(): Quad[];
  destroy(): void;
}

/** World position of a cell's centre. Row 0 is the FAR row; y is the rise, applied per tile. */
export function cellCentre(cell: number): { x: number; z: number } {
  const col = cell % MAT_COLS;
  const row = Math.floor(cell / MAT_COLS);
  return {
    x: (col - (MAT_COLS - 1) / 2) * TILE,
    z: (row - (MAT_ROWS - 1) / 2) * TILE,
  };
}

export function createMat(parent: Anchor): MatView {
  const anchors: Anchor[] = [];
  const faces: Rect[] = [];

  for (let cell = 0; cell < MAT_CELLS; cell++) {
    const at = cellCentre(cell);
    const anchor = new Zdog.Anchor({ addTo: parent, translate: { x: at.x, y: 0, z: at.z } });
    // ⚠️ The stroke is drawn in the tile's OWN fill colour. It is not a grid line: Canvas2D
    // antialiases every path and offers no way off, so a stroke in the fill colour is what gives
    // an antialiased fill a hard edge. Measured in the chess game's palette; carried here.
    const face = new Zdog.Rect({
      addTo: anchor,
      width: TILE - GUTTER,
      height: TILE - GUTTER,
      rotate: { x: Zdog.TAU / 4 },   // lay it flat in the plane of the mat
      stroke: STROKE,
      color: TILE_IDLE,
      fill: true,
    });
    anchors.push(anchor);
    faces.push(face);
  }

  return {
    setLit(cells: Iterable<number>) {
      const lit = cells instanceof Set ? cells : new Set(cells);
      for (let cell = 0; cell < MAT_CELLS; cell++) {
        const on = lit.has(cell);
        // Negative y is UP in Zdog.
        anchors[cell].translate.y = on ? -TILE_RISE : 0;
        faces[cell].color = on ? TILE_LIT : TILE_IDLE;
      }
    },

    setRaise(cell: number, fraction: number) {
      const anchor = anchors[cell];
      if (!anchor) return;
      const amount = Math.min(1, Math.max(0, fraction));
      anchor.translate.y = -TILE_RISE * amount;
      faces[cell].color = amount > 0 ? TILE_LIT : TILE_IDLE;
    },

    setHeat(cell: number, fraction: number) {
      const face = faces[cell];
      if (!face) return;
      // `1 - heat` because the mix runs from the hot colour towards the cold one as time is spent.
      face.color = mixHex(TILE_LIT, TILE_LIT_COLD, 1 - Math.min(1, Math.max(0, fraction)));
    },

    quads(): Quad[] {
      return faces.map((face) => ({
        // Four projected corners, straight off the renderer's own path commands — the same points
        // it is about to draw, so picking and the picture cannot drift apart.
        corners: face.pathCommands.map((c) => c.endRenderPoint) as unknown as Quad['corners'],
        depth: face.sortValue,
      }));
    },

    destroy() {
      for (const anchor of anchors) anchor.remove();
      anchors.length = 0;
      faces.length = 0;
    },
  };
}
