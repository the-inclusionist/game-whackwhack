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
import type { Action } from '@the-inclusionist/engine/core/actions.js';
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

/**
 * ⚠️ A GRID IS NOT ONE THING, and the engine stopped pretending it was. `{ cols, rows }` became
 * `{ size, move, frame }`, and the two new fields are not bookkeeping:
 *
 * · `move` decides the METRIC the sonar counts in. A grid used to be Chebyshev always -- "on a
 *   grid the diagonal costs one step, and that is how a player counts" -- which is true only
 *   where the diagonal is legal. On this mat it is NOT: `ui/grid-mirror`'s `step` moves the
 *   cursor by one in one axis and clamps, with no diagonal anywhere. Declaring `diagonal` here
 *   would under-report distance to a player who cannot see the board, which is not imprecision
 *   but sending a child confidently the wrong way.
 *
 * · `frame` is the vocabulary a direction is SPOKEN in. `compass` for a board seen from above;
 *   `clock` is for a side-on platformer, where north and south mean nothing. This mat is a
 *   tilted top-down board, so north is the far row and that is what a player will hear.
 *
 * `size` is `[columns, rows]` -- a vector because the dimension varies, and `size.length` is the
 * only place that lives.
 */
const TOPOLOGY: Topology = {
  kind: 'grid',
  size: [MAT_COLS, MAT_ROWS],
  move: 'orthogonal',
  frame: 'compass',
};

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

/**
 * The one position whose factory keys collide with this game. Frozen and built once, because
 * `mapeamentoDoTeclado` is called per player count and per seat, and a fresh object each time
 * would be a new identity for a table that never changes.
 */
const KEYBOARD: Partial<Record<Action, readonly string[] | null>> = Object.freeze({
  start: Object.freeze(['KeyH', 'Escape']),
});

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

    /**
     * ONE. A player of this game never has to hold two positions at the same time.
     *
     * ⚠️ THIS IS NOT "HOW MANY ACTIONS", and the engine's own note says the two being confused is
     * where the warning had a blind spot: the platformer declares nine actions and a nine-place
     * on-screen pad, so "can she reach them all" answered yes — while running, walking and jumping
     * together are three fingers, which a two-touch phone cannot give and nothing said why.
     *
     * Here the verbs are sequential by construction. The cursor moves, THEN the hammer falls;
     * `ui/grid-mirror` acts on one intent per keydown and the pointer path is a single click.
     * There is no state in this game that has to be sustained while something else happens.
     *
     * ⚠️ WITH ONE HONEST EXCEPTION, and declaring 1 is what states it. The camera lean is
     * Shift+Arrow — two keys held together — so a child who can hold only one position cannot tilt
     * the mat. That is survivable because the lean is DECORATION: it changes nothing about what is
     * lit, what is worth hitting, or how long it lasts, and the game is fully playable square-on.
     * Declaring 2 to cover it would be worse than dishonest, it would be wrong: it would report
     * this game as unplayable on a two-touch phone over a feature nobody needs to play it.
     *
     * The consequence is written down rather than hidden: if the lean ever stops being optional,
     * this number is wrong and the nudge needs a single-position binding first.
     *
     * A FUNCTION and not a value, for the same reason `topology` is: a game with phases changes
     * its demand between them. This mat never does, so it answers a constant — which is one line
     * of ceremony for the common case, the cost ADR-0084 weighed and took.
     */
    holdsAtOnce(): number { return 1; },

    /**
     * NO. Nothing in this game is sustained — every key in it is a tap.
     *
     * ⚠️ THIS IS THE OTHER QUESTION, and `holdsAtOnce` above does not answer it. The engine's own
     * note says the two being read as one is what forced this field into the contract: that number
     * counts SIMULTANEOUS positions and refuses zero, this one asks whether any position is HELD.
     * "One at a time" and "one held down" are the same numeral and different facts.
     *
     * What a wrong answer costs is a control that does nothing. Latching — press once to start,
     * press again to stop — is offered exactly where something can be held. A child who cannot keep
     * a key pressed opens the accessibility menu, turns on the adjustment she depends on, and
     * nothing happens: what she learns is that the adjustment is broken. That is the dead button
     * ADR-0106 §5 forbids, and `false` is what keeps it off her screen.
     *
     * ⚠️ AND THE SHIFT+ARROW LEAN IS NOT THE COUNTER-EXAMPLE IT LOOKS LIKE. Shift is genuinely held
     * there, but it is held against `#game-region`'s own keydown listener rather than against an
     * engine ACTION — and latching works on the fourteen positions. Answering `true` would light
     * the control and still leave the mat square-on: the dead button, arrived at by the other road.
     *
     * The honest fix for the lean is not a different answer here, it is a binding that needs no
     * chord. Written down in both places rather than left for someone to rediscover.
     *
     * A FUNCTION and not a value, by ADR-0084: a game on foot holds a direction, and the same game
     * inside a vehicle may hold nothing.
     */
    seguraTeclas(): boolean { return false; },


    /**
     * ENTER MUST NOT PAUSE IN THIS GAME, because Enter is how the hammer falls.
     *
     * ⚠️ THE ENGINE'S FACTORY IS RIGHT AND STILL WRONG HERE. It binds `start` to `KeyH` and `Enter`,
     * and it says why: Enter "JÁ pausava" — declaring it described a key that had paused for years
     * rather than giving it new work. In this game Enter has other work. The mat is twenty real
     * `<button role="gridcell">`s, so Enter and Space activate them natively (`ui/grid-mirror`
     * excludes both from its manual path precisely to avoid firing the hammer twice). A child at
     * the keyboard would whack a tile and open the pause with the same press.
     *
     * So this game replaces the list rather than adding to it: `KeyH` stays — it is the position's
     * home key and the engine chose it for hand symmetry — and `Escape` takes Enter's place, which
     * is what `input/keydown`'s own `PAUSE_KEYS` has always called a pause.
     *
     * ⚠️ PARTIAL ON PURPOSE, and that is the whole reason this field can be used at all: the four
     * directions and the hammer keep the engine's factory, because a game that restated them would
     * own a copy of a table it did not write. Only the position with a genuine conflict is named.
     *
     * 📌 THE SEAT IS IGNORED, and ignoring it is an answer. Whack-a-mole is one child at one mat;
     * there is no second seat whose Enter could mean something else. A two-player game answers this
     * differently, which is why the engine passes the argument rather than assuming.
     */
    mapeamentoDoTeclado(): Partial<Record<Action, readonly string[] | null>> {
      return KEYBOARD;
    },

    /**
     * ⚠️ `mapeamentoDoPad` IS ABSENT, AND THE ABSENCE IS THE ANSWER — which is worth a paragraph
     * precisely because an unwritten "no" and a forgotten field look identical in a diff.
     *
     * The keyboard needed an opinion because of a COLLISION: the engine's factory binds `start` to
     * `KeyH` and `Enter`, and Enter already activates the twenty gridcell buttons natively, so one
     * press would whack a tile and open the pause over it. There is no such collision on a pad.
     * The factory puts `start` on button 9 (Start / Menu) and the hammer on a face button, and this
     * game uses four directions, one verb and the pause — nothing of that overlaps.
     *
     * 📌 So the engine's table is not merely acceptable here, it is BETTER than anything this game
     * could write: a child arrives with the arrangement every other inclusionist game gave her, and
     * the one she remapped in the assistant wins over both (on the pad the saved map is a whole
     * BRANCH — if it exists, a game's default is not consulted at all).
     *
     * The day this game gains a verb that lands on an occupied button, this is where the answer
     * goes. Until then the right declaration is none, said out loud.
     */

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
