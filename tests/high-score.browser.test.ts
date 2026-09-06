// SPDX-License-Identifier: AGPL-3.0-or-later
// The one number this game remembers between visits.
//
// ⚠️ IN THE BROWSER PROJECT, not the node one, and that is the whole point of the file. In node
// there IS no `localStorage`, so every call falls into the engine's try/catch and returns the
// fallback — a node test would prove that a browser-less environment does not crash, and nothing
// whatever about whether a score is saved. It would have passed against a `recordHighScore` that
// did nothing at all.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HIGH_SCORE_KEY, readHighScore, recordHighScore } from '../app/js/store/high-score.ts';

beforeEach(() => localStorage.removeItem(HIGH_SCORE_KEY));
afterEach(() => localStorage.removeItem(HIGH_SCORE_KEY));

describe('[Zero] a machine that has never played has nothing to beat', () => {
  it('reads zero when the key is absent', () => {
    expect(readHighScore()).toBe(0);
  });

  it('reads zero rather than null, so no caller needs a fallback of its own', () => {
    expect(readHighScore()).toBeTypeOf('number');
  });
});

describe('[Right] a better score is written, and read back', () => {
  it('records the first score of any size', () => {
    expect(recordHighScore(7)).toBe(true);
    expect(readHighScore()).toBe(7);
  });

  it('records a score that beats the stored one', () => {
    recordHighScore(7);
    expect(recordHighScore(12)).toBe(true);
    expect(readHighScore()).toBe(12);
  });

  it('SURVIVES a reload, which is the only thing this module is for', () => {
    // Written through the engine's storage and read back through it — but the assertion goes
    // straight to `localStorage`, so it cannot pass by both sides agreeing on an in-memory cache.
    recordHighScore(9);
    expect(localStorage.getItem(HIGH_SCORE_KEY)).toBe('9');
  });

  it('files it under a namespaced key, not the original\'s bare `highscore`', () => {
    // ⚠️ Three games in this family share an origin. The original's unprefixed key would have the
    // second one overwrite the first's record with no way to tell.
    recordHighScore(3);
    expect(HIGH_SCORE_KEY).toBe('incl.whackwhack.highscore');
    expect(localStorage.getItem('highscore')).toBeNull();
  });
});

describe('[Right] a worse score is left alone', () => {
  it('refuses a lower score and says so', () => {
    recordHighScore(12);
    expect(recordHighScore(5)).toBe(false);
    expect(readHighScore()).toBe(12);
  });

  it('refuses an EQUAL score, because matching a record is not beating it', () => {
    // ⚠️ The boundary. `>=` here would report "new record" every time a player tied their best,
    // which is the assertion a mutation of `<=` to `<` escapes on every other case.
    recordHighScore(12);
    expect(recordHighScore(12)).toBe(false);
    expect(readHighScore()).toBe(12);
  });

  it('refuses a round of zero, so quitting immediately writes nothing', () => {
    expect(recordHighScore(0)).toBe(false);
    expect(localStorage.getItem(HIGH_SCORE_KEY)).toBeNull();
  });
});

describe('[Boundary] storage that refuses is reported as a refusal', () => {
  // ⚠️ THIS BLOCK EXISTS BECAUSE A MUTATION ESCAPED. `recordHighScore` returns the RESULT of
  // the write rather than `true`, and replacing it with a bare `true` was caught by nothing: in a
  // working browser `set` always succeeds, so the two are indistinguishable everywhere except the
  // one case the return value is for. Private mode, a full quota and blocked site data all make
  // `localStorage.setItem` THROW -- and telling a child they set a record the next visit will not
  // remember is a promise this game cannot keep.
  function withRefusingStorage<T>(body: () => T): T {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError (simulated)'); };
    try {
      return body();
    } finally {
      Storage.prototype.setItem = original;
    }
  }

  it('answers false when the write is refused, however good the score', () => {
    expect(withRefusingStorage(() => recordHighScore(999))).toBe(false);
  });

  it('does not crash the round when storage throws', () => {
    // The engine's `platform/storage` wraps every access in try/catch precisely so that a browser
    // that refuses does not take the boot down with it. This is the assertion that says the
    // wrapping is actually being used rather than bypassed.
    expect(() => withRefusingStorage(() => recordHighScore(5))).not.toThrow();
  });

  it('still reads back whatever WAS stored before the refusal', () => {
    recordHighScore(11);
    withRefusingStorage(() => recordHighScore(50));
    expect(readHighScore()).toBe(11);
  });
});

describe('[Boundary] a corrupted or hand-edited value cannot reach the screen', () => {
  it.each(['', 'abc', 'NaN', 'Infinity', '-4', '2.5'])('reads %o as something sane', (stored) => {
    localStorage.setItem(HIGH_SCORE_KEY, stored);
    const value = readHighScore();
    expect(Number.isInteger(value), stored).toBe(true);
    expect(value, stored).toBeGreaterThanOrEqual(0);
  });

  it('floors a fractional stored value rather than showing "2.5"', () => {
    localStorage.setItem(HIGH_SCORE_KEY, '2.5');
    expect(readHighScore()).toBe(2);
  });

  it('treats a negative stored value as no record at all', () => {
    localStorage.setItem(HIGH_SCORE_KEY, '-4');
    expect(readHighScore()).toBe(0);
  });

  it('refuses to record a score that is not a finite number', () => {
    for (const hits of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(recordHighScore(hits), String(hits)).toBe(false);
    }
    expect(localStorage.getItem(HIGH_SCORE_KEY)).toBeNull();
  });
});
