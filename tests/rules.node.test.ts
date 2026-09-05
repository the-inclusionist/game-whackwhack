// SPDX-License-Identifier: AGPL-3.0-or-later
// The pure rules: what counts as correct, how fast the round gets, and when it ends.
//
// The timing numbers are not invented. They are the original whackwhack's own curve, kept because
// a weekend game that people actually played is better evidence of a playable ramp than anything
// derived at a desk. What is NOT kept is the original's level 0 — see the [Zero] block below.

import { describe, expect, it } from 'vitest';
import { EVEN, MULTIPLE_OF_3, MULTIPLE_OF_4, multipleOf } from '../app/js/rules/category.ts';
import {
  LIT_PER_WAVE, ROUND_GOAL, levelAt, waveDeadlineMs, waveGapMs,
} from '../app/js/rules/difficulty.ts';
import { LIVES, outcomeOf } from '../app/js/rules/defeat.ts';

describe('[Right] a category answers only one question', () => {
  it('calls the even numbers correct', () => {
    expect(EVEN.isCorrect(4)).toBe(true);
    expect(EVEN.isCorrect(7)).toBe(false);
  });

  it('calls the multiples of three correct', () => {
    expect(MULTIPLE_OF_3.isCorrect(9)).toBe(true);
    expect(MULTIPLE_OF_3.isCorrect(8)).toBe(false);
  });

  it('calls the multiples of four correct', () => {
    expect(MULTIPLE_OF_4.isCorrect(12)).toBe(true);
    // 6 is even and a multiple of 3, so it is the value that catches a category
    // that quietly answers a different question than the one it names.
    expect(MULTIPLE_OF_4.isCorrect(6)).toBe(false);
  });
});

describe('[Interface] every category can actually be played', () => {
  const all = [EVEN, MULTIPLE_OF_3, MULTIPLE_OF_4];

  it('has a pool holding both correct and incorrect values', () => {
    // Without both, a wave cannot be composed at all: there would be nothing to
    // discriminate, and the game would be a reflex test wearing a maths costume.
    for (const c of all) {
      expect(c.pool.some((n) => c.isCorrect(n))).toBe(true);
      expect(c.pool.some((n) => !c.isCorrect(n))).toBe(true);
    }
  });

  it('has enough of each to fill the hardest wave', () => {
    const hardest = LIT_PER_WAVE.hard;
    for (const c of all) {
      expect(c.pool.filter((n) => c.isCorrect(n)).length).toBeGreaterThanOrEqual(hardest);
      expect(c.pool.filter((n) => !c.isCorrect(n)).length).toBeGreaterThanOrEqual(hardest);
    }
  });

  it('draws from a pool that fits two digits', () => {
    // The glyph is drawn as segment strokes on a tile. Three digits would not fit the
    // tile at the resolution this game renders at, so the pool is bounded here rather
    // than discovered later by an unreadable 100.
    for (const c of all) {
      for (const n of c.pool) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(99);
      }
    }
  });

  it('names itself with a translation key, never with prose', () => {
    for (const c of all) expect(c.nameKey).toMatch(/^obj\./);
  });
});

describe('[Zero] the clock starts at level one, not level zero', () => {
  // The original computes `Math.ceil(timeLapsed / 15)`, which is 0 on the first frame,
  // and then divides by it: `1000 * (3 / level)` is Infinity at level 0. It survives only
  // because the counter is incremented before anything reads it. Clamping to 1 states the
  // intent instead of relying on the order two timers happen to fire in.
  it('is level one before any time has passed', () => {
    expect(levelAt(0)).toBe(1);
  });

  it('never returns a gap of Infinity', () => {
    for (const t of [0, 1, 14_999, 15_000, 60_000]) {
      expect(Number.isFinite(waveGapMs(levelAt(t)))).toBe(true);
    }
  });
});

describe('[Boundary] the level turns exactly every fifteen seconds', () => {
  it('is still level one at 14.999 s', () => expect(levelAt(14_999)).toBe(1));
  it('is still level one at exactly 15 s', () => expect(levelAt(15_000)).toBe(1));
  it('is level two one millisecond later', () => expect(levelAt(15_001)).toBe(2));
  it('is level three at exactly 30.001 s', () => expect(levelAt(30_001)).toBe(3));
});

