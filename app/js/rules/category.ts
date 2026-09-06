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

import { LIT_AT_ONCE } from './difficulty.ts';

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

/** The smallest universe any category uses: 1 to 20. See `poolMaxFor` for why it can grow. */
export const POOL_MAX = 20;

/**
 * The largest value a tile may carry, ever.
 *
 * ⚠️ NOT an arbitrary ceiling: the value is drawn on the tile as segment strokes inside the
 * projected face, and three digits do not fit at this resolution. A hundred in front of a child
 * would be an unreadable smear, so the bound is stated where the pool is built rather than
 * discovered later. Measured in docs/spike-0-symbol-legibility.md.
 */
export const VALUE_MAX = 99;

/**
  * The hardest setting can have this many tiles up at once, and no two of them may carry the same
  * value -- so a category has to be able to supply this many DISTINCT values of each kind.
  */
const MIN_PER_SIDE = LIT_AT_ONCE.hard;

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
 * How far a category's universe has to reach to hold enough correct values.
 *
 * ⚠️ THIS IS WHY THE POOL IS NOT A CONSTANT ANY MORE. Multiples of nine inside 1..20 are 9 and 18
 * — two values, where the hardest setting can want four lit at once and no value may appear twice
 * on the mat. So the universe grows WITH the factor, to exactly the point where the fourth
 * multiple appears, and no further: 1..20 for factors two to five, then 24, 28, 32, 36.
 *
 * The alternative was one wide pool for everyone, and it is worse in both directions — it makes
 * "multiples of two" a game of forty numbers when twenty is plenty, and it still has to be
 * derived from the largest factor, so the derivation happens either way.
 */
export function poolMaxFor(factor: number): number {
  const needed = MIN_PER_SIDE * factor;
  const max = Math.max(POOL_MAX, needed);
  if (max > VALUE_MAX) {
    throw new Error(
      `category: multiples of ${factor} need values up to ${max}, and a tile holds two digits ` +
      `(max ${VALUE_MAX}). Nothing above ${Math.floor(VALUE_MAX / MIN_PER_SIDE)} can be a factor.`,
    );
  }
  return max;
}

/**
 * Builds the "multiples of N" family, which is every category this version ships.
 *
 * `even` is spelled as a multiple of two rather than as its own predicate because that is what it
 * is — but it keeps its own id and name, because a child learning parity is not learning about
 * the number two.
 */
export function multipleOf(factor: number, options: CategoryOptions): Category {
  const pool = options.pool ?? range(1, poolMaxFor(factor));
  const isCorrect = (value: number): boolean => value % factor === 0;

  const right = pool.filter(isCorrect).length;
  const wrong = pool.length - right;
  if (right < MIN_PER_SIDE || wrong < MIN_PER_SIDE) {
    throw new Error(
      `category "${options.id}": pool holds ${right} correct and ${wrong} incorrect values, ` +
      `but ${MIN_PER_SIDE} tiles can be up at once. Widen the pool or drop the category.`,
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

/**
 * ========================= TWO THROUGH NINE =========================
 * The Dev's spec for the option row: "toque para Coletar multiplos de: 2 3 4 5 6 7 8 9". It was
 * three hand-written categories before, and the family is regular enough that hand-writing eight
 * of them would be eight chances to mistype a factor.
 *
 * ⚠️ The id of the first is `even`, not `multiple-of-2`, and it is deliberately NOT regular. `id`
 * is the stable identity a saved preference would name, it was already `even` before this change,
 * and regularising it now would cost more than it buys. The name it SHOWS is its own too —
 * "números pares" rather than "múltiplos de 2" — because a child learning parity is not learning
 * about the number two.
 */
export const FACTORS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9];

/** Everything a player can pick, in the order the option row offers it: smallest factor first. */
export const CATEGORIES: readonly Category[] = FACTORS.map((factor) => multipleOf(factor, {
  id: factor === 2 ? 'even' : `multiple-of-${factor}`,
  nameKey: `obj.multiplesOf${factor}`,
}));

export const EVEN = CATEGORIES[0];
export const MULTIPLE_OF_3 = CATEGORIES[1];
export const MULTIPLE_OF_4 = CATEGORIES[2];
