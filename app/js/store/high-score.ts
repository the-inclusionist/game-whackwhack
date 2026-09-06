// SPDX-License-Identifier: AGPL-3.0-or-later
// store/high-score — the one number this game remembers between visits.
//
// ========================= THE ORIGINAL'S RULE, KEPT =========================
// si-em/whackwhack reads `localStorage.getItem('highscore')` on mount and writes it on game over,
// only when the round beat it. Both halves matter and the second is the easy one to forget: a game
// that writes a high score and never reads it back shows a proud zero on every visit, which is
// what the original's own `data()` would have done had the `mounted` hook not existed.
//
// ========================= THREE DIVERGENCES, ALL SMALL =========================
// 1. THE KEY IS NAMESPACED. The original uses the bare `highscore`, which on a shared origin is a
//    collision waiting for the second game — and there are three games in this family. `incl.` is
//    the engine's own prefix and the game's slug follows it.
//
//    ⚠️ NOT `storage.kJogo()`, which exists and looks right: its `JOGO_ID` is hardcoded to
//    "inclusionist", so it would file this game's score under the engine's name.
//
// 2. IT IS WRITTEN WHENEVER THE ROUND ENDS, not only on defeat. The original saves in
//    `handleGameOver`, so a round the player QUITS loses its score. Here a win and a loss both
//    end a round and both count.
//
// 3. IT GOES THROUGH THE ENGINE'S `platform/storage`, which wraps every access in try/catch.
//    `localStorage` THROWS outright on `file://` and in some browsers' private mode — not returns
//    null, throws — and an unguarded read at boot takes the whole game down before it draws. That
//    is a bug the engine already paid for; there is no reason to buy it again here.

import { getNum, set } from '@the-inclusionist/engine/platform/storage.js';

/**
 * ⚠️ Exported so the test can clear it, and so a future migration has a name to migrate FROM.
 * The engine's `getComLegado` exists precisely because renaming a key silently resets everyone's
 * saved value; the way to never need it is to get the name right once.
 */
export const HIGH_SCORE_KEY = 'incl.whackwhack.highscore';

/**
 * The best score on this machine, or 0.
 *
 * Zero rather than null: every caller wants a number to compare against, and `null` would push the
 * same `?? 0` into each of them. A missing key, a corrupted value and a browser that refuses to
 * answer are all the same answer to the question being asked — "what is there to beat".
 */
export function readHighScore(): number {
  const stored = getNum(HIGH_SCORE_KEY, 0);
  // `getNum` already rejects NaN and Infinity. What it cannot know is that a score is a whole
  // number of hits and cannot be negative — a hand-edited or half-written value would otherwise
  // reach the HUD and be displayed as "-3" or "2.5".
  if (!Number.isFinite(stored) || stored < 0) return 0;
  return Math.floor(stored);
}

/**
 * Records `hits` if it beats what is stored, and answers whether it did.
 *
 * The boolean is what lets the result screen say "new record" without asking twice and without the
 * caller re-reading the value it just wrote — a read-after-write that would answer `false` for the
 * player who just set the record if storage silently refused the write.
 */
export function recordHighScore(hits: number): boolean {
  if (!Number.isFinite(hits) || hits <= 0) return false;
  const best = readHighScore();
  if (Math.floor(hits) <= best) return false;
  // ⚠️ The RETURN of `set` is the answer, not an assumption. It is `false` when storage refused —
  // private mode, a full quota, site data blocked — and reporting a record that was not saved
  // would promise the child something the next visit will not keep.
  return set(HIGH_SCORE_KEY, Math.floor(hits));
}
