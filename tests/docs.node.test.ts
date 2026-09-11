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

/** Source with its comments removed, so an example in a doc comment is not read as code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

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

describe('[Interface] the two engine gaps this game works around still exist', () => {
  /**
   * ⚠️ THESE TESTS FAIL WHEN THE ENGINE IS FIXED, AND THAT IS THE WHOLE POINT.
   *
   * `docs/engine-8-consumer-gaps.md` reports two places where engine 8 mounts a surface for every
   * game and gives the consumer no parameter to fill it. This game works around both — `boot/main`
   * revives the pause's `resume` item, and `ui/vision` holds the colour-vision state the engine
   * never asks for. Both are marked for deletion.
   *
   * A workaround marked for deletion and never deleted is how a codebase collects permanent
   * scaffolding. So the deletion date is not a comment: it is a red test. The day an engine upgrade
   * closes either gap, the assertion below breaks, names the file to delete, and the workaround
   * goes with it.
   *
   * 📌 The same move this repository used for the `piper-tts-web` shim, and for the same reason:
   * the fix arrives in someone else's release, on a day nobody here is looking for it.
   */
  const ENGINE = 'node_modules/@the-inclusionist/engine/dist-pkg';

  it('still actions no `resume`, so `reviveResume` in boot/main is still needed', () => {
    // `ITENS_DA_ENGINE` is the set the engine dispatches itself; everything else needs
    // `getPauseActs`, which `createGame` does not pass and `CreateGameOptions` cannot carry.
    const src = read(...`${ENGINE}/ui/pause-icons.js`.split('/'));
    const line = src.split('\n').find((l) => l.includes('ITENS_DA_ENGINE = '));
    expect(line, 'ITENS_DA_ENGINE is gone; re-read the engine before trusting this gate').toBeTruthy();
    expect(
      line!.includes("'resume'"),
      'THE ENGINE NOW ACTIONS `resume`: delete `reviveResume` in app/js/boot/main.ts and its tests',
    ).toBe(false);
  });

  it('still passes no visual writers, so ui/vision is still needed', () => {
    /**
     * `initPauseIcons` asks `Boolean(ctx.setTemaDoJogador)` / `Boolean(ctx.setCorrecaoDoJogador)`
     * to decide whether the contrast and colour-vision icons exist at all. `createGame` never
     * mentions either name — which is the measurement, and this is it held in place.
     */
    const src = read(...`${ENGINE}/boot/create-game.js`.split('/'));
    expect(
      src.includes('setCorrecaoDoJogador'),
      'THE ENGINE NOW TAKES A COLOUR-VISION WRITER: delete app/js/ui/vision.ts and hand it over',
    ).toBe(false);
    expect(
      src.includes('setTemaDoJogador'),
      'THE ENGINE NOW TAKES A THEME WRITER: the contrast icon can be mounted (plan item A1b)',
    ).toBe(false);
  });

  it('is reported where a reader will find it, not only in a comment', () => {
    // ⚠️ A gate that fires with nowhere to read WHY is a puzzle. The document is the why, and this
    // is what keeps the two from drifting apart — it has been the failure mode here before, when
    // `style.css` cited a test file nobody had written.
    const report = read('docs', 'engine-8-consumer-gaps.md');
    expect(report).toContain('ITENS_DA_ENGINE');
    expect(report).toContain('setCorrecaoDoJogador');
    expect(report).toContain('app/js/ui/vision.ts');
  });
});

