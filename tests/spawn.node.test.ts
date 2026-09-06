// SPDX-License-Identifier: AGPL-3.0-or-later
// What a level asks about: how many tiles, and what is written on them.
//
// ========================= THE FIXTURE RNG IS PART OF THE TEST =========================
// ⚠️ The first one here was xorshift32, and it was BROKEN in a way that made the suite lie. Its
// first output for a small seed is about 0.000063 — so every one of four hundred seeds drew the
// minimum of every range, and a distribution test passed by never exercising the distribution.
// mulberry32 is used instead, and the first block below tests the FIXTURE, not the code: a
// generator that is asked to prove randomness has to be shown to have some.

import { describe, expect, it } from 'vitest';
import type { Category } from '../app/js/rules/category.ts';
import { CATEGORIES, EVEN, MULTIPLE_OF_3 } from '../app/js/rules/category.ts';
import {
  MIN_TILES_PER_LEVEL, composeLevel, shuffled, take, tilesInLevel,
} from '../app/js/rules/spawn.ts';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const level = (over: Partial<Parameters<typeof composeLevel>[0]> = {}) => composeLevel({
  category: EVEN, count: 8, rnd: seeded(11), ...over,
});

describe('[Interface] the fixture generator is itself uniform', () => {
  it('does not open near zero for every small seed', () => {
    // The exact failure that made a four-hundred-seed test meaningless.
    const firsts = Array.from({ length: 200 }, (_, i) => seeded(i + 1)());
    expect(Math.min(...firsts)).toBeLessThan(0.2);
    expect(Math.max(...firsts)).toBeGreaterThan(0.8);
  });

  it('spreads across the unit interval', () => {
    const rnd = seeded(3);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10_000; i++) buckets[Math.floor(rnd() * 10)] += 1;
    for (const count of buckets) expect(count).toBeGreaterThan(700);
  });
});

describe('[Right] how many tiles a level asks about', () => {
  it('is four for each of the first four levels', () => {
    // "com excecao dos quatro primeiros niveis, onde aparecem quatro tiles para julgar."
    for (const n of [1, 2, 3, 4]) expect(tilesInLevel(n)).toBe(MIN_TILES_PER_LEVEL);
  });

  it('is N at level N once past the floor', () => {
    // "no nivel 20 devem aparecer e sumir 20 tiles para julgar."
    for (const n of [5, 6, 20, 100]) expect(tilesInLevel(n)).toBe(n);
  });

  it('never returns fewer than the floor, however small the argument', () => {
    // A level of one tile is not a level: it gives a child no chance to settle into the question
    // before the ground moves.
    for (const n of [-5, 0, 1, 2]) expect(tilesInLevel(n)).toBe(MIN_TILES_PER_LEVEL);
  });

  it('is monotonically non-decreasing, so a level never gets shorter', () => {
    for (let n = 2; n <= 60; n++) expect(tilesInLevel(n)).toBeGreaterThanOrEqual(tilesInLevel(n - 1));
  });
});

