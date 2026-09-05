// SPDX-License-Identifier: AGPL-3.0-or-later
// Composing one wave: which cells light, what they carry, and which of them are correct.
//
// This is where the game stops being the original. In si-em/whackwhack the tiles light
// independently, each on its own timer, and the count on screen drifts. That works when the task
// is "hit what is lit". It breaks when the task is "hit the CORRECT one among what is lit",
// because the child has to know WHICH set they are choosing between — two overlapping sets is
// noise, not difficulty. So the unit becomes the wave, and these are its invariants.

import { describe, expect, it } from 'vitest';
import { EVEN, MULTIPLE_OF_3, MULTIPLE_OF_4 } from '../app/js/rules/category.ts';
import { composeWave } from '../app/js/rules/wave.ts';

const CELLS = 20; // 5 x 4, the original's mat

/**
 * A deterministic stand-in for the engine's rng, so a wave can be asserted rather than sampled.
 *
 * ⚠️ This was xorshift32 and that was a real defect in the SUITE, caught by a mutation that should
 * not have survived. Seeded with a small integer, xorshift32's FIRST output is tiny — 0.000063 for
 * seed 1 — because one round does not diffuse a sparse seed. Every test below opens by drawing the
 * correct count, so seeds 1..400 were all asking for the minimum, and a property suite that looked
 * like it swept the space was re-testing one corner of it four hundred times.
 *
 * mulberry32 is well distributed from the first draw, which is the only property a fixture
 * generator actually owes. The uniformity block below is here so this cannot rot back.
 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('[Interface] the fixture generator is itself uniform', () => {
  // A test-only helper, tested, because everything below is only as strong as its spread.
  it('lands in all ten deciles on its FIRST draw across small seeds', () => {
    const deciles = new Set<number>();
    for (let seed = 1; seed <= 400; seed++) deciles.add(Math.floor(seeded(seed)() * 10));
    expect(deciles.size).toBe(10);
  });

  it('stays inside [0, 1)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rnd = seeded(seed);
      for (let i = 0; i < 50; i++) {
        const v = rnd();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });
});

function compose(litCount: number, seed = 1, category = EVEN) {
  return composeWave({ category, litCount, cellCount: CELLS, deadlineMs: 12_020, rnd: seeded(seed) });
}

describe('[Right] a wave lights the number of tiles it was asked for', () => {
  it.each([2, 3, 4])('lights exactly %i tiles', (n) => {
    expect(compose(n).tiles).toHaveLength(n);
  });

  it('carries the deadline it was handed', () => {
    expect(compose(3).deadlineMs).toBe(12_020);
  });
});

describe('[Right] THE invariant: there is always something to discriminate', () => {
  // If every lit tile were correct, the game would be a reflex test wearing a maths costume; if
  // none were, there would be nothing to hit. Both make the content decorative. This is the one
  // property the whole educational claim rests on, so it is checked across many draws rather
  // than on one lucky fixture.
  it.each([2, 3, 4])('always has at least one correct and one incorrect, at %i lit', (n) => {
    for (let seed = 1; seed <= 400; seed++) {
      const tiles = compose(n, seed).tiles;
      expect(tiles.some((t) => t.correct)).toBe(true);
      expect(tiles.some((t) => !t.correct)).toBe(true);
    }
  });

  it('holds for every category, not just the easy one', () => {
    for (const category of [EVEN, MULTIPLE_OF_3, MULTIPLE_OF_4]) {
      for (let seed = 1; seed <= 120; seed++) {
        const tiles = compose(4, seed, category).tiles;
        expect(tiles.some((t) => t.correct)).toBe(true);
        expect(tiles.some((t) => !t.correct)).toBe(true);
      }
    }
  });
});

describe('[Right] the tiles say the truth about themselves', () => {
  it('flags a tile correct exactly when the category says so', () => {
    for (const category of [EVEN, MULTIPLE_OF_3, MULTIPLE_OF_4]) {
      for (let seed = 1; seed <= 120; seed++) {
        for (const t of compose(4, seed, category).tiles) {
          expect(t.correct).toBe(category.isCorrect(t.value));
        }
      }
    }
  });

  it('only ever shows a value the category owns', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const t of compose(4, seed, MULTIPLE_OF_3).tiles) {
        expect(MULTIPLE_OF_3.pool).toContain(t.value);
      }
    }
  });
});

describe('[Unique] nothing is drawn twice', () => {
  it('never lights the same cell twice', () => {
    // The original's getRandomSlab can pick a tile that is already lit, which orphans the
    // previous timer — a tile that can never be hit and never expires. Not reproduced.
    for (let seed = 1; seed <= 300; seed++) {
      const cells = compose(4, seed).tiles.map((t) => t.cell);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it('never shows the same value twice in one wave', () => {
    // Two tiles reading 8 is not wrong, but it is a worse question: the child cannot tell the
    // two apart, so the wave silently asks for less than it looks like it asks for.
    for (let seed = 1; seed <= 300; seed++) {
      const values = compose(4, seed).tiles.map((t) => t.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe('[Boundary] every cell is on the mat', () => {
  it('stays inside the grid', () => {
    for (let seed = 1; seed <= 300; seed++) {
      for (const t of compose(4, seed).tiles) {
        expect(t.cell).toBeGreaterThanOrEqual(0);
        expect(t.cell).toBeLessThan(CELLS);
        expect(Number.isInteger(t.cell)).toBe(true);
      }
    }
  });

  it('fills the mat when asked for every cell at once', () => {
    // The pool-exhaustion case, and the reason the correct count is bounded on BOTH sides:
    // twenty tiles from a pool of ten evens and ten odds forces exactly ten of each. An
    // unbounded split asks for values that do not exist, and the drawing helper answers with
    // `undefined` rather than failing — so this case has to check the VALUES, not just the
    // cells. Counting cells alone let two real mutations through.
    for (let seed = 1; seed <= 60; seed++) {
      const wave = composeWave({
        category: EVEN, litCount: CELLS, cellCount: CELLS, deadlineMs: 5_000, rnd: seeded(seed),
      });
      expect(new Set(wave.tiles.map((t) => t.cell)).size).toBe(CELLS);
      for (const t of wave.tiles) {
        expect(EVEN.pool).toContain(t.value);
        expect(t.correct).toBe(EVEN.isCorrect(t.value));
      }
      expect(wave.tiles.filter((t) => t.correct)).toHaveLength(10);
      expect(wave.tiles.filter((t) => !t.correct)).toHaveLength(10);
    }
  });

  it('never hands out a value that is not a number', () => {
    // The shape of the failure the two bound mutations produced: a tile that renders blank,
    // is spoken as nothing, and can be neither hit correctly nor left alone correctly.
    for (const litCount of [2, 3, 4, 10, CELLS]) {
      for (let seed = 1; seed <= 40; seed++) {
        const wave = composeWave({
          category: EVEN, litCount, cellCount: CELLS, deadlineMs: 5_000, rnd: seeded(seed),
        });
        for (const t of wave.tiles) expect(Number.isInteger(t.value)).toBe(true);
      }
    }
  });
});

describe('[Simple] the same seed composes the same wave', () => {
  it('is reproducible, which is what makes a round replayable in a test', () => {
    expect(compose(4, 42).tiles).toEqual(compose(4, 42).tiles);
  });

  it('is not the same wave for a different seed', () => {
    // Guards against a "random" composer that quietly ignores its rng.
    const draws = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      draws.add(JSON.stringify(compose(4, seed).tiles));
    }
    expect(draws.size).toBeGreaterThan(1);
  });
});

describe('[Interface] correctness is not predictable from position', () => {
  // A composer that concatenates correct-then-incorrect teaches the child to hit a slot instead
  // of to read the number, which would make the whole educational claim false while every other
  // test here stayed green.
  //
  // ⚠️ The first version of this test asserted only that the set of correct INDICES had more than
  // one member, and it was worthless: an unshuffled wave already spreads correct tiles over
  // indices 0..n-1 as the correct count varies. It appeared to work only while the fixture rng
  // was broken and pinned that count to its minimum. The property is the ORDER, not the spread.
  it('sometimes places an incorrect tile before a correct one', () => {
    let inverted = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const tiles = compose(4, seed).tiles;
      const firstWrong = tiles.findIndex((t) => !t.correct);
      const lastRight = tiles.map((t) => t.correct).lastIndexOf(true);
      if (firstWrong < lastRight) inverted++;
    }
    // Unshuffled this is exactly zero, every seed, forever.
    expect(inverted).toBeGreaterThan(20);
  });

  it('puts a correct tile in every slot, given enough waves', () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      compose(4, seed).tiles.forEach((t, i) => { if (t.correct) positions.add(i); });
    }
    expect(positions.size).toBe(4);
  });
});

describe('[Zero] a wave that cannot be a question is refused', () => {
  it('refuses to light fewer than two tiles', () => {
    expect(() => compose(1)).toThrow();
    expect(() => compose(0)).toThrow();
  });

  it('refuses a fractional number of tiles', () => {
    // 2.5 is the case the supply check downstream does NOT catch: it leaves minCorrect below
    // maxCorrect, so composition proceeds and `take` rounds the count off on its own. Only the
    // integer guard says no. Without this the guard could be deleted and every other test here
    // would still pass, because the supply check happens to throw for 0 and 1.
    expect(() => compose(2.5)).toThrow();
  });

  it('refuses to light more tiles than the mat has cells', () => {
    expect(() => composeWave({
      category: EVEN, litCount: 21, cellCount: CELLS, deadlineMs: 5_000, rnd: seeded(1),
    })).toThrow();
  });

  it('refuses a deadline that has already passed', () => {
    expect(() => composeWave({
      category: EVEN, litCount: 3, cellCount: CELLS, deadlineMs: 0, rnd: seeded(1),
    })).toThrow();
  });
});