describe('[Interface] the CI hands over an address and something reads it', () => {
  /**
   * ⚠️ THIS GATE EXISTS BECAUSE THE GAP IT WATCHES WAS OPEN FOR WEEKS AND NOTHING SAID SO. The
   * reusable workflow builds the game, serves `dist/` on a port and passes the address as
   * `AXE_URL`; this repository's `test:a11y` simply did not read it, and a CI input nobody reads
   * is an input that looks like coverage.
   *
   * A script dropped from a package script fails nothing — that is exactly how it would go back to
   * being unread — so the wiring is asserted rather than trusted.
   */
  const SCRIPTS = (JSON.parse(read('package.json')) as {
    scripts: Record<string, string>;
  }).scripts;

  it('runs the built-bundle audit as part of test:a11y', () => {
    expect(SCRIPTS['test:a11y'], 'the AXE_URL audit is no longer wired in').toContain('axe-url.mjs');
  });

  it('the script it names is really there', () => {
    // The same shape as the citation check above, and for the same reason: `style.css` once named
    // a test file that had never been written, and nothing noticed for several commits.
    expect(() => read('tests', 'axe-url.mjs')).not.toThrow();
  });

  it('reads the variable the workflow actually passes', () => {
    // ⚠️ A script that audited a hardcoded localhost would pass this file's other two tests and
    // audit nothing the CI built.
    expect(read('tests', 'axe-url.mjs')).toContain('process.env.AXE_URL');
  });

  it('says so when the address is absent, instead of passing quietly', () => {
    const src = read('tests', 'axe-url.mjs');
    expect(src).toContain('AXE_URL is not set');
  });
});

describe('[Right] the dated record says it is dated, above the fold', () => {
  /**
   * ⚠️ ADR-0083 MEASURES A WORLD THAT IS GONE: a `file:../` dependency, a symlink into a sibling
   * tree, and three repositories under their old names. Every one of those changed, and all three
   * changed in the direction the record asked for — which is what makes it a successful record and
   * not a wrong one.
   *
   * ADR-0057 says a dated record is SUPERSEDED, never amended: editing the measurement would erase
   * the evidence the decision rested on and leave the decision with no visible reason. So the fix
   * is the same one spike 0 already carries — say at the TOP what no longer holds, for the reader
   * who stops after the first screen.
   */
  const ADR = read('docs', 'ADR-0083-conformidade-medida.md');

  it('carries the notice in the first screenful, not buried at the end', () => {
    expect(ADR.slice(0, 1400)).toMatch(/JÁ NÃO É O ESTADO DE HOJE/);
  });

  it('still contains the measurement it was written to preserve', () => {
    // ⚠️ THE OTHER HALF, and the one a well-meaning tidy-up would break: a notice that arrived
    // together with a rewritten table would be an amendment wearing a supersession's clothes.
    /**
     * ⚠️ IN THE TABLE ROW, NOT ANYWHERE. This asked `toContain` and a mutation walked through it:
     * the supersession notice added at the top of that document ALSO names the old repository,
     * so tidying the measurement out of the table left the string present and the gate green.
     * A gate that asks «does this appear somewhere» is defeated by adding it somewhere else.
     */
    const rows = ADR.split('\n').filter((l) => l.startsWith('|'));
    expect(
      rows.some((l) => l.includes('SP-the-inclusionist-whackwhack')),
      'the old names are the measurement; they are not a typo to fix',
    ).toBe(true);
    expect(ADR).toContain('file:../SP-the-inclusionist-tracer');
  });

  it('points at the record that replaced it', () => {
    expect(ADR).toContain('engine-8-consumer-gaps.md');
    expect(() => read('docs', 'engine-8-consumer-gaps.md')).not.toThrow();
  });
});

