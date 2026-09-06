// SPDX-License-Identifier: AGPL-3.0-or-later
// rules/round — waves arriving, tiles resolving, and the clock that does not wait for anyone.
//
// ========================= TIME IS IN MILLISECONDS HERE =========================
// ⚠️ The engine's `startLoop` hands out `deltaTime` in FRAMES — PixiJS's convention, which the
// engine inherited and its whole animation module is written against. This module takes
// MILLISECONDS, and the composition root converts at the boundary. That is deliberate: the timing
// curve is the original game's, stated in milliseconds, and asserting it against a frame count
// would make every number in it depend on the refresh rate of whatever machine ran the test.
//
// ========================= THE ROUND EMITS EVENTS, IT DOES NOT ANNOUNCE =========================
// Nothing here speaks, draws or touches the DOM. It returns what happened and the composition root
// decides what that means out loud — `srSay` for the ordinary, `srAlert` for the end. Keeping the
// announcing out means the whole round is exercised in the node project in milliseconds, and it is
// why the timing tests can play four hundred waves without a browser.
//
// ========================= WHAT IS AND IS NOT A MISTAKE =========================
// Hitting a correct tile scores. Hitting a wrong one costs. Letting a CORRECT tile expire costs.
// Letting a WRONG one expire is the right move and costs nothing — that asymmetry is the entire
// educational content of the game, and it is why the wave rather than the tile is the unit.
//
// Two things deliberately cost nothing:
//   · hitting a tile that is not lit. Hammering an empty mat is not an error, and punishing it
//     would make exploring the board dangerous for a player who cannot see it.
//   · hitting a tile that is already resolved. A double tap, a stuck key or an impatient hand is a
//     motor event, not a wrong answer, and charging twice for one mistake punishes the wrong thing.

import type { Category } from './category.ts';
import { LIT_PER_WAVE, type Difficulty, levelAt, waveDeadlineMs, waveGapMs } from './difficulty.ts';
import { outcomeOf, type DefeatMode, type RoundOutcome } from './defeat.ts';
import { MAT_CELLS } from './grid.ts';
import { composeWave, type LitTile } from './wave.ts';

export type MistakeReason = 'wrong-tile' | 'missed';

export type RoundEvent =
  | { readonly kind: 'wave-lit'; readonly wave: RoundWave }
  | { readonly kind: 'hit'; readonly cell: number; readonly value: number }
  | {
      readonly kind: 'mistake';
      readonly cell: number;
      readonly value: number;
      readonly reason: MistakeReason;
    }
  | { readonly kind: 'wave-cleared' }
  | { readonly kind: 'level-up'; readonly level: number }
  | { readonly kind: 'over'; readonly outcome: 'won' | 'lost' };

/** A spot on the mat, in the engine contract's shape. Declared locally; see rules/grid. */
export interface Focus { readonly x: number; readonly y: number }

export interface RoundOptions {
  readonly category: Category;
  readonly difficulty: Difficulty;
  readonly defeat: DefeatMode;
  /** Uniform in [0, 1). Injected, so a round is reproducible in a test. */
  readonly rnd: () => number;
  readonly cellCount?: number;
}

/** The slice `declaration/whack-declaration` reads. Kept structural rather than imported. */
export interface RoundViewShape {
  readonly category: Category;
  readonly wave: RoundWave | null;
  readonly hits: number;
  readonly focus: Focus | null;
}

export interface Round {
  elapsedMs(): number;
  level(): number;
  wave(): RoundWave | null;
  hits(): number;
  errors(): number;
  outcome(): RoundOutcome;
  view(): RoundViewShape;
  setFocus(at: Focus | null): void;
  /** Drives the clock. `dtMs` is MILLISECONDS — see the note at the top. */
  advance(dtMs: number): RoundEvent[];
  /** The one door in, for the pointer and the keyboard alike. */
  hit(cell: number): RoundEvent[];
}

/**
 * A tile as the round sees it: the composed tile plus whether it has been answered.
 *
 * ⚠️ `resolved` is PUBLIC, and it was not, which was a real defect. The renderer lit every tile in
 * the wave and stamped every number, so a tile you had already hit stayed on the mat with its
 * number on it — the game looked broken even though the score was going up. Worse, the declaration
 * had the same blind spot: `targetsOf` handed back tiles already collected, so the sonar kept
 * aiming a blind player at something they had finished, and `nameAt` kept announcing it.
 *
 * Resolution is not private bookkeeping. It is the difference between a tile that is still a
 * question and one that is not, which is exactly what every consumer needs to know.
 */
export interface RoundTile extends LitTile {
  readonly resolved: boolean;
}

export interface RoundWave {
  readonly tiles: readonly RoundTile[];
  readonly deadlineMs: number;
}

interface LiveTile extends LitTile {
  resolved: boolean;
}

