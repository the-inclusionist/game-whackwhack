// SPDX-License-Identifier: AGPL-3.0-or-later
// rules/spawn — how many tiles a level asks about, and what is written on them.
//
// ========================= THIS REPLACED THE WAVE, AND THE WAVE WAS MINE =========================
// ⚠️ The first model lit N tiles SIMULTANEOUSLY as a set to compare, and that was my invention, not
// the original's and not what was asked for. si-em/whackwhack lights slabs INDEPENDENTLY, each on
// its own timer, appearing and vanishing at random — and a set that arrives and leaves together
// reads as a puzzle to solve, where the original reads as a thing to react to. They are different
// games, and the second one is the one being rebuilt.
//
// The educational content survives the change intact, and is arguably cleaner for it: the child
// judges EACH tile as it appears — hit it if it belongs to the category, leave it alone if it does
// not. Discrimination per tile rather than per set. Nothing about that needed the simultaneity.
//
// ========================= A LEVEL IS A BUDGET OF TILES =========================
// Level N asks about N tiles, with a floor of four, and it ends when all of them have been judged.
// That is the Dev's spec — "no nível 20 devem aparecer e sumir 20 tiles para julgar" — and it
// replaces the original's purely time-based level, which would have made the count drift under the
// player mid-level. Here the count is exact and observable: you can watch a level be twenty tiles.

import type { Category } from './category.ts';

/** The smallest a level may be. Levels 1 to 4 all ask about four tiles. */
export const MIN_TILES_PER_LEVEL = 4;

/**
 * How many tiles level `level` asks about.
 *
 * The floor exists because a level of one tile is not a level: it gives a child no chance to
 * settle into the question before the ground moves.
 */
export function tilesInLevel(level: number): number {
  return Math.max(MIN_TILES_PER_LEVEL, Math.floor(level));
}

export interface SpawnValue {
  readonly value: number;
  readonly correct: boolean;
}

/** `n` distinct members of `from`, by a partial Fisher-Yates on a copy. Consumes `n` draws. */
export function take<T>(from: readonly T[], n: number, rnd: () => number): T[] {
  const pool = from.slice();
  const out: T[] = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rnd() * (pool.length - i));
    const swap = pool[j];
    pool[j] = pool[i];
    pool[i] = swap;
    out.push(swap);
  }
  return out;
}

export function shuffled<T>(arr: readonly T[], rnd: () => number): T[] {
  return take(arr, arr.length, rnd);
}

export interface ComposeLevelOptions {
  readonly category: Category;
  readonly count: number;
  readonly rnd: () => number;
}

/**
 * The sequence of values a level will present, in the order they will appear.
 *
 * ⚠️ AT LEAST ONE CORRECT AND ONE INCORRECT, and the invariant moved here from the wave without
 * weakening. A level of all-wrong tiles gives the child nothing to collect and a level of
 * all-right ones gives them nothing to judge; either way the round stops asking a question while
 * still looking like it is. It is a property of the LEVEL now rather than of a simultaneous set,
 * which is the only thing the model change actually altered about it.
 *
 * Values may repeat WITHIN a level — twenty tiles cannot be twenty distinct numbers out of a pool
 * of twenty without exhausting it — but never two of the same on the mat at once; that is the
 * round's business, since it is the round that knows what is currently up.
 */
export function composeLevel(options: ComposeLevelOptions): SpawnValue[] {
  const { category, count, rnd } = options;
  if (!Number.isInteger(count) || count < 2) {
    throw new Error(`spawn: a level needs at least 2 tiles to be a question, got ${count}`);
  }

  const right = category.pool.filter((n) => category.isCorrect(n));
  const wrong = category.pool.filter((n) => !category.isCorrect(n));
  if (right.length === 0 || wrong.length === 0) {
    throw new Error(`spawn: category "${category.id}" has nothing to discriminate`);
  }

  // Between a third and two thirds correct. Not a free draw: an unweighted coin over twenty tiles
  // produces all-wrong levels often enough to matter, and a child who hits nothing for a level
  // learns that the game is broken rather than that they were careful.
  const minRight = Math.max(1, Math.floor(count / 3));
  const maxRight = Math.min(count - 1, Math.ceil((count * 2) / 3));
  const rightCount = minRight + Math.floor(rnd() * (maxRight - minRight + 1));

  const out: SpawnValue[] = [];
  for (let i = 0; i < rightCount; i++) {
    out.push({ value: right[Math.floor(rnd() * right.length)], correct: true });
  }
  for (let i = 0; i < count - rightCount; i++) {
    out.push({ value: wrong[Math.floor(rnd() * wrong.length)], correct: false });
  }
  // Shuffled, or every level would open with its correct tiles and end with its wrong ones — which
  // teaches a rhythm instead of a category.
  return shuffled(out, rnd);
}
