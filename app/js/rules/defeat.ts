// SPDX-License-Identifier: AGPL-3.0-or-later
// rules/defeat — how a round can end, and which ending wins a tie.
//
// ========================= THREE MODES, AND THE PLAYER PICKS =========================
// The original has exactly one: any lit tile that expires ends the game instantly. That is a fine
// arcade rule and a hostile one for a slower hand, so it stays — as one of three — rather than
// being softened for everybody or imposed on everybody.
//
//  · `sudden-death` is the original, unaltered.
//  · `lives` spends three mistakes first.
//  · `endless` cannot be lost, only won, which is what makes the game usable in a classroom where
//    a round has to last a known number of minutes.
//
// ⚠️ This is NOT the WCAG 2.2.1 story on its own. `endless` removes the penalty, not the clock;
// what makes the timing adjustable is the deadline multiplier that rides alongside it. See
// docs/ACCESSIBILITY.md — the claim there is AA, honestly marked, not AAA.

import { ROUND_GOAL } from './difficulty.ts';

export type DefeatMode = 'sudden-death' | 'lives' | 'endless';

/** Mistakes the `lives` mode spends before the round ends. */
export const LIVES = 3;

export type RoundOutcome = 'playing' | 'lost' | 'won';

export interface Tally {
  /** A wrong tile hit, or a correct tile left to expire. Both are the same mistake. */
  readonly errors: number;
  /** Correct tiles hit. */
  readonly hits: number;
}

/** How many mistakes this mode tolerates. `Infinity` is a real answer, not a sentinel. */
export function errorBudget(mode: DefeatMode): number {
  if (mode === 'sudden-death') return 0;
  if (mode === 'lives') return LIVES - 1;
  return Infinity;
}

/**
 * Where the round stands.
 *
 * ⚠️ LOSING WINS THE TIE. Reaching the goal on the same tick that spends the last life is a real
 * sequence and the answer has to be one of the two. It is the loss: the mistake did happen, and a
 * round that congratulates a child for a wave they got wrong teaches the wrong thing.
 */
export function outcomeOf(mode: DefeatMode, tally: Tally): RoundOutcome {
  if (tally.errors > errorBudget(mode)) return 'lost';
  if (tally.hits >= ROUND_GOAL) return 'won';
  return 'playing';
}
