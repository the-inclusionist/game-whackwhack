// SPDX-License-Identifier: AGPL-3.0-or-later
// The numbers the documentation states, held to the numbers the code uses.
//
// ========================= WHY THIS FILE EXISTS =========================
// ⚠️ THIS REPOSITORY HAS BEEN BITTEN BY PROSE THREE TIMES, and every one was a comment or a
// document that had gone on asserting something after the code moved underneath it:
//
//   · `style.css` cited `tests/style-palette.node.test.ts` as holding two colour lists together.
//     No such file existed. A cited gate that is not there is worse than no gate, because it
//     invites the next reader to move a colour and trust it.
//   · `docs/spike-0-symbol-legibility.md` presented a decision table naming a glyph height of 9,
//     a camera zoom of 4.4, a stroke of 1.5 and "the Pixi pass" — after the height became 8, the
//     zoom 5.0, the stroke irrelevant to text, and PixiJS was deleted from the project.
//   · A comment in `tests/canvas.browser.test.ts` narrated a zoom of "5.4, then back to 4.6"
//     three lines above an assertion of 5.0.
//
// The house rule is that a document which changes becomes a test, a task or a record. This is that
// test, for the half of documentation that CAN be checked: the numbers. It cannot check whether the
// prose is true, only whether the figures in it are the ones the code uses — which is exactly the
// half that rots silently, because nobody re-reads a table to see if it still agrees with a
// constant somewhere else.
//
// ⚠️ IT READS THE DOCUMENTS AS TEXT, deliberately. Deriving the expected values from the same
// constants the documents quote would make them agree by construction and prove nothing — the same
// reason `tests/style-palette` reads `style.css` off disk rather than importing a shared value.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLYPH_FAMILY, GLYPH_HEIGHT } from '../app/js/render/glyph.ts';
import { CAMERA } from '../app/js/render/zdog-stage.ts';
import { MAT_COLS, MAT_ROWS } from '../app/js/rules/grid.ts';
import { ROUND_GOAL } from '../app/js/rules/difficulty.ts';
import { MIN_TILES_PER_LEVEL } from '../app/js/rules/spawn.ts';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...parts: string[]): string => readFileSync(join(ROOT, ...parts), 'utf8');

const SPIKE = read('docs', 'spike-0-symbol-legibility.md');
const RULES = read('docs', 'GAME-RULES.md');
const PACKAGE = JSON.parse(read('package.json')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('[Right] spike 0 says plainly which of its conclusions are dead', () => {
  it('carries a supersession notice at the top, not buried at the bottom', () => {
    // A reader who stops after the verdict line must still be told. The notice is in the first
    // 1200 characters on purpose — above the fold of any reasonable render.
    expect(SPIKE.slice(0, 1200)).toMatch(/NO LONGER HOLD/);
  });

  it('names the face that actually draws the numbers', () => {
    expect(SPIKE).toContain(GLYPH_FAMILY);
  });

  it('states the CURRENT glyph height, not only the one it decided', () => {
    // ⚠️ The point of this assertion: change `GLYPH_HEIGHT` again and the document's "8" becomes a
    // fourth false number in a file that has already had five. This is what forces it to move too.
    expect(SPIKE).toMatch(new RegExp(`\\*\\*${GLYPH_HEIGHT}\\*\\*`));
    // And it still records what it decided that day, because that is the only copy of it.
    expect(SPIKE).toContain('9 world units on a 16-unit tile');
  });

  it('states the CURRENT camera zoom', () => {
    expect(SPIKE).toMatch(new RegExp(`\\*\\*${CAMERA.zoom.toFixed(1)}\\*\\*`));
  });

  it('does not present its old table as current', () => {
    // ⚠️ TWO ASSERTIONS, because a mutation escaped on one. The blockquote above the table was
    // checked and the table's own HEADER ROW was not -- and the header is what a reader skimming
    // to the bottom of the file actually sees. Dating the column is what stops "Decision | Value"
    // reading as the decision in force.
    expect(SPIKE).toMatch(/AS DECIDED ON 2026-09-05/);
    expect(SPIKE).toMatch(/\| Decision \(2026-09-05\) \| Value as decided then \|/);
  });
});

describe('[Right] the claim that PixiJS is gone is true', () => {
  it('is not a dependency of any kind', () => {
    // The spike's table says the glyph rides "in the Pixi pass". The supersession notice says the
    // library was removed; this is what makes that a fact rather than a recollection.
    for (const field of ['dependencies', 'devDependencies'] as const) {
      expect(Object.keys(PACKAGE[field] ?? {}), field).not.toContain('pixi.js');
    }
  });

  it('is not imported anywhere in the app', () => {
    // A dependency can be removed from the manifest and left in an import, which fails at build
    // time — but only for whoever builds next.
    expect(read('app', 'js', 'boot', 'main.ts')).not.toContain('pixi');
  });
});

describe('[Right] GAME-RULES states the shape of the game the code plays', () => {
  it('says the mat is four by five, as the original\'s stylesheet has it', () => {
    // `4×5`, `4x5` or "4 by 5" — the document writes the first and a future edit may write any.
    expect(RULES).toMatch(new RegExp(`${MAT_COLS}\s*(?:×|x|by)\s*${MAT_ROWS}`, 'i'));
  });

  it('says a level is N tiles with a floor of four', () => {
    expect(MIN_TILES_PER_LEVEL).toBe(4);
    expect(RULES).toMatch(/floor of four/i);
  });

  it('says the goal is the goal the rules use', () => {
    expect(RULES).toContain(String(ROUND_GOAL));
  });

  it('records that the seven-segment layout was replaced, and why', () => {
    // The spike's verdict is reversed in two documents and neither may quietly forget it.
    expect(RULES).toContain(GLYPH_FAMILY);
    expect(RULES).toMatch(/seven-segment/i);
  });
});

describe('[Interface] the documents point at gates that exist', () => {
  it.each([
    'tests/style-palette.node.test.ts',
    'tests/mat.browser.test.ts',
    'tests/glyph.browser.test.ts',
  ])('%s is cited and is really there', (path) => {
    // ⚠️ THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT. `style.css` named a test file
    // that had never been written, and nothing anywhere noticed for several commits.
    const cited = SPIKE.includes(path) || RULES.includes(path) || read('app', 'css', 'style.css').includes(path);
    expect(cited, `${path} is not cited by any document`).toBe(true);
    expect(() => read(path)).not.toThrow();
  });
});
