// SPDX-License-Identifier: AGPL-3.0-or-later
// The vendored typefaces, and whether they can actually draw the words this game shows.
//
// ========================= WHY THIS FILE EXISTS =========================
// ⚠️ THE TITLE SHIPPED IN THE WRONG TYPEFACE FOR FOUR COMMITS AND EVERY AVAILABLE CHECK SAID IT
// WAS RIGHT. `press-start-2p-400.woff2` was the **cyrillic-ext** subset: a valid woff2, correctly
// declared, correctly loaded, containing not one Latin letter. Google Fonts serves this family as
// five files ordered by `unicode-range` with latin LAST, and the vendoring took the first `src:`
// it found.
//
// What the page then reported, live, in the browser, with the wrong glyphs on screen:
//
//     document.fonts.check('16px "Press Start 2P"')       →  true
//     [...document.fonts].map(f => f.status)              →  ['loaded', 'loaded']
//     getComputedStyle('.title-mark').fontFamily          →  '"Press Start 2P", monospace'
//
// All three are true and all three are useless, because each one compares the family NAME — a
// string written twice, once in the `@font-face` and once in the rule, by the same hand. Nothing
// there looks inside the file. And CSS font matching resolves per CODEPOINT, so a face that loads
// but has no glyph for `U+0057` is skipped for that character in silence: no console error, no
// failed request, no `document.fonts` state to read. The Dev reported the wrong font three times
// before it was found by looking at a screenshot.
//
// ========================= WHAT MEASURES IT INSTEAD =========================
// The ADVANCE WIDTH of each character, which comes from the glyph and therefore from the file.
//
// Press Start 2P is monospaced at exactly 1em — measured, not assumed: every character of every
// word this game shows advances 48.0 px at `48px`. The fallback in the stack is `serif`, which is
// proportional and spreads 13.3 to 45.3 px over the same characters. So a single character that
// fell back would break the uniformity, and a whole string that fell back would match serif
// exactly. Both are asserted, because they fail for different reasons: the first catches a hole in
// the coverage, the second catches the face being absent altogether.
//
// The control uses `serif` rather than the stylesheet's own `monospace`, and that is the whole
// trick: against a monospaced fallback the measurement is identical whether the face loaded or
// not, and this test would have passed on the cyrillic-ext file too.

import { beforeAll, describe, expect, it } from 'vitest';
import { en } from '../app/js/i18n/en.ts';
import { es } from '../app/js/i18n/es.ts';
import { pt } from '../app/js/i18n/pt.ts';
import '../app/css/style.css';

/** Big enough that a rounding difference cannot look like a glyph difference. */
const SIZE = 48;

/**
 * Every key drawn in Press Start 2P, in all three languages. Taken from the catalogues rather than
 * typed here, so a new word in a translation is covered the day it lands — the Portuguese "Opções"
 * and "Você conseguiu!" carry accents that a pixel face is not obliged to have, and finding that
 * out from a test is cheaper than finding it out from the Dev.
 */
const ARCADE_KEYS = [
  'game.title', 'title.mark', 'title.school', 'title.play', 'title.options', 'title.lead',
  'result.won', 'result.lost', 'result.score', 'result.level', 'result.again', 'result.change',
] as const;

function arcadeCharacters(): string[] {
  const seen = new Set<string>();
  for (const catalogue of [pt, en, es]) {
    for (const key of ARCADE_KEYS) {
      for (const ch of (catalogue as Record<string, string>)[key] ?? '') {
        // Whitespace has no glyph to compare and `{}` placeholders never reach the screen.
        if (!/\s|[{}]/.test(ch)) seen.add(ch);
      }
    }
  }
  return [...seen];
}

let measure: (font: string, text: string) => number;

beforeAll(async () => {
  // ⚠️ `@font-face` IS LAZY. A declared face is not fetched until something on the page asks to
  // draw with it, and this page draws nothing — so `document.fonts.ready` resolves immediately
  // with both faces still unloaded, and every measurement below silently reads the fallback.
  // `load()` is the request; it takes the text so that a subsetted face fetches the right file.
  await Promise.all([
    document.fonts.load(`${SIZE}px 'Press Start 2P'`, arcadeCharacters().join('')),
    document.fonts.load(`${SIZE}px 'Playwrite BR'`, 'Schoolution'),
  ]);
  await document.fonts.ready;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('no 2d context to measure with');
  measure = (font, text) => { ctx.font = font; return ctx.measureText(text).width; };
});

describe('[Right] the vendored Press Start 2P can draw the words the game shows', () => {
  it('is loaded at all', () => {
    // Kept as the FIRST assertion and trusted for nothing else: it was true throughout the bug.
    expect(document.fonts.check(`${SIZE}px "Press Start 2P"`)).toBe(true);
  });

  it('gives every arcade character the same 1em advance, so none fell through to serif', () => {
    const widths = new Map<string, number>();
    for (const ch of arcadeCharacters()) {
      widths.set(ch, measure(`${SIZE}px 'Press Start 2P', serif`, ch));
    }
    // Named individually: a bare `new Set(...).size === 1` reports "expected 3 to be 1" and leaves
    // the reader to work out WHICH characters have no glyph.
    const wrong = [...widths].filter(([, w]) => w !== SIZE).map(([ch, w]) => `${ch}=${w}`);
    expect(wrong).toEqual([]);
  });

  it('does not simply agree with the fallback, which is what a missing face looks like', () => {
    for (const ch of arcadeCharacters()) {
      expect(measure(`${SIZE}px 'Press Start 2P', serif`, ch))
        .not.toBe(measure(`${SIZE}px serif`, ch));
    }
  });

  it('is monospaced, which is the assumption the 15vw logo width is derived from', () => {
    // `.title-mark` is sized so that five characters of "Whack" occupy 5 x 15vw = 75vw. That is
    // only true while the advance is 1em, so the stylesheet's comment and this measurement are
    // the same claim and have to be checked together.
    expect(measure(`${SIZE}px 'Press Start 2P', serif`, 'Whack')).toBe(SIZE * 5);
  });
});

describe('[Right] the vendored Playwrite BR can draw "Schoolution"', () => {
  it('is loaded', () => {
    expect(document.fonts.check(`${SIZE}px "Playwrite BR"`)).toBe(true);
  });

  it('draws every letter of the word itself rather than deferring to serif', () => {
    // Playwrite BR is proportional, so there is no uniform advance to check. What can be checked
    // is that it disagrees with the fallback everywhere — a cursive face and a serif one have no
    // reason to agree on a single advance, and if they do it is because only one of them is there.
    for (const ch of new Set('Schoolution')) {
      expect(measure(`${SIZE}px 'Playwrite BR', serif`, ch))
        .not.toBe(measure(`${SIZE}px serif`, ch));
    }
  });
});
