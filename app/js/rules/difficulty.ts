// SPDX-License-Identifier: AGPL-3.0-or-later
// rules/difficulty — how many tiles light, and how fast the round tightens.
//
// ========================= WHERE THESE NUMBERS COME FROM =========================
// The three curves are si-em/whackwhack's own, kept deliberately. A weekend game people played is
// better evidence of a ramp that feels right than anything derived at a desk, and a balance curve
// is a functional fact rather than expression — which is what makes it reusable when the code it
// came from is not (that project ships no licence at all; see docs/LICENSES.md).
//
// ========================= AND WHERE THEY DIVERGE =========================
// Two corrections, both in the original's favour on intent and against it on execution:
//
//  1. LEVEL ZERO IS GONE. The original computes `Math.ceil(timeLapsed / 15)`, which is 0 before any
//     time passes, and then divides by it — `1000 * (3 / 0)` is Infinity. It survives only because
//     a counter happens to tick before anything reads it. `levelAt` clamps to 1 so the invariant is
//     stated rather than inherited from the order two timers fire in.
//  2. ONE SOURCE OF TRUTH. The original states the durations TWICE — computed in `Slab.vue`, and
//     again as CSS animation lengths in `_gamepad.scss` with comments reading "12 sec", "10 sec".
//     The two do not agree. Here the timing lives only in this file and the presentation reads it.
//
// ========================= DIFFICULTY IS NOT AN ACCOMMODATION =========================
// `LIT_PER_WAVE` is a CURRICULAR dial: more lit tiles means more values to compare under time.
// It is orthogonal to the engine's EASY, which widens what a slower hand can hit. Folding the two
// together would offer accessibility as though it were a baby mode, and a child who needs the
// motor accommodation would have to give up the maths to get it.

export type Difficulty = 'easy' | 'medium' | 'hard';

/** How many tiles light at once. Never below two: one tile cannot be discriminated. */
export const LIT_PER_WAVE: Readonly<Record<Difficulty, number>> = {
  easy: 2,
  medium: 3,
  hard: 4,
};

/**
 * Correct hits that finish a round.
 *
 * Every mode has one, `endless` included: the engine's `objectiveOf` owes the HUD and the sonar a
 * "how many of how many", and a round with no denominator cannot answer that.
 */
export const ROUND_GOAL = 20;

/** How long a level lasts. */
export const LEVEL_MS = 15_000;

/** The level after `elapsedMs` of play. One-based — see correction 1 above. */
export function levelAt(elapsedMs: number): number {
  return Math.max(1, Math.ceil(elapsedMs / LEVEL_MS));
}

/**
 * How long a wave stays lit, in milliseconds.
 *
 * 12020 → 10040 → 8060 → 6080 → 5000, then flat. The floor is what keeps the round playable
 * rather than merely fast: below about five seconds the task stops being "which of these is even"
 * and becomes "can you click at all", which is a different game and a worse one.
 *
 * NOT rounded, and that is a measured decision rather than an omission. The obvious worry is that
 * `0.22` is not representable in binary, so the expression would drift off the round numbers the
 * tests assert. It does not: `9000 * 0.22` is exactly 1980 in IEEE 754, and every level from 1
 * upwards lands on an exact integer. Guarded by the "is exact in doubles" test.
 *
 * A `Math.round` here would be worse than useless — it would SWALLOW the drift if someone later
 * changed 0.22 to a factor that does not divide cleanly, and the exact-value tests would keep
 * passing while the curve quietly moved.
 */
export function waveDeadlineMs(level: number): number {
  return Math.max(0, 9000 - 9000 * 0.22 * level) + 5000;
}

/** The pause between one wave resolving and the next lighting. */
export function waveGapMs(level: number): number {
  return Math.round((1000 * 3) / level);
}
