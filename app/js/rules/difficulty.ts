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
//     a counter happens to tick before anything reads it. Here the level starts at 1 and only ever
//     goes up by one, so the state that produced the division never exists.
//  2. ONE SOURCE OF TRUTH. The original states the durations TWICE — computed in `Slab.vue`, and
//     again as CSS animation lengths in `_gamepad.scss` with comments reading "12 sec", "10 sec".
//     The two do not agree. Here the timing lives only in this file and the presentation reads it.
//
// ========================= DIFFICULTY IS NOT AN ACCOMMODATION =========================
// `LIT_AT_ONCE` is a CURRICULAR dial: more tiles up together means more values to judge under
// time. It is orthogonal to the engine's EASY, which widens what a slower hand can hit. Folding
// the two together would offer accessibility as though it were a baby mode, and a child who needs
// the motor accommodation would have to give up the maths to get it.
//
// ========================= THE LEVEL IS A COUNT OF TILES, NOT A STRETCH OF CLOCK ==========
// ⚠️ `levelAt(elapsedMs)` AND `LEVEL_MS` ARE GONE, and this is the one place the original's rule
// was dropped rather than corrected. It raised the level every fifteen seconds; the Dev's spec
// raises it when its tiles have been judged -- "no nível 20 devem aparecer e sumir 20 tiles para
// julgar" -- and the two cannot both hold, because a clock would cut a budget short or leave it
// running past its end.
//
// What survives is everything downstream. The curves below still take a level and still produce
// the original's numbers; only the way a level is REACHED changed, from waiting to playing. The
// side effect is one the original could not offer: a child who works slowly is no longer hurried
// by a clock they were never shown.

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * How many tiles may be up at the same time.
 *
 * ⚠️ It was `LIT_PER_WAVE`, and the rename is the whole model change in one word. It used to be
 * how many tiles lit TOGETHER as a set to compare; it is now a CEILING on how many independent
 * tiles are on the mat at once. Two is still the floor, but for a different reason: with tiles
 * arriving one at a time the floor is about the mat feeling alive, not about there being
 * something to compare against.
 */
export const LIT_AT_ONCE: Readonly<Record<Difficulty, number>> = {
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

/**
 * How long ONE tile stays lit, in milliseconds.
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
export function tileDeadlineMs(level: number): number {
  return Math.max(0, 9000 - 9000 * 0.22 * level) + 5000;
}

/**
 * The pause between one tile lighting and the next.
 *
 * 3000 → 1500 → 1000 → 750 … ⚠️ FLOORED AT ONE MILLISECOND, which is not cosmetic: `round.advance`
 * walks from one scheduled event to the next, and a gap of zero would be a boundary that consumes
 * no time and never moves, which is an infinite loop inside a frame. The floor bites only above
 * level 3000, so it is a guard rather than a change to the curve.
 */
export function spawnGapMs(level: number): number {
  return Math.max(1, Math.round((1000 * 3) / level));
}
