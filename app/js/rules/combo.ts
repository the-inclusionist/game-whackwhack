// SPDX-License-Identifier: AGPL-3.0-or-later
// rules/combo — the DDR words, and when one of them replaces the "+1".
//
// ========================= READ OFF THE ORIGINAL, NOT INVENTED =========================
// si-em/whackwhack emits `['+1', score]` on every hit, and its `AppFooter` shows the "+1" UNLESS
// the score is a multiple of five, in which case it shows a word drawn at random from
//
//     ['Awesome!', 'Good!', 'Savage!', 'On fire!', 'Combo!']
//
// That is the whole rule, and two things about it are worth stating because both are easy to get
// wrong from memory. It is not a STREAK: a mistake does not reset anything, because the trigger is
// the running score being divisible by five. And the word is RANDOM rather than tiered — there is
// no ladder from "Good!" up to "Savage!", and building one would be inventing a difficulty signal
// the game does not have.
//
// ========================= WHY THE WORDS ARE KEYS AND NOT STRINGS =========================
// They are English interjections in a Brazilian game, and they stay English in pt-BR because that
// is what the parody is OF — an arcade dance cabinet says "Perfect!" in São Paulo too. But they go
// through the catalogue rather than being written here, for two reasons: nothing else in this game
// puts prose in a module, and the completeness test then covers them, so a locale that DOES want
// to translate them has the key waiting instead of a code change.
//
// ========================= AND WHY THIS IS IN rules/ =========================
// It is a scoring rule — it reads the score and nothing else — so it is pure, it is tested in the
// node project in microseconds, and `ui/feedback` is left with no decision to make beyond where to
// put the text on screen.

/** A word appears when the score reaches a multiple of this. The original's own five. */
export const COMBO_EVERY = 5;

/**
 * The five words, as catalogue keys, in the original's own order.
 *
 * ⚠️ The ORDER is load-bearing even though the choice is random: it is what makes a seeded round
 * reproduce the same sequence of words, which is the only reason a test can assert anything about
 * them at all.
 */
export const COMBO_KEYS: readonly string[] = [
  'combo.awesome',
  'combo.good',
  'combo.savage',
  'combo.onFire',
  'combo.combo',
];

/**
 * The word for a score of `hits`, or `null` when the "+1" stands.
 *
 * `rnd` is injected for the same reason it is everywhere else in `rules/`: reaching for the
 * engine's module-level generator would make this untestable without a global, and ADR-0038
 * already ruled that shared mutable state between games on one page is the bug it looks like.
 */
export function comboKeyFor(hits: number, rnd: () => number): string | null {
  if (!Number.isInteger(hits) || hits <= 0) return null;
  if (hits % COMBO_EVERY !== 0) return null;
  // ⚠️ Clamped. `rnd()` is documented as [0, 1) and a generator that returns exactly 1 — or a test
  // fixture that hands over a constant — would index past the end and put `undefined` on screen.
  const index = Math.min(COMBO_KEYS.length - 1, Math.floor(rnd() * COMBO_KEYS.length));
  return COMBO_KEYS[index];
}