describe('[Right] a level always has something to collect AND something to leave alone', () => {
  it('holds at least one correct and one incorrect tile, over many seeds', () => {
    // ⚠️ The invariant that makes the level a QUESTION. All-wrong gives the child nothing to
    // collect; all-right gives them nothing to judge. Either way the round stops asking anything
    // while still looking as though it is.
    for (let seed = 1; seed <= 400; seed++) {
      for (const count of [4, 5, 8, 20]) {
        const values = level({ count, rnd: seeded(seed) });
        expect(values.filter((v) => v.correct).length, `${seed}/${count}`).toBeGreaterThan(0);
        expect(values.filter((v) => !v.correct).length, `${seed}/${count}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the correct share between a third and two thirds', () => {
    // Not a free coin. An unweighted draw over twenty tiles produces near-all-wrong levels often
    // enough to matter, and a child who hits nothing for a whole level learns that the game is
    // broken rather than that they were careful.
    for (let seed = 1; seed <= 200; seed++) {
      const count = 12;
      const right = level({ count, rnd: seeded(seed) }).filter((v) => v.correct).length;
      expect(right / count, String(seed)).toBeGreaterThanOrEqual(1 / 3);
      expect(right / count, String(seed)).toBeLessThanOrEqual(2 / 3);
    }
  });

  it('asks for exactly the count it was given', () => {
    for (const count of [2, 3, 4, 7, 20, 50]) {
      expect(level({ count }).length, String(count)).toBe(count);
    }
  });

  it('labels every value against the category it was composed for', () => {
    // `correct` is not decoration: it is what the round scores on and what the declaration turns
    // into `goal` or `hazard`. A label that disagreed with the predicate would make the sonar
    // point at the wrong tiles while every count still added up.
    for (const category of CATEGORIES) {
      for (const value of composeLevel({ category, count: 20, rnd: seeded(5) })) {
        expect(category.isCorrect(value.value), `${category.id}:${value.value}`).toBe(value.correct);
      }
    }
  });

  it('draws only from the category pool', () => {
    for (const value of level({ category: MULTIPLE_OF_3, count: 20 })) {
      expect(MULTIPLE_OF_3.pool).toContain(value.value);
    }
  });
});

describe('[Right] the order is shuffled, so position teaches nothing', () => {
  it('does not open with every correct tile and close with every wrong one', () => {
    // Without the shuffle a level is sorted by correctness, and a child who noticed would learn a
    // rhythm instead of a category — which is the exact failure this game exists to avoid.
    let sorted = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const flags = level({ count: 12, rnd: seeded(seed) }).map((v) => v.correct);
      const isSorted = flags.every((c, i) => i === 0 || flags[i - 1] || !c);
      if (isSorted) sorted += 1;
    }
    // A handful of shuffles will land sorted by chance; nearly all of them must not.
    expect(sorted).toBeLessThan(20);
  });

  it('gives different seeds different sequences', () => {
    const a = level({ rnd: seeded(1) }).map((v) => v.value).join(',');
    const b = level({ rnd: seeded(2) }).map((v) => v.value).join(',');
    expect(a).not.toBe(b);
  });

  it('gives the SAME seed the same sequence, which is what makes a round reproducible', () => {
    expect(level({ rnd: seeded(9) })).toEqual(level({ rnd: seeded(9) }));
  });
});

describe('[Boundary] a level that cannot be a question refuses to be composed', () => {
  it('rejects a count below two', () => {
    // One tile has nothing to be discriminated against. Throwing at composition beats throwing
    // inside a round already in play: the first is a programming mistake, the second is a crash
    // in a classroom.
    for (const count of [0, 1, -3]) expect(() => level({ count })).toThrow(/at least 2/);
  });

  it('rejects a fractional count', () => {
    expect(() => level({ count: 4.5 })).toThrow();
  });

  it('rejects a category that cannot discriminate', () => {
    // ⚠️ BUILT AS A LITERAL, not through `multipleOf`. The factory rejects this first — its own
    // guard fires on "0 incorrect values" — so going through it would have tested the factory
    // while claiming to test this. `composeLevel` is public and a future category source (a
    // teacher's word list, say) need not come through the factory at all, so its guard has to be
    // shown to work on its own.
    const everything: Category = {
      id: 'all',
      nameKey: 'obj.multiplesOf2',
      nameGender: 'm',
      namePlural: true,
      pool: [2, 4, 6, 8],
      isCorrect: () => true,
    };
    expect(() => level({ category: everything })).toThrow(/discriminate/);

    const nothing: Category = { ...everything, id: 'none', isCorrect: () => false };
    expect(() => level({ category: nothing })).toThrow(/discriminate/);
  });
});

describe('[Right] take and shuffled do what the composition depends on', () => {
  it('takes distinct members, never a repeat', () => {
    const drawn = take([1, 2, 3, 4, 5, 6, 7, 8], 5, seeded(4));
    expect(drawn).toHaveLength(5);
    expect(new Set(drawn).size).toBe(5);
  });

  it('never asks for more than the source holds', () => {
    expect(take([1, 2, 3], 10, seeded(4))).toHaveLength(3);
  });

  it('keeps every member when shuffling, and only reorders', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffled(source, seeded(6));
    expect([...out].sort((a, b) => a - b)).toEqual(source);
  });

  it('does not mutate what it was given', () => {
    const source = [1, 2, 3, 4, 5];
    shuffled(source, seeded(6));
    take(source, 3, seeded(6));
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });

  it('actually reorders, over many seeds', () => {
    // A `shuffled` that returned its input unchanged would pass every assertion above.
    const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let moved = 0;
    for (let seed = 1; seed <= 50; seed++) {
      if (shuffled(source, seeded(seed)).join(',') !== source.join(',')) moved += 1;
    }
    expect(moved).toBeGreaterThan(45);
  });
});
