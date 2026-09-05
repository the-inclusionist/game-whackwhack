// SPDX-License-Identifier: AGPL-3.0-or-later
// rules/wave — one question: these cells light, carrying these values, and some of them are right.
//
// ========================= WHY A WAVE, AND NOT LOOSE TILES =========================
// The original lights tiles independently, each on its own timer, so the number on screen drifts.
// That is right for "hit what is lit". It is wrong for "hit the CORRECT one among what is lit",
// because the child has to know WHICH set they are choosing between. Two overlapping sets is not
// harder, it is ambiguous — and ambiguity in a maths task is a wrong answer waiting to be blamed
// on the child. So the unit is the wave: a set that lights together and resolves together.
//
// ========================= THE RNG IS INJECTED =========================
// The engine ships `core/rng` as module state (`reseed` sets a shared seed). Reaching for it here
// would make this module untestable without a global, and ADR-0038 already ruled that shared
// mutable state between games on one page is the bug it looks like. So the caller passes the
// function. The composition root hands over the engine's `rnd`; a test hands over a fixture.
//
// ========================= PURE, AND GUARDED =========================
// Nothing here imports the renderer, the DOM or the engine. tests/rules-boundary.node.test.ts is
// what keeps that true, and it is the property that decides whether a new category is a data
// change or surgery.

import type { Category } from './category.ts';

export interface LitTile {
  /** Index into the mat, row-major. The renderer turns it into a position; the rules do not care. */
  readonly cell: number;
  readonly value: number;
  readonly correct: boolean;
}

export interface Wave {
  readonly tiles: readonly LitTile[];
  /** How long this wave stays up, in milliseconds. From rules/difficulty. */
  readonly deadlineMs: number;
}

export interface ComposeOptions {
  readonly category: Category;
  readonly litCount: number;
  readonly cellCount: number;
  readonly deadlineMs: number;
  /** Uniform in [0, 1). Injected — see the note above. */
  readonly rnd: () => number;
}

/** `n` distinct members of `from`, by a partial Fisher-Yates on a copy. Consumes `n` draws. */
function take<T>(from: readonly T[], n: number, rnd: () => number): T[] {
  const pool = from.slice();
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rnd() * (pool.length - i));
    const swap = pool[j];
    pool[j] = pool[i];
    pool[i] = swap;
    out.push(swap);
  }
  return out;
}

function shuffled<T>(arr: readonly T[], rnd: () => number): T[] {
  return take(arr, arr.length, rnd);
}

export function composeWave(options: ComposeOptions): Wave {
  const { category, litCount, cellCount, deadlineMs, rnd } = options;

  // A single lit tile is not a question — there is nothing to compare it against.
  if (!Number.isInteger(litCount) || litCount < 2) {
    throw new Error(`wave: litCount must be an integer of at least 2, got ${litCount}`);
  }
  if (litCount > cellCount) {
    throw new Error(`wave: cannot light ${litCount} tiles on a mat of ${cellCount} cells`);
  }
  if (!(deadlineMs > 0)) {
    throw new Error(`wave: deadlineMs must be positive, got ${deadlineMs}`);
  }

  const right = category.pool.filter((n) => category.isCorrect(n));
  const wrong = category.pool.filter((n) => !category.isCorrect(n));

  // How many of the lit tiles are correct. Bounded on BOTH sides so the invariant holds even when
  // the wave is nearly as big as the pool: at 20 lit tiles from the evens, "at least one of each"
  // forces exactly ten and ten, and a naive random split would ask for values that do not exist.
  const minCorrect = Math.max(1, litCount - wrong.length);
  const maxCorrect = Math.min(litCount - 1, right.length);
  if (minCorrect > maxCorrect) {
    throw new Error(
      `wave: category "${category.id}" cannot fill ${litCount} tiles with at least one correct ` +
      `and one incorrect value (it holds ${right.length} correct, ${wrong.length} incorrect)`,
    );
  }
  const correctCount = minCorrect + Math.floor(rnd() * (maxCorrect - minCorrect + 1));

  // Distinct values on both sides: two tiles reading 8 is not wrong, but the child cannot tell
  // them apart, so the wave silently asks for less than it appears to ask for.
  const values = [
    ...take(right, correctCount, rnd).map((value) => ({ value, correct: true })),
    ...take(wrong, litCount - correctCount, rnd).map((value) => ({ value, correct: false })),
  ];

  const cells = take(
    Array.from({ length: cellCount }, (_, i) => i),
    litCount,
    rnd,
  );

  // Shuffled before pairing: without this the correct values would always occupy the first slots
  // of the array, and any consumer that renders in array order would teach the child to hit a
  // position instead of to read the number.
  const placed = shuffled(values, rnd);

  return {
    deadlineMs,
    tiles: placed.map((v, i) => ({ cell: cells[i], value: v.value, correct: v.correct })),
  };
}
