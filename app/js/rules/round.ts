// SPDX-License-Identifier: AGPL-3.0-or-later
// rules/round — tiles arriving one at a time, each on its own clock, and a level that is a count.
//
// ========================= THE WAVE IS GONE, AND THE WAVE WAS MINE =========================
// ⚠️ The first model lit N tiles SIMULTANEOUSLY as a set to compare, and that was my invention. It
// is not what si-em/whackwhack does — the original lights slabs INDEPENDENTLY, each on its own
// timer, appearing and vanishing at random — and the Dev reported it three times before it moved:
// "os tiles continuam aparecendo de 3 em 3".
//
// The argument for the wave was that a child choosing between items needs to know WHICH set they
// are choosing between. It does not survive contact with the actual task: the question is not
// "which of these three" but "does THIS one belong", asked of each tile as it appears. Per-tile
// discrimination is the same educational content and a strictly simpler question, and it is the
// one the original's shape already supports.
//
// ========================= A LEVEL IS A BUDGET OF TILES =========================
// "no nível 20 devem aparecer e sumir 20 tiles para julgar", with a floor of four for the first
// four levels. So the level is a COUNT, not a stretch of clock: it ends when its tiles have all
// been judged, and the next one begins with one more than the last.
//
// ⚠️ That replaces `levelAt(elapsedMs)`, which was the original's own rule — a level every fifteen
// seconds. The two cannot both hold: a clock-driven level would cut a budget short or leave it
// running, and the count is the thing the Dev asked to be able to watch. What is kept is the
// timing CURVE: `tileDeadlineMs` and `spawnGapMs` still take a level and still produce the
// original's numbers, so a level is now reached by playing rather than by waiting, and everything
// downstream of it is unchanged. A slow player is no longer hurried by a clock they cannot see.
//
// ========================= TIME IS IN MILLISECONDS HERE =========================
// ⚠️ The engine's `startLoop` hands out `deltaTime` in FRAMES — PixiJS's convention, which the
// engine inherited and its whole animation module is written against. This module takes
// MILLISECONDS, and the composition root converts at the boundary.
//
// ========================= WHAT IS AND IS NOT A MISTAKE =========================
// Hitting a correct tile scores. Hitting a wrong one costs. Letting a CORRECT tile expire costs.
// Letting a WRONG one expire is the right move and costs nothing — that asymmetry is the entire
// educational content of the game.
//
// Two things deliberately cost nothing:
//   · hitting a cell that is not lit. Hammering an empty mat is not an error, and punishing it
//     would make exploring the board dangerous for a player who cannot see it.
//   · hitting a tile twice. A double tap, a stuck key or an impatient hand is a motor event, not a
//     wrong answer — and here the second tap cannot even find the tile, because a judged tile
//     leaves the mat at once rather than lingering as `resolved`.

import type { Category } from './category.ts';
import { LIT_AT_ONCE, type Difficulty, spawnGapMs, tileDeadlineMs } from './difficulty.ts';
import { outcomeOf, type DefeatMode, type RoundOutcome } from './defeat.ts';
import { MAT_CELLS } from './grid.ts';
import { composeLevel, tilesInLevel, type SpawnValue } from './spawn.ts';

export type MistakeReason = 'wrong-tile' | 'missed';

export type RoundEvent =
  | { readonly kind: 'tile-lit'; readonly cell: number; readonly value: number }
  | { readonly kind: 'hit'; readonly cell: number; readonly value: number }
  | {
      readonly kind: 'mistake';
      readonly cell: number;
      readonly value: number;
      readonly reason: MistakeReason;
    }
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

/**
 * A tile that is up right now.
 *
 * ⚠️ THERE IS NO `resolved` FLAG ANY MORE, and its absence is the fix for a reported bug rather
 * than a simplification. A judged tile used to stay in the wave with `resolved: true`, and every
 * consumer had to remember to filter it: the renderer did not, so an answered tile stayed lit with
 * its number on it; `targetsOf` did not, so the sonar kept aiming a blind player at something they
 * had already collected; `nameAt` did not, so it announced a number that was gone. Three copies of
 * one rule, and the rule is simply "it is not on the mat". A tile that leaves the list cannot be
 * forgotten about by anyone.
 */