describe('[Right] the deadline shrinks on the original curve', () => {
  // max(0, 9000 - 9000 * 0.22 * level) + 5000
  it.each([
    [1, 12_020],
    [2, 10_040],
    [3, 8_060],
    [4, 6_080],
    [5, 5_000],
  ])('gives level %i a deadline of %i ms', (level, expected) => {
    expect(waveDeadlineMs(level)).toBe(expected);
  });

  it('never drops below the five-second floor, however long the round runs', () => {
    for (const level of [5, 6, 20, 500]) expect(waveDeadlineMs(level)).toBe(5_000);
  });

  it('is monotonically non-increasing', () => {
    for (let level = 2; level <= 30; level++) {
      expect(waveDeadlineMs(level)).toBeLessThanOrEqual(waveDeadlineMs(level - 1));
    }
  });

  it('is exact in doubles, so no rounding is needed to hide drift', () => {
    // The reason the implementation carries no Math.round. If a future factor stops dividing
    // cleanly this is the assertion that says so, instead of a rounding call absorbing it in
    // silence while the exact-value cases above keep passing.
    for (let level = 1; level <= 30; level++) {
      expect(Number.isInteger(waveDeadlineMs(level))).toBe(true);
    }
  });
});

describe('[Right] the gap between waves shrinks too', () => {
  it.each([[1, 3_000], [2, 1_500], [3, 1_000], [4, 750]])(
    'gives level %i a gap of %i ms', (level, expected) => {
      expect(waveGapMs(level)).toBe(expected);
    },
  );

  it('stays positive so the round can never stall', () => {
    for (const level of [1, 10, 1_000]) expect(waveGapMs(level)).toBeGreaterThan(0);
  });
});

describe('[Interface] difficulty is how MANY tiles light, not how fast', () => {
  // Difficulty is a curricular dial: more lit tiles means more values to compare. It is
  // deliberately orthogonal to the engine's EASY, which is a motor accommodation. Folding
  // them together would offer accessibility as if it were a baby mode.
  it('lights two, three and four tiles', () => {
    expect(LIT_PER_WAVE.easy).toBe(2);
    expect(LIT_PER_WAVE.medium).toBe(3);
    expect(LIT_PER_WAVE.hard).toBe(4);
  });

  it('never lights fewer than two, because one tile cannot be discriminated', () => {
    for (const n of Object.values(LIT_PER_WAVE)) expect(n).toBeGreaterThanOrEqual(2);
  });
});

describe('[Right] each defeat mode ends the round its own way', () => {
  it('ends sudden death on the very first mistake', () => {
    expect(outcomeOf('sudden-death', { errors: 0, hits: 0 })).toBe('playing');
    expect(outcomeOf('sudden-death', { errors: 1, hits: 0 })).toBe('lost');
  });

  it('spends every life before ending the lives mode', () => {
    expect(outcomeOf('lives', { errors: LIVES - 1, hits: 0 })).toBe('playing');
    expect(outcomeOf('lives', { errors: LIVES, hits: 0 })).toBe('lost');
  });

  it('never loses in endless, however many mistakes are made', () => {
    expect(outcomeOf('endless', { errors: 99, hits: 0 })).toBe('playing');
  });
});

describe('[Boundary] the goal is reachable in every mode', () => {
  // Every round has a goal, endless included: `objectiveOf` in the engine contract owes the
  // HUD and the sonar a "how many of how many", and a round with no denominator cannot answer.
  it('wins on the goal in endless', () => {
    expect(outcomeOf('endless', { errors: 0, hits: ROUND_GOAL })).toBe('won');
  });

  it('wins on the goal in the other two modes as well', () => {
    expect(outcomeOf('lives', { errors: 1, hits: ROUND_GOAL })).toBe('won');
    expect(outcomeOf('sudden-death', { errors: 0, hits: ROUND_GOAL })).toBe('won');
  });

  it('is still playing one hit short', () => {
    expect(outcomeOf('endless', { errors: 0, hits: ROUND_GOAL - 1 })).toBe('playing');
  });

  it('counts a loss before a win when both land at once', () => {
    // Reaching the goal on the same tick that spends the last life is a real sequence, and
    // the answer has to be one of the two. Losing wins the tie: the mistake happened, and a
    // round that congratulates a child for a wave they got wrong teaches the wrong thing.
    expect(outcomeOf('lives', { errors: LIVES, hits: ROUND_GOAL })).toBe('lost');
  });
});

describe('[Interface] a category is data, so a new one costs no surgery', () => {
  it('builds a working category from a factor alone', () => {
    const fives = multipleOf(5, { id: 'multiple-of-5', nameKey: 'obj.multiplesOf5' });
    expect(fives.isCorrect(15)).toBe(true);
    expect(fives.isCorrect(16)).toBe(false);
    expect(fives.pool.length).toBeGreaterThan(0);
  });

  it('refuses a factor that would make every value correct', () => {
    // A factor of 1 leaves nothing incorrect, so no wave could ever be composed. Failing at
    // construction beats failing later inside a round the child is already playing.
    expect(() => multipleOf(1, { id: 'x', nameKey: 'obj.x' })).toThrow();
  });
});