export function createRound(options: RoundOptions): Round {
  const cellCount = options.cellCount ?? MAT_CELLS;
  const litCount = LIT_PER_WAVE[options.difficulty];

  let elapsed = 0;
  let level = 1;
  let hits = 0;
  let errors = 0;
  let focus: Focus | null = null;

  /**
   * The wave object handed out by `wave()`.
   *
   * ⚠️ Held rather than rebuilt per call, for two reasons. The declaration asks three times a
   * frame (`roleAt`, `nameAt`, `targetsOf`), so rebuilding allocates for nothing. And a stable
   * identity is what lets a consumer notice that the wave CHANGED rather than diffing its tiles.
   */
  let wave: RoundWave | null = null;
  let tiles: LiveTile[] | null = null;

  /**
   * ⚠️ `timeLeft` is the countdown; `wave.deadlineMs` is the deadline the wave was GIVEN and never
   * moves. Using one variable for both — which is what this did first — made `wave().deadlineMs`
   * shrink every frame, so anything reading it saw a wave that had always just been created with
   * whatever time happened to remain.
   */
  let timeLeft = 0;
  /**
   * Time until the next wave lights.
   *
   * ⚠️ ZERO at the start, so the FIRST wave is up on the first frame. It used to be a full gap —
   * three seconds of empty mat after the player pressed Play, which reads as a game that did not
   * hear the click. Between later waves the gap is the pause a player needs to read the mat; before
   * the first one there is nothing to read and nothing to recover from, so the pause is only delay.
   *
   * Not lit in the constructor, though it could be: lighting it through `advance` is what makes it
   * emit `wave-lit`, and that event is how a blind player learns the round has begun.
   */
  let gapLeft = 0;
  let ended = false;

  function outcome(): RoundOutcome {
    return outcomeOf(options.defeat, { errors, hits });
  }

  /** Appends the end-of-round event the first time the outcome stops being `playing`. */
  function checkEnd(out: RoundEvent[]): boolean {
    if (ended) return true;
    const result = outcome();
    if (result === 'playing') return false;
    ended = true;
    wave = null;
    tiles = null;
    out.push({ kind: 'over', outcome: result });
    return true;
  }

  function lightWave(out: RoundEvent[]): void {
    const deadlineMs = waveDeadlineMs(level);
    timeLeft = deadlineMs;
    const composed = composeWave({
      category: options.category,
      litCount,
      cellCount,
      deadlineMs,
      rnd: options.rnd,
    });
    tiles = composed.tiles.map((t) => ({ ...t, resolved: false }));
    wave = { tiles, deadlineMs };
    out.push({ kind: 'wave-lit', wave });
  }

  function clearWave(out: RoundEvent[]): void {
    wave = null;
    tiles = null;
    gapLeft = waveGapMs(level);
    out.push({ kind: 'wave-cleared' });
  }

  function expireWave(out: RoundEvent[]): void {
    for (const tile of tiles ?? []) {
      // Only an unresolved CORRECT tile is a miss. An unresolved wrong one was left alone, which
      // is the answer the round was asking for.
      if (!tile.resolved && tile.correct) {
        tile.resolved = true;
        errors += 1;
        out.push({ kind: 'mistake', cell: tile.cell, value: tile.value, reason: 'missed' });
      }
    }
    clearWave(out);
  }

  return {
    elapsedMs: () => elapsed,
    level: () => level,
    wave: () => wave,
    hits: () => hits,
    errors: () => errors,
    outcome,

    view: () => ({ category: options.category, wave, hits, focus }),
    setFocus(at) { focus = at; },

    advance(dtMs: number): RoundEvent[] {
      const out: RoundEvent[] = [];
      if (ended || dtMs <= 0) return out;

      elapsed += dtMs;
      const nextLevel = levelAt(elapsed);
      if (nextLevel !== level) {
        level = nextLevel;
        out.push({ kind: 'level-up', level });
      }

      // ⚠️ A LOOP, not a single step. The engine clamps dt at two frames, but a hidden tab, a
      // breakpoint or a slow first paint still hands over a large one — and a wave that opened
      // and closed inside that step has to produce its events rather than be skipped.
      let remaining = dtMs;
      while (remaining > 0 && !ended) {
        if (!tiles) {
          if (remaining < gapLeft) { gapLeft -= remaining; break; }
          remaining -= gapLeft;
          gapLeft = 0;
          lightWave(out);
          continue;
        }
        if (remaining < timeLeft) { timeLeft -= remaining; break; }
        remaining -= timeLeft;
        timeLeft = 0;
        expireWave(out);
        if (checkEnd(out)) break;
      }

      checkEnd(out);
      return out;
    },

    hit(cell: number): RoundEvent[] {
      const out: RoundEvent[] = [];
      if (ended || !tiles) return out;

      const tile = tiles.find((t) => t.cell === cell && !t.resolved);
      if (!tile) return out;   // dark, or already answered. Neither is a mistake.

      tile.resolved = true;
      if (tile.correct) {
        hits += 1;
        out.push({ kind: 'hit', cell, value: tile.value });
      } else {
        errors += 1;
        out.push({ kind: 'mistake', cell, value: tile.value, reason: 'wrong-tile' });
      }

      // Cleared as soon as every tile is answered, without waiting the clock out: making a fast
      // player wait for a slow deadline is the opposite of what a difficulty curve is for.
      if (tiles.every((t) => t.resolved)) clearWave(out);
      checkEnd(out);
      return out;
    },
  };
}