describe('[Right] the conformance statement says what the code measures', () => {
  /**
   * ⚠️ A CONFORMANCE PAGE IS THE DOCUMENT MOST WORTH DISTRUSTING, because it is the one nobody
   * re-reads and the one a reader takes at face value. Every number in it is read off the code or
   * off a browser; these assertions are what keep it that way after a colour moves.
   *
   * 📌 The plan asked for exactly this and called it "a11y honesto": mark where it only reaches AA,
   * never sell AAA in bulk. So the checks below are as interested in the NOT-met section as in the
   * met one — a page that quietly lost its failures would pass a laxer gate.
   */
  const CONF = read('docs', 'CONFORMANCE.md');
  const PALETTE = read('app', 'js', 'render', 'palette.ts');

  it('quotes contrast figures that palette.ts actually measured', () => {
    // The two floors and the two digit readings. A colour that moves changes these in `palette.ts`
    // and this assertion is what forces the page to move with it.
    for (const figure of ['3.38', '3.10', '10.53', '19.37']) {
      expect(CONF, `the page cites ${figure}`).toContain(figure);
      expect(PALETTE, `palette.ts no longer measures ${figure}`).toContain(figure);
    }
  });

  it('states the timing ring the rules actually offer', () => {
    // ⚠️ SC 2.2.1 is met by a range of at least ten times the default. If `PACES` is ever trimmed,
    // the claim on this page becomes false — so the page names every step and this reads them back.
    const paces = /export const PACES: readonly Pace\[\] = \[([^\]]+)\]/
      .exec(read('app', 'js', 'rules', 'difficulty.ts'));
    expect(paces, 'PACES is gone; re-read the rules before trusting this page').toBeTruthy();
    for (const step of paces![1].split(',').map((v) => v.trim())) {
      expect(CONF, `the page does not mention the ×${step} step`).toContain(`×${step}`);
    }
  });

  it('still admits the three things this game does NOT do', () => {
    /**
     * ⚠️ THE HALF THAT ROTS UPWARDS. A conformance page drifts by losing failures, never by
     * inventing them, and each of these is a real gap with a real owner:
     * target size at AAA, high contrast unreachable, and the column that scrolls at 800×600.
     */
    expect(CONF, 'the AAA target-size miss is gone from the page').toMatch(/2\.5\.5/);
    expect(CONF, 'the unreachable high contrast is gone from the page')
      .toMatch(/High contrast is not reachable/);
    // ⚠️ The multiplication sign, not an ASCII x — which is what the page writes and what this
    // assertion got wrong first time. A gate that matches a character the document never uses
    // fails for its own reason and teaches nothing about the document.
    expect(CONF, 'the small-screen overflow is gone from the page').toMatch(/800.600/);
  });

  it('says that no screen-reader user has tested it', () => {
    // The single most important line on the page, and the easiest to delete once it stops being
    // comfortable. A document that listed only what passed would read as though somebody had.
    expect(CONF).toMatch(/No screen-reader user has tested this game/);
  });

  it('points at gates that exist', () => {
    for (const cited of ['tests/a11y.browser.test.ts', 'tests/axe-url.mjs', 'tests/mutation-check.sh']) {
      expect(CONF, `${cited} is cited`).toContain(cited);
      expect(() => read(cited)).not.toThrow();
    }
  });
});