export interface RoundTile {
  /** Index into the mat, row-major. The renderer turns it into a position; the rules do not care. */
  readonly cell: number;
  readonly value: number;
  readonly correct: boolean;
  /**
   * How much of THIS tile's own deadline is unspent, 1 down to 0.
   *
   * ⚠️ Per tile, not per round. It was one number for a whole wave, which is the one thing the
   * wave model made easy and the independent model makes impossible — two tiles that arrived
   * seconds apart do not share a countdown. The renderer cools each tile against its own.
   */
  readonly heat: number;
}

/** The slice `declaration/whack-declaration` reads. Kept structural rather than imported. */
export interface RoundViewShape {
  readonly category: Category;
  /** Only what is on the mat. Empty is an ordinary state, not an error. */
  readonly tiles: readonly RoundTile[];
  readonly hits: number;
  readonly focus: Focus | null;
}

export interface Round {
  elapsedMs(): number;
  level(): number;
  /** What is on the mat right now, each with its own heat. */
  tiles(): readonly RoundTile[];
  /** Still to be judged this level, on the mat and waiting. Zero means the level is over. */
  tilesLeftInLevel(): number;
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

interface LiveTile {
  readonly cell: number;
  readonly value: number;
  readonly correct: boolean;
  readonly deadlineMs: number;
  leftMs: number;
}

export function createRound(options: RoundOptions): Round {
  const cellCount = options.cellCount ?? MAT_CELLS;
  const atOnce = LIT_AT_ONCE[options.difficulty];

  let elapsed = 0;
  let level = 1;
  let hits = 0;
  let errors = 0;
  let focus: Focus | null = null;
  let ended = false;

  /** This level's remaining values, in the order they will appear. Composed once per level. */
  let queue: SpawnValue[] = [];
  let live: LiveTile[] = [];

  /**
   * Time until the next tile lights.
   *
   * ⚠️ ZERO at the start, so the FIRST tile is up on the first frame. It used to be a full gap —
   * three seconds of empty mat after the player pressed Play, which reads as a game that did not
   * hear the click.
   *
   * ⚠️ And it only counts down while a tile COULD light. With the mat full there is nothing
   * waiting on time, and letting the clock run anyway would bank a debt that fires several tiles
   * at once the moment a slot frees — which is the "3 de 3" the Dev was looking at, arrived at by
   * a different route.
   */
  let spawnLeft = 0;

  function startLevel(): void {
    queue = composeLevel({
      category: options.category,
      count: tilesInLevel(level),
      rnd: options.rnd,
    });
    spawnLeft = 0;
  }

  function outcome(): RoundOutcome {
    return outcomeOf(options.defeat, { errors, hits });
  }

  /** Appends the end-of-round event the first time the outcome stops being `playing`. */
  function checkEnd(out: RoundEvent[]): boolean {
    if (ended) return true;
    const result = outcome();
    if (result === 'playing') return false;
    ended = true;
    live = [];
    queue = [];
    out.push({ kind: 'over', outcome: result });
    return true;
  }

  function freeCells(): number[] {
    const taken = new Set(live.map((t) => t.cell));
    const out: number[] = [];
    for (let cell = 0; cell < cellCount; cell++) if (!taken.has(cell)) out.push(cell);
    return out;
  }

  /**
   * Which queued value may light next, or -1 for none.
   *
   * ⚠️ NOT SIMPLY THE HEAD OF THE QUEUE. Two tiles reading 8 is not wrong, but a child cannot tell
   * them apart, so the mat silently asks for less than it appears to — and `rules/spawn` composes
   * a level with repeats on purpose, because twenty tiles cannot be twenty distinct numbers out of
   * a pool of twenty. Values may repeat ACROSS a level and never side by side, and this is where
   * that second half is enforced, because the round is the only thing that knows what is up.
   *
   * Returning -1 when every remaining value is already on the mat is what stops the round busy
   * looping: `canSpawn` then reads false, the frame loop waits for an expiry instead of retrying a
   * spawn that consumes no time, and the queue drains as slots free.
   */
  function nextSpawnIndex(): number {
    if (live.length >= atOnce || live.length >= cellCount) return -1;
    const onMat = new Set(live.map((t) => t.value));
    return queue.findIndex((v) => !onMat.has(v.value));
  }

  function spawn(out: RoundEvent[]): void {
    const index = nextSpawnIndex();
    if (index < 0) return;
    const [next] = queue.splice(index, 1);
    const open = freeCells();
    const cell = open[Math.floor(options.rnd() * open.length)];
    const deadlineMs = tileDeadlineMs(level);
    live.push({ cell, value: next.value, correct: next.correct, deadlineMs, leftMs: deadlineMs });
    spawnLeft = spawnGapMs(level);
    out.push({ kind: 'tile-lit', cell, value: next.value });
  }

  /** Everything judged: the level is spent. Bumps the level and composes the next budget. */
  function levelUp(out: RoundEvent[]): void {
    level += 1;
    startLevel();
    out.push({ kind: 'level-up', level });
  }

  function canSpawn(): boolean {
    return nextSpawnIndex() >= 0;
  }

  startLevel();

  /**
   * The public shape of what is on the mat.
   *
   * ⚠️ A free function rather than `this.tiles()` inside the returned object. `this` in an object
   * literal method is whatever the call site made it, and every consumer here destructures the
   * round -- `const { view } = round` is one keystroke away and would leave `this` undefined.
   */
  function snapshot(): RoundTile[] {
    return live.map((t) => ({
      cell: t.cell,
      value: t.value,
      correct: t.correct,
      heat: t.deadlineMs > 0 ? Math.min(1, Math.max(0, t.leftMs / t.deadlineMs)) : 0,
    }));
  }

  return {
    elapsedMs: () => elapsed,
    level: () => level,
    tiles: snapshot,
    tilesLeftInLevel: () => queue.length + live.length,
    hits: () => hits,
    errors: () => errors,
    outcome,

    view: () => ({ category: options.category, tiles: snapshot(), hits, focus }),
    setFocus(at) { focus = at; },

    advance(dtMs: number): RoundEvent[] {
      const out: RoundEvent[] = [];
      if (ended || dtMs <= 0) return out;
      elapsed += dtMs;

      // ⚠️ A LOOP OVER EVENT BOUNDARIES, not a single step. The engine clamps dt at two frames,
      // but a hidden tab, a breakpoint or a slow first paint still hands over a large one — and
      // a tile that lit and expired inside that step has to produce both of its events rather
      // than be skipped. Each pass advances to the next thing that happens and no further.
      //
      // It terminates because every pass either consumes time (the deadline floor is five
      // seconds, the gap floor one millisecond) or removes a tile from a finite `live`.
      let remaining = dtMs;
      while (remaining > 0 && !ended) {
        // ⚠️ THE LEVEL IS CHECKED FIRST, and it has to be a check of its own rather than a
        // `!Number.isFinite(step)` fallthrough — which is what it was, and which never fired:
        // `step` is a `Math.min` against `remaining`, so it is finite whatever the other two
        // terms are. The round sat on level one forever with the budget spent, tiles stopped
        // arriving, and every level-driven assertion failed at once.
        if (live.length === 0 && queue.length === 0) {
          // The budget is spent. The next level composes and its first tile is due at once, so
          // the loop carries on with the time that is left rather than dropping it on the floor.
          levelUp(out);
          continue;
        }

        const nextExpiry = live.reduce((least, t) => Math.min(least, t.leftMs), Infinity);
        const nextSpawn = canSpawn() ? spawnLeft : Infinity;
        const step = Math.min(remaining, nextExpiry, nextSpawn);

        remaining -= step;
        for (const tile of live) tile.leftMs -= step;
        if (canSpawn()) spawnLeft -= step;

        // Expiries first: a tile that ran out at the same instant a slot was due frees that slot.
        for (const tile of live.filter((t) => t.leftMs <= 0)) {
          // Only an unjudged CORRECT tile is a miss. A wrong one left alone is the right answer,
          // and it leaves in silence.
          if (tile.correct) {
            errors += 1;
            out.push({ kind: 'mistake', cell: tile.cell, value: tile.value, reason: 'missed' });
          }
        }
        live = live.filter((t) => t.leftMs > 0);
        if (checkEnd(out)) break;

        if (canSpawn() && spawnLeft <= 0) spawn(out);
      }

      checkEnd(out);
      return out;
    },

    hit(cell: number): RoundEvent[] {
      const out: RoundEvent[] = [];
      if (ended) return out;

      const index = live.findIndex((t) => t.cell === cell);
      if (index < 0) return out;   // dark, or already taken. Neither is a mistake.

      const [tile] = live.splice(index, 1);
      if (tile.correct) {
        hits += 1;
        out.push({ kind: 'hit', cell, value: tile.value });
      } else {
        errors += 1;
        out.push({ kind: 'mistake', cell, value: tile.value, reason: 'wrong-tile' });
      }

      checkEnd(out);
      return out;
    },
  };
}
