// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/vision — colour-vision correction, because the engine mounts the icon for nobody.
//
// ========================= WHY THIS FILE EXISTS AT ALL =========================
// 📏 MEASURED 2026-09-11, against engine 8.0.0. `boot/create-game` builds the accessibility bar by
// asking `iconesQueAccionam({ tema, correcao, seguraTeclas })`, and it answers the first two with
// `Boolean(ctx.setTemaDoJogador)` / `Boolean(ctx.setCorrecaoDoJogador)` — two writers it never
// passes and `CreateGameOptions` has no field for. So the contrast and colour-vision icons are
// mounted for NO game that boots through `createGame`. This game's bar carries seven icons and
// neither of those two.
//
// ⚠️ AND THE ENGINE IS RIGHT TO WITHHOLD THEM. ADR-0106 §5 says an icon with nothing behind it is
// worse than no icon: a bar that offers a path and then refuses it teaches a child the path is not
// for her. The defect is not the filter — it is that a consumer has no way to BE the writer.
//
// ⚠️ WHAT IT COSTS HERE IS SPECIFIC, which is why this was worth building rather than filing.
// `render/palette.ts` measured this entire palette under protanopia, deuteranopia and tritanopia —
// that is where `--tile-idle` and `--accent` come from — and `#cvd` builds the six SVG filters at
// boot. All of it already works. None of it could be switched on by the child it was measured for.
//
// ========================= WHAT IS THIS GAME'S, AND WHAT IS NOT =========================
// Almost nothing here is a decision. The cycle is `proximaCorrecao`, the resolution is
// `aplicacao`, the CSS is `VIZ_FILTER`, the storage key is `KEYS.visualP`, and the application is
// `engine.aplicarFiltroDeVisao` — every one of them the engine's own. What this game supplies is
// the one thing the engine asked a consumer for and gave it no parameter to answer with: somewhere
// to keep the state.
//
// 📌 THE KEY IS THE ENGINE'S ON PURPOSE. `KEYS.visualP(0)` is where every inclusionist game keeps
// this, so a child who sets her correction in one game finds it already set in the next on the same
// origin. A key invented here would have made this game the one that forgets.
//
// ⚠️ CORRECTION ONLY, NOT CONTRAST, and the split is not laziness. The correction axis is a CSS
// filter over the declared world and nothing else; high contrast means REPAINTING the mat from the
// declared roles, and `render/high-contrast` cannot help — it is written for the platformer
// (`PaintableRole = 'hazard' | 'climb' | 'water'`, sprite and world texture caches) and a Zdog game
// draws shapes. That half is colour work in a palette the Dev has tuned by hand twice, so it is his
// call and not a wiring job. Mounting a contrast icon with nothing behind it would be the very
// dead button this file exists to avoid.
//
// 📌 DELETE THIS FILE the day `CreateGameOptions` takes the two writers. It is the same shape as
// `reviveResume` in `boot/main`, and it should die the same way.

import { KEYS, get, set } from '@the-inclusionist/engine/platform/storage.js';
import {
  PADRAO, aplicacao, migrarVisual, proximaCorrecao, type VisualState,
} from '@the-inclusionist/engine/render/viz-axes.js';
import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';

/** The one player. This game seats a single child, so the index never varies. */
const SEAT = 0;

/**
 * The state as the storage has it, run through the engine's own migration.
 *
 * ⚠️ `migrarVisual` AND NOT `JSON.parse`, because what is on disk may predate the axes being split
 * (issue #104 — theme and correction used to overwrite each other in one field). The engine knows
 * how to read its own old writing; this game reading it raw would resurrect the collision.
 */
export function readVision(): VisualState {
  const raw = get(KEYS.visualP(SEAT), null);
  if (!raw) return PADRAO;
  try {
    return migrarVisual(JSON.parse(raw));
  } catch {
    // A corrupt value is not an error worth showing a child. The defaults are always playable.
    return PADRAO;
  }
}

/** Writes it back. Returns whether the storage accepted, the way `store/high-score` does. */
export function writeVision(v: VisualState): boolean {
  return set(KEYS.visualP(SEAT), JSON.stringify(v));
}

/** The next correction in the engine's ring: tricro → protan → deuter → tritan → tricro. */
export function nextVision(v: VisualState): VisualState {
  return proximaCorrecao(v);
}

/**
 * The CSS this state asks for, or the empty string for none.
 *
 * ⚠️ THROUGH `aplicacao` RATHER THAN `filtroChave`, because the two axes have to be resolved
 * TOGETHER — that is the whole of issue #104. A state carrying both `hc7` and `deuter` returns both
 * halves, and reading only one of them is how applying one used to erase the other.
 */
export function visionCss(v: VisualState): string {
  const key = aplicacao(v).filtro;
  if (!key) return '';
  return VIZ_FILTER[key as keyof typeof VIZ_FILTER] ?? '';
}
