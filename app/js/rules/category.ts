// SPDX-License-Identifier: AGPL-3.0-or-later
// rules/category — what counts as CORRECT, and the pool the wave draws from.
//
// ========================= A CATEGORY IS DATA =========================
// The whole educational surface of this game is a predicate and a pool. Nothing in `render/`,
// `ui/` or the declaration knows which category is running; they ask `isCorrect` and read
// `nameKey`. That is the boundary that decides whether adding "consonants versus vowels" later is
// a data change or surgery — and `tests/rules-boundary.node.test.ts` is what keeps it honest.
//
// ========================= WHY THE POOL IS BOUNDED AT TWO DIGITS =========================
// The value is drawn on a tile as segment strokes inside the projected face. Three digits do not
// fit at this resolution, so the bound is stated here rather than discovered later as an
// unreadable 100 in front of a child. Measured in docs/spike-0-symbol-legibility.md.
//
// ========================= WHY CONSTRUCTION CAN FAIL =========================
// A category whose pool holds no incorrect value (a factor of 1) or too few of either side cannot
// compose a wave at all. Throwing at construction beats throwing inside a round already in play:
// the first is a mistake by whoever added the category, the second is a crash in a classroom.

import { LIT_PER_WAVE } from './difficulty.ts';

export interface Category {
  /** Stable id, used for persistence and telemetry. Never shown to anyone. */
  readonly id: string;
  /** Translation key for the objective name. The frame translates; see the engine's pillar 3. */
  readonly nameKey: string;
  /**
   * Grammatical gender and number of the TRANSLATED name, for the engine's `Speakable`.
   *
   * ⚠️ Honestly, this is a pt-BR fact sitting in a language-neutral place, and it is here because
   * that is where the engine can reach it: `Speakable.gender` exists so a frame can agree with its
   * content ("o portão trancado" / "a porta trancada"), and only pt-BR and es need the agreement
   * at all. Every category shipped so far is masculine plural in both ("os pares", "los pares"),
   * and English ignores the field. A category whose name changed gender between pt and es would
   * break this and would need the gender to move into the dictionaries — that has not happened
   * yet, and inventing the machinery before it does would be guessing.
   */
  readonly nameGender: 'm' | 'f' | 'n';
  readonly namePlural: boolean;
  /** Every value this category may put on a tile, correct and incorrect alike. */
  readonly pool: readonly number[];
  isCorrect(value: number): boolean;
}

/** The default universe: 1 to 20. Two digits at most, and small enough to reason about out loud. */
export const POOL_MAX = 20;

/** A wave at the hardest setting could ask for this many of one kind, so a pool must hold them. */
const MIN_PER_SIDE = LIT_PER_WAVE.hard;

function range(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) out.push(n);
  return out;
}

export interface CategoryOptions {
  readonly id: string;
  readonly nameKey: string;
  /** Defaults to masculine plural, which every shipped category is. See `Category.nameGender`. */
  readonly nameGender?: 'm' | 'f' | 'n';
  readonly namePlural?: boolean;
  readonly pool?: readonly number[];
}

/**
 * Builds the "multiples of N" family, which is every category this version ships.
 *
 * `even` is spelled as a multiple of two rather than as its own predicate because that is what it
 * is — but it keeps its own id and name, because a child learning parity is not learning about
 * the number two.
 */
export function multipleOf(factor: number, options: CategoryOptions): Category {
  const pool = options.pool ?? range(1, POOL_MAX);
  const isCorrect = (value: number): boolean => value % factor === 0;

  const right = pool.filter(isCorrect).length;
  const wrong = pool.length - right;
  if (right < MIN_PER_SIDE || wrong < MIN_PER_SIDE) {
    throw new Error(
      `category "${options.id}": pool holds ${right} correct and ${wrong} incorrect values, ` +
      `but a wave can need ${MIN_PER_SIDE} of each. Widen the pool or drop the category.`,
    );
  }

  return {
    id: options.id,
    nameKey: options.nameKey,
    nameGender: options.nameGender ?? 'm',
    namePlural: options.namePlural ?? true,
    pool,
    isCorrect,
  };
}

export const EVEN = multipleOf(2, { id: 'even', nameKey: 'obj.evens' });
export const MULTIPLE_OF_3 = multipleOf(3, { id: 'multiple-of-3', nameKey: 'obj.multiplesOf3' });
export const MULTIPLE_OF_4 = multipleOf(4, { id: 'multiple-of-4', nameKey: 'obj.multiplesOf4' });

/** Everything a player can pick, in the order the menu offers it: easiest concept first. */
export const CATEGORIES: readonly Category[] = [EVEN, MULTIPLE_OF_3, MULTIPLE_OF_4];