describe('[Right] the architecture map describes the tree that exists', () => {
  /**
   * ⚠️ THE NUMBERS IN A MAP ARE WHAT AGE FIRST, and two of the three in this one were wrong within
   * an hour of being written — counted by eye instead of by `find`. A stale count is worse than no
   * count: a reader trusts it precisely where it is least examined.
   */
  const ARCH = read('docs', 'ARCHITECTURE.md');

  const WORDS: Record<number, string> = {
    30: 'Thirty', 31: 'Thirty-one', 32: 'Thirty-two', 33: 'Thirty-three',
    34: 'Thirty-four', 35: 'Thirty-five', 36: 'Thirty-six', 37: 'Thirty-seven',
  };

  /** Every `.ts` under a directory that is a MODULE — an ambient declaration is not one. */
  function modules(...dir: string[]): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(ROOT, ...dir), { withFileTypes: true })) {
      if (entry.isDirectory()) out.push(...modules(...dir, entry.name));
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        out.push([...dir, entry.name].join('/'));
      }
    }
    return out;
  }

  it('counts the modules the tree actually holds', () => {
    const n = modules('app', 'js').length;
    expect(WORDS[n], `no spelling for ${n} modules — widen the table above`).toBeTruthy();
    expect(ARCH, `the tree holds ${n} modules`).toContain(`${WORDS[n]} modules`);
  });

  it('counts the rules layer, which is the boundary the whole map is about', () => {
    expect(modules('app', 'js', 'rules').length, 'rules/ changed size; the map says seven').toBe(7);
    expect(ARCH).toMatch(/Seven\s+modules/);
  });

  it('lists every engine path the game imports, and leaves none out', () => {
    /**
     * ⚠️ AN IMPORT THAT NEVER REACHED THE TABLE would make this game depend on more of the engine
     * than its own map admits — which is how a dependency surface grows without anyone deciding it
     * should. The table is the place that decision gets made visible.
     */
    const paths = new Set(
      modules('app', 'js')
        .flatMap((f) => [...read(...f.split('/')).matchAll(/from '(@the-inclusionist[^']*)'/g)])
        .map((m) => m[1]),
    );
    expect(paths.size, 'no engine import found at all — this check is empty').toBeGreaterThan(5);
    for (const path of paths) {
      const short = path.replace('@the-inclusionist/engine/', '');
      expect(ARCH, `${path} is imported and the map does not list it`).toContain(short);
    }
  });

  it('names the documents it defers to, and they are all there', () => {
    // The map's whole claim is that it does not repeat the others. A pointer to a document nobody
    // wrote is a defect this repository has already paid for once.
    for (const doc of [
      'GAME-RULES.md', 'CONFORMANCE.md', 'engine-8-consumer-gaps.md',
      'spike-0-symbol-legibility.md',
    ]) {
      expect(ARCH, `${doc} is cited`).toContain(doc);
      expect(() => read('docs', doc)).not.toThrow();
    }
  });

  it('states the source resolution the code actually uses', () => {
    expect(read('app', 'js', 'render', 'resolution.ts')).toContain('SOURCE_MULTIPLE = 2');
    expect(ARCH).toContain('640×360');
    expect(ARCH).toContain('SOURCE_MULTIPLE = 2');
  });
});

describe('[Interface] the palette search measures the game that ships', () => {
  /**
   * ⚠️ IT DID NOT, FOR MONTHS. `tests/palette-search.cjs` is kept, in its own words, "so the next
   * person can re-run it instead of trusting the table" — and it carried `#0B0F14` and `#F2D479`,
   * an EARLIER palette, from before the purple ground. Re-running it would have measured a game
   * that no longer exists, which is the same defect as a mutation anchor matching nothing: a tool
   * nobody re-runs cannot tell you it has gone stale.
   *
   * It reads `render/palette.ts` now. This is what stops somebody typing the colours back in.
   */
  const SEARCH = read('tests', 'palette-search.cjs');
  const PALETTE = read('app', 'js', 'render', 'palette.ts');

  it('reads the three colours rather than repeating them', () => {
    for (const name of ['INK', 'TILE_LIT', 'GROUND']) {
      expect(SEARCH, `${name} is no longer read from the palette`).toContain(`fromPalette('${name}')`);
    }
  });

  it('finds them where it looks, so the read is not a broken regex', () => {
    // ⚠️ The tool throws on a miss rather than falling back, but a throw nobody runs is a throw
    // nobody sees. This is the same check, in the suite that does run.
    for (const name of ['INK', 'TILE_LIT', 'GROUND']) {
      expect(PALETTE, `palette.ts no longer exports ${name} as a hex literal`)
        .toMatch(new RegExp(`export const ${name} = '#[0-9A-Fa-f]{6}'`));
    }
  });

  it('states what the contrast ceiling makes impossible', () => {
    /**
     * 📏 The two steps of the mat — ground→unlit and unlit→lit — MULTIPLY to the whole climb,
     * because the middle luminance cancels. The climb is capped at 21 (white on black), so both
     * steps clearing 7 would need 49 and cannot happen for any palette, in any hue. It is the
     * finding that turns "high contrast is a colour decision" into a measured constraint, and it
     * belongs beside the search rather than in a chat nobody keeps.
     */
    expect(SEARCH).toContain('IMPOSSIBLE for any palette');
    expect(SEARCH).toMatch(/hc7/);
  });
});

