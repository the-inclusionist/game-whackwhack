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
// declaration that closed over the first tiles would keep answering about a mat that emptied
// minutes ago, and nothing would report it — the engine would simply narrate the wrong board.

import type {
  Focus, GameDeclaration, Objective, Role, Speakable, Spot, Topology, WorldScope,
} from '@the-inclusionist/engine/core/contract.js';
import type { Category } from '../rules/category.ts';
import type { RoundTile } from '../rules/round.ts';
import { ROUND_GOAL } from '../rules/difficulty.ts';
import { MAT_COLS, MAT_ROWS, cellOfSpot } from '../rules/grid.ts';

/** The slice of the round the declaration needs. Read-only, and deliberately small. */
export interface RoundView {
  readonly category: Category;
  /**
   * What is on the mat right now. EMPTY between tiles, which is an ordinary state and not an
   * absence to special-case.
   *
   * ⚠️ It was `wave: RoundWave | null`, and the null was doing two jobs at once — "no round" and
   * "the gap between waves" — so every reader had to guard it before touching anything. An empty
   * array needs no guard, and the three `if (!view.wave) return` lines below went with it.
   */
  readonly tiles: readonly RoundTile[];
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

/**
 * ⚠️ WHICH ELEMENT IS THE WORLD, and it is `#game-region` rather than the canvas.
 *
 * The engine applies what belongs to the world there and only there — the colour-vision
 * simulation among it. The canvas alone would be the tempting answer, since the mat is what the
 * child plays on, and it would be wrong twice: the grid mirror (the twenty real buttons a screen
 * reader navigates) is a sibling of the canvas and is just as much the board, and a player who
 * needs a deuteranopia simulation needs it over the SCORE as well as over the tiles. The region
 * is the smallest element that contains all three.
 *
 * `none` was not an option here and the contract is explicit that it must not be a default: a
 * game of pure DOM is not a game where empathy makes no sense — blindfold chess is the proof —
 * it is one where it asks more of whoever writes it.
 */
const WORLD: WorldScope = { kind: 'element', selector: '#game-region' };

export function createWhackDeclaration(deps: DeclarationDeps): GameDeclaration {
  /**
   * The tile at `at`, or undefined. Off-mat spots resolve to cell -1 and match nothing.
   *
   * ⚠️ There used to be a `!t.resolved` filter here, and forgetting it was a reported bug: the
   * sonar kept aiming a blind player at a tile they had already collected and `nameAt` kept
   * announcing a number that had gone. The filter is not here any more because the CONDITION is
   * not: a judged tile leaves `round.tiles()` outright, so there is no stale entry to skip. The
   * same rule was being restated in three files, and now it is enforced in the one that owns it.
   */
  function tileAt(at: Spot) {
    const cell = cellOfSpot(at);
    if (cell < 0) return undefined;
    return deps.view().tiles.find((t) => t.cell === cell);
  }

  return {
    /**
     * ⚠️ A FUNCTION SINCE ADR-0084, and it was a value. Five of the six declaration fields were
     * already functions; the sixth was the one that broke, on the 15-puzzle, whose board is 3x3,
     * 4x4 or 5x5 chosen while the game runs. It satisfied `readonly topology: Topology` with a
     * getter — which type-checks, answers live, and is a coincidence of TypeScript rather than a
     * contract: nothing told the next author it was expected and `conformanceProblems` read it
     * once, so a consumer that cached the topology went stale in silence.
     *
     * This mat never resizes, so the function returns a constant. That is one line of ceremony
     * for the common case, which is the cost the ADR weighed and accepted.
     */
    topology(): Topology { return TOPOLOGY; },

    world(): WorldScope { return WORLD; },

    // The clock owns the tick: a tile expires whether or not anyone acts.
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
      // An empty mat gives an empty list, which is an answer and not an error.
      return deps.view().tiles
        .filter((t) => t.correct)
        .map((t) => ({ x: t.cell % MAT_COLS, y: Math.floor(t.cell / MAT_COLS) }));
    },
  };
}
