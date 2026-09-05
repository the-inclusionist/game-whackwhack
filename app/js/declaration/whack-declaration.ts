// SPDX-License-Identifier: AGPL-3.0-or-later
// declaration/whack-declaration — the seven fields of core/contract, answered for this game.
//
// ========================= THIS FILE IS THE ACCESSIBILITY LAYER =========================
// Not a description of it. Answering these seven questions is what buys the sonar for a blind
// player, role-based high contrast, the screen reader, Libras and a translated HUD — none of
// which is written anywhere in this repository.
//
// The whole trick is one line. A lit tile carrying a WRONG value is a `hazard`, in exactly the
// sense the engine already means: something that costs you for touching it. From that, the
// engine's sonar points only at the tiles worth hitting and its colour-blocking marks the ones
// that cost — with no audio code in this game at all. The chess game gets threat warnings from
// the same move, by calling an attacked square a hazard.
//
// ========================= FIRST CONSUMER OF `tick: 'clock'` =========================
// `core/contract.ts` marks that field "SEM CONSUMIDOR NO CÓDIGO AINDA", and ADR-0030 says the
// contract only becomes a result rather than a hypothesis once two presets exist. Chess is the
// first and answers 'player'. This game is the second and is the first to answer 'clock', which
// is the bit that says timing pressure applies and WCAG 2.2.1 is in play.
//
// ========================= IT READS LIVE STATE =========================
// Built once at boot and consulted every frame, so it takes a GETTER rather than a snapshot. A
// declaration that closed over the first wave would keep answering about a wave that ended
// minutes ago, and nothing would report it — the engine would simply narrate the wrong board.

import type {
  Focus, GameDeclaration, Objective, Role, Speakable, Spot, Topology,
} from '@the-inclusionist/engine/core/contract.js';
import type { Category } from '../rules/category.ts';
import type { Wave } from '../rules/wave.ts';
import { ROUND_GOAL } from '../rules/difficulty.ts';
import { MAT_COLS, MAT_ROWS, cellOfSpot } from '../rules/grid.ts';

/** The slice of the round the declaration needs. Read-only, and deliberately small. */
export interface RoundView {
  readonly category: Category;
  /** The wave currently up, or `null` in the gap between waves. */
  readonly wave: Wave | null;
  /** Correct tiles hit so far this round. */
  readonly hits: number;
  /** Where the keyboard cursor sits, or `null` when nothing has focus. */
  readonly focus: Spot | null;
}

export interface DeclarationDeps {
  readonly view: () => RoundView;
  /**
   * Injected rather than imported so the declaration can be exercised in the node project.
   * The composition root passes the engine's `t`.
   */
  readonly t: (key: string) => string;
}

const TOPOLOGY: Topology = { kind: 'grid', cols: MAT_COLS, rows: MAT_ROWS };

export function createWhackDeclaration(deps: DeclarationDeps): GameDeclaration {
  /** The lit tile at `at`, or undefined. Off-mat spots resolve to cell -1 and match nothing. */
  function tileAt(at: Spot) {
    const view = deps.view();
    if (!view.wave) return undefined;
    const cell = cellOfSpot(at);
    return cell < 0 ? undefined : view.wave.tiles.find((t) => t.cell === cell);
  }

  return {
    topology: TOPOLOGY,

    // The clock owns the tick: a wave expires whether or not anyone acts.
    tick: 'clock',

    roleAt(at: Spot): Role {
      const tile = tileAt(at);
      if (!tile) return 'free';
      return tile.correct ? 'goal' : 'hazard';
    },

    nameAt(at: Spot): Speakable | null {
      const tile = tileAt(at);
      if (!tile) return null;
      // ⚠️ The WRONG tile is named too. Falling silent on it would tell a blind player which
      // tiles are correct by omission — an advantage no sighted player has, and one that
      // dissolves the task instead of making it accessible.
      //
      // The text is the digits themselves, which need no translation: a numeral is not language
      // content. Masculine because that is how a number is spoken in pt-BR ("o doze").
      return { text: String(tile.value), gender: 'm', plural: false };
    },

    focusOf(): Focus | null {
      const at = deps.view().focus;
      if (!at) return null;
      // 'none' because a whack-a-mole cursor does not face anywhere. There is no travel to
      // point along, only a position — and claiming a heading would make the engine narrate a
      // direction the player cannot act on.
      return { id: 'cursor', at, heading: 'none' };
    },

    objectiveOf(): Objective {
      const view = deps.view();
      return {
        name: {
          text: deps.t(view.category.nameKey),
          gender: view.category.nameGender,
          plural: view.category.namePlural,
        },
        have: view.hits,
        need: ROUND_GOAL,
      };
    },

    targetsOf(): readonly Spot[] {
      const view = deps.view();
      if (!view.wave) return [];   // between waves. Empty is an answer, not an error.
      return view.wave.tiles
        .filter((t) => t.correct)
        .map((t) => ({ x: t.cell % MAT_COLS, y: Math.floor(t.cell / MAT_COLS) }));
    },
  };
}