describe('[Interface] the standalone chain from page to game is unbroken', () => {
  /**
   * ⚠️ A MUTATION ESCAPED AND THIS IS WHY IT EXISTS. Commenting out the `boot()` call in
   * `boot/standalone.ts` broke nothing: the suite reaches the game by importing `boot/main.ts` and
   * calling the function itself, so the SHELL — the thing the shipped page actually loads — is
   * exercised by nobody. The standalone build could stop starting and every test would stay green.
   *
   * 📌 It is a source check and says so. The strong version is `tests/axe-url.mjs`, which drives the
   * BUILT page and would find a dead shell immediately — but only when `AXE_URL` is set, which is
   * CI and not a developer's `npm test`. This covers the same chain in the run that always happens.
   */
  it('the shipped page loads the shell, not the game', () => {
    // ⚠️ Loading `main.ts` here would boot on import again by the back door, which is the thing
    // ADR-0139 §2 forbids — and it would look like a working page while doing it.
    const html = read('app', 'index.html');
    expect(html).toContain('boot/standalone.ts');
    expect(html, 'index.html loads the game directly, bypassing the shell')
      .not.toMatch(/src="[^"]*boot\/main\.ts"/);
  });

  it('the shell calls the game', () => {
    /**
     * ⚠️ THE COMMENTS ARE STRIPPED FIRST, and the first version of this did not do it — it asked
     * for a line that was exactly `boot();`, which was true for about an hour and then stopped
     * being true the moment the shell started keeping what `boot()` returns. A gate that pins the
     * SPELLING of a call instead of the fact of it fails on the next honest edit, and the fix for
     * that kind of failure is usually to weaken the gate.
     *
     * Stripping comments is what keeps it strict: a commented-out call is not a call.
     */
    const shell = code(read('app', 'js', 'boot', 'standalone.ts'));
    // ⚠️ ANY ARGUMENTS. The first version demanded empty parentheses and broke the hour the
    // shell started passing the engine in — a gate that pins a call's SPELLING fails on the
    // next honest edit, and the usual repair for that is to weaken it.
    expect(/\bboot\s*\(/.test(shell),
      'boot/standalone.ts no longer calls boot()').toBe(true);
  });

  it('the shell runs the loop, and says so when a frame throws', () => {
    /**
     * ⚠️ SPEC D16: «one broken game must stay distinguishable from a broken engine». A frame that
     * throws stops the loop, which is right — what must not happen is it stopping in SILENCE,
     * because a blind child cannot see a frozen screen. ADR-0139 §3 puts `aoFalhar` in the shell.
     *
     * 📏 A mutation that deleted the announcement ESCAPED, and finding out why is what exposed the
     * contamination fixed alongside this: the anchor checker was failing on every applied mutation
     * and the harness was reading that as «caught». With that silenced, this one had nothing
     * holding it — the shell is loaded by the shipped page and by no test.
     *
     * A source check, for the same reason as the two above: importing the shell in a test would boot
     * a second game into the same document.
     */
    const shell = code(read('app', 'js', 'boot', 'standalone.ts'));
    expect(shell, 'the shell no longer runs a loop').toMatch(/\bstartLoop\s*\(/);
    expect(shell, 'nothing is wired to aoFalhar').toMatch(/aoFalhar\s*:/);
    expect(shell, 'a frame that throws would now stop the game in silence')
      .toMatch(/srAlert\s*\(/);
  });

  it('the game exports it rather than running it', () => {
    const main = code(read('app', 'js', 'boot', 'main.ts'));
    expect(main, 'boot is no longer exported').toMatch(/export function boot\s*\(/);
    // ⚠️ A call at the START of a line, which is what module scope looks like. `= boot()` inside
    // the shell is a different thing and this must not confuse the two.
    expect(/^\s*boot\s*\(\)/m.test(main),
      'boot/main.ts calls boot() at module scope again — ADR-0139 §2 and spec D14').toBe(false);
  });
});
