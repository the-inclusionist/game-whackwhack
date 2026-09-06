// SPDX-License-Identifier: AGPL-3.0-or-later
// The DDR words, and when one of them replaces the "+1".
//
// The rule is si-em/whackwhack's own, read off `AppFooter.vue` rather than remembered:
//
//     if (ev[1] && ev[1] % 5 == 0) { …random word… } else { …the '+1'… }
//
// Two things about it are easy to get wrong from memory, and both have a test here. It is not a
// STREAK — a mistake resets nothing, because the trigger is the running score being divisible by
// five. And the word is RANDOM rather than tiered; there is no ladder from "Good!" to "Savage!".

import { describe, expect, it } from 'vitest';
import { COMBO_EVERY, COMBO_KEYS, comboKeyFor } from '../app/js/rules/combo.ts';

/** mulberry32, the same fixture the round and spawn tests use. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const always = (value: number) => () => value;

describe('[Right] a word arrives on every fifth point and no other', () => {
  it('gives a word at 5, 10, 15 and 20', () => {
    for (const hits of [5, 10, 15, 20]) {
      expect(comboKeyFor(hits, seeded(hits)), String(hits)).not.toBeNull();
    }
  });

  it('gives nothing on the four points between', () => {
    for (const hits of [1, 2, 3, 4, 6, 7, 8, 9, 11, 19]) {
      expect(comboKeyFor(hits, seeded(1)), String(hits)).toBeNull();
    }
  });

  it('uses the original\'s five, not some other interval', () => {
    // Pinned as a LITERAL. Every other assertion here spells the interval with COMBO_EVERY, so
    // they would all hold for an interval of three — and five is a product fact carried over from
    // si-em/whackwhack rather than an implementation detail.
    expect(COMBO_EVERY).toBe(5);
  });
});

describe('[Zero] a score of nothing earns nothing', () => {
  it('is silent at zero', () => {
    // ⚠️ The original guards this with `if (ev[1] && …)`, and the guard is load-bearing: zero is
    // divisible by five, so without it the footer would shout "Savage!" before the first hit.
    expect(comboKeyFor(0, seeded(1))).toBeNull();
  });

  it('is silent for a negative or fractional score, which cannot happen but would be worse', () => {
    for (const hits of [-5, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(comboKeyFor(hits, seeded(1)), String(hits)).toBeNull();
    }
  });
});

describe('[Right] the word is one of the five, chosen at random', () => {
  it('only ever returns a key from the list', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(COMBO_KEYS).toContain(comboKeyFor(5, seeded(seed)));
    }
  });

  it('reaches every one of the five over enough draws', () => {
    // A `Math.floor(rnd() * 5)` that lost its multiplier would return one key forever and pass
    // every other assertion in this file.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) seen.add(comboKeyFor(5, seeded(seed)) ?? '');
    expect(seen.size).toBe(COMBO_KEYS.length);
  });

  it('does not tier by score — the same seed says the same thing at 5 as at 50', () => {
    // ⚠️ There is no ladder. Building one would be inventing a difficulty signal the game does
    // not have, and this is the assertion that notices someone adding it.
    expect(comboKeyFor(5, seeded(9))).toBe(comboKeyFor(50, seeded(9)));
  });

  it('is reproducible from a seed, which is what makes a round replayable', () => {
    expect(comboKeyFor(15, seeded(4))).toBe(comboKeyFor(15, seeded(4)));
  });
});

describe('[Boundary] a generator at either end of its range stays inside the list', () => {
  it('takes the first key at exactly 0', () => {
    expect(comboKeyFor(5, always(0))).toBe(COMBO_KEYS[0]);
  });

  it('takes the LAST key at exactly 1, rather than running off the end', () => {
    // ⚠️ `rnd()` is documented as [0, 1), so this should be impossible — which is exactly why it
    // is worth pinning. A generator that returns 1, or a test fixture handing over a constant,
    // would otherwise index past the end and put the string "undefined" on screen.
    expect(comboKeyFor(5, always(1))).toBe(COMBO_KEYS[COMBO_KEYS.length - 1]);
  });

  it('never returns undefined dressed as a key', () => {
    for (const value of [0, 0.999999, 1, 1.5]) {
      expect(typeof comboKeyFor(5, always(value)), String(value)).toBe('string');
    }
  });
});

describe('[Interface] the words are keys, not prose', () => {
  it('carries five of them', () => {
    expect(COMBO_KEYS).toHaveLength(5);
  });

  it('names every one under the combo namespace', () => {
    // The catalogue's completeness test covers whatever is in here, so a word added as a bare
    // string would be the one thing on screen that no locale could translate.
    for (const key of COMBO_KEYS) expect(key).toMatch(/^combo\./);
  });

  it('has no duplicates, which would silently weight one word double', () => {
    expect(new Set(COMBO_KEYS).size).toBe(COMBO_KEYS.length);
  });
});
