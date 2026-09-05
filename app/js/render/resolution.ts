// SPDX-License-Identifier: AGPL-3.0-or-later
// render/resolution — the size this game rasterises at, and why it is not the engine's.
//
// ========================= WHY TWICE THE ENGINE'S WIDTH =========================
// The engine draws at 320x180 (pillar 5). This game draws at 640x360, and the reason is
// geometric rather than a wish for more pixels — it is the same reason the chess game measured.
//
// A projected 3D scene has NO axis-aligned edge. The camera is pitched, so every edge of every
// tile is a diagonal, and a diagonal is precisely what low-resolution raster handles worst: it
// comes out as a staircase. The step of that staircase is ONE SOURCE PIXEL, which means it grows
// with the upscale — at k=5 a one-pixel step is five physical pixels of jaggedness. Doubling the
// source halves the step without touching anything else.
//
// ⚠️ THE WORLD DOES NOT CHANGE. TILE is still 16 and the mat is still 5x4 in world units; only
// the camera zoom doubles, so the same geometry rasterises twice as finely and the mat occupies
// the same fraction of the screen it always did.

import { LOGICAL_W as ENGINE_W, TILE } from '@the-inclusionist/engine/core/constants.js';

export { TILE };

/** How many source pixels this game draws per engine pixel. See the note above. */
export const SOURCE_MULTIPLE = 2;

export const LOGICAL_W = ENGINE_W * SOURCE_MULTIPLE;              // 640
export const LOGICAL_H = ((ENGINE_W * 9) / 16) * SOURCE_MULTIPLE; // 360

/**
 * The base the UI measures against — the ENGINE's width, not this game's.
 *
 * Type and tap targets are sized for a human hand and a human eye; neither cares that the art is
 * drawn at double density. Measuring them against 640 would halve every control.
 */
export const UI_BASE_W = ENGINE_W;
