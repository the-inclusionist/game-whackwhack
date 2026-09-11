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

import { readFileSync, readdirSync } from 'node:fs';
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

describe('[Interface] the engine imports nothing it has not declared', () => {
  /**
   * ⚠️ THIS IS THE GENERAL FORM OF A DEFECT THAT REALLY SHIPPED. Engine 6.36.1's
   * `dist-pkg/platform/tts.js` — shipped runtime code — imported `@mintplex-labs/piper-tts-web`,
   * which the engine declared under `devDependencies`. npm does not install those for a consumer,
   * so the import resolved to nothing and `npm run build` failed here with
   *
   *     Rolldown failed to resolve import "@mintplex-labs/piper-tts-web"
   *
   * It broke every consumer, not only this game, and nothing on either side would have caught it:
   * the engine's own build resolves it from its dev tree, and this repository only found out by
   * moving off the `file:` symlink. 7.0.1 fixed it by removing the import.
   *
   * So the assertion is not about that package. It is about the CLASS: every bare specifier in the
   * engine's shipped code has to be something a consumer will actually have.
   */
  const ENGINE_DIR = join(ROOT, 'node_modules', '@the-inclusionist', 'engine');
  const ENGINE = JSON.parse(readFileSync(join(ENGINE_DIR, 'package.json'), 'utf8')) as {
    version: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  /** Every `.js` under dist-pkg, walked rather than globbed so the node project needs no plugin. */
  function shippedFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...shippedFiles(full));
      else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
  }

  /** Bare specifiers only — a relative path is the package's own business. */
  function bareImports(code: string): string[] {
    const out: string[] = [];
    const patterns = [
      /\bfrom\s*['"]([^'"]+)['"]/g,
      /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const re of patterns) {
      for (const m of code.matchAll(re)) {
        const spec = m[1];
        if (!spec.startsWith('.') && !spec.startsWith('node:')) out.push(spec);
      }
    }
    return out;
  }

  /** `@scope/name/deep/path` → `@scope/name`. */
  const packageOf = (spec: string): string =>
    spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

  it('declares every package its shipped code imports', () => {
    const declared = new Set([
      ...Object.keys(ENGINE.dependencies ?? {}),
      ...Object.keys(ENGINE.peerDependencies ?? {}),
    ]);
    const missing = new Set<string>();
    for (const file of shippedFiles(join(ENGINE_DIR, 'dist-pkg'))) {
      for (const spec of bareImports(readFileSync(file, 'utf8'))) {
        if (!declared.has(packageOf(spec))) missing.add(`${packageOf(spec)} (in ${file.slice(ENGINE_DIR.length + 1)})`);
      }
    }
    expect([...missing], 'the engine ships imports a consumer cannot resolve').toEqual([]);
  });

  it('finds shipped code to look at, so the check is not vacuous', () => {
    // A gate that walks an empty directory reports success. This is the half that says it walked.
    expect(shippedFiles(join(ENGINE_DIR, 'dist-pkg')).length).toBeGreaterThan(20);
  });

  it('actually EXTRACTS imports, or the check above passes on a broken regex', () => {
    // ⚠️ THE OTHER WAY THIS GATE COULD BE VACUOUS. Walking a hundred files and matching nothing in
    // any of them reports "no undeclared imports" just as cheerfully as a clean package would.
    // `pixi.js` is known to be there — it is the engine's one declared peer and its renderer
    // imports it — so finding it proves the scanner works before its silence is trusted.
    const found = new Set<string>();
    for (const file of shippedFiles(join(ENGINE_DIR, 'dist-pkg'))) {
      for (const spec of bareImports(readFileSync(file, 'utf8'))) found.add(packageOf(spec));
    }
    expect([...found], 'the import scanner found nothing at all').not.toEqual([]);
    expect(found).toContain('pixi.js');
  });

  it('does not put the engine\'s pixi PEER into this game\'s own manifest', () => {
    // The engine peer-depends on pixi.js 7.4.2, so npm installs it here even though this game
    // dropped PixiJS entirely (465 KB raw, measured). Installed is not shipped: nothing in this
    // game's import graph reaches it, and the built bundle carries none of it.
    expect(ENGINE.peerDependencies ?? {}).toHaveProperty('pixi.js');
    const own = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(own.dependencies).not.toHaveProperty('pixi.js');
  });
});

describe('[Right] no comment names an engine version the manifest does not', () => {
  /**
   * ⚠️ THIS EXISTS BECAUSE A COMMENT SAT ON THE WRONG VERSION THROUGH TWO UPGRADES.
   * `vite.config.ts` said "the dependency is now the pinned version 6.36.1" while the manifest had
   * moved to 7.0.1, then to 8.0.0-rc.1, then to 8.0.0. It survived a deliberate sweep for stale
   * references
   * because that sweep grepped for `7.0.1` — the version being replaced — and the comment named
   * the one BEFORE it. Searching for the number you expect finds only the drift you predicted.
   *
   * So this does not search for a number at all. It finds every phrase of the form
   * "pinned ... VERSION" in the repository's own prose and requires each to be the version
   * `package.json` actually pins, whatever that is.
   */
  const PIN = (JSON.parse(read('package.json')) as {
    dependencies: Record<string, string>;
  }).dependencies['@the-inclusionist/engine'];

  // ⚠️ THIS FILE IS NOT IN THE LIST, and excluding it is not convenience. It is the scanner:
  // its own regex source contains the very phrase it looks for, so it would always report a
  // claim of "]*" and fail on itself forever.
  const PROSE = ['vite.config.ts', '.github/workflows/ci.yml'];

  it('pins an exact version, never a range', () => {
    // ⚠️ EXACT EVEN NOW THAT THE PIN IS STABLE. The first reason was that a caret on a PRERELEASE
    // is how a build changes under a runner with nothing in the diff to show it, and for a while
    // this game ran ahead of `latest` on purpose. 8.0.0 caught up, and the rule outlives its first
    // reason: a range lets the runner and this machine compile different code from one commit.
    // The prerelease branch of the pattern stays because the next RC is a pin away.
    expect(PIN, 'the engine pin must be exact').toMatch(/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/);
  });

  it.each(PROSE)('%s names the pinned version and no other', (file) => {
    const text = read(...file.split('/'));
    // ⚠️ THE BACKTICK MUST FOLLOW THE WORD, not merely share a line with it. The first version
    // allowed any run of non-newline characters between them, and it flagged the sentence
    // "it is pinned EXACTLY for that reason. `latest` on the registry is 7.0.1" -- the sentence
    // `ci.yml` carried at the time, true, and not a claim about the pin. A gate that fires on
    // correct writing gets switched off.
    const claimed = [...text.matchAll(/pinned(?: version)? `([^`]+)`/g)]
      .map((m) => m[1]);
    for (const version of claimed) {
      expect(version, `${file} says the pin is ${version}, the manifest says ${PIN}`)
        .toBe(PIN);
    }
  });

  it('finds a claim to check, so the sweep is not vacuous', () => {
    // Every one of those files SHOULD carry the phrase. A regex that matched nothing would report
    // three clean files, which is the same shape as three drifted ones.
    const found = PROSE.filter(
      (f) => /pinned(?: version)? `[^`]+`/.test(read(...f.split('/'))),
    );
    expect(found.length, 'no file states a pinned version at all').toBeGreaterThan(0);
  });
});
