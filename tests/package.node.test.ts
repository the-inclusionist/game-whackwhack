// SPDX-License-Identifier: AGPL-3.0-or-later
// The package a platform installs — plan items F4 and F5, and step 3 of ADR-0068 §6's six.
//
// ========================= WHY THE MANIFEST NEEDS GATES AT ALL =========================
// ⚠️ EVERYTHING HERE FAILS AT SOMEBODY ELSE'S `npm install`, AND NOWHERE ELSE. An `exports` entry
// naming a path the build does not produce, a `files` list that forgot the bundle, a dependency in
// the wrong section — every one of those leaves this repository perfectly green and breaks the
// first consumer. The manifest is the one file whose defects are invisible from inside.
//
// 📌 THE STRONGEST CHECK IS `npm pack --dry-run`, AND IT IS IN THE CI RATHER THAN HERE, because it
// needs the build to have run. This file covers what can be checked from the manifest alone, which
// is the part that always runs.
//
// ========================= WHY BOTH SECTIONS DECLARE THE ENGINE =========================
// `peerDependencies` says «the consumer brings this one»: a platform with six cartridges installs
// ONE engine, and two engines in one page is a bug rather than a fallback. But `peerDependencies`
// installs NOTHING, so a clean clone of this repository could not compile — hence the same two in
// `devDependencies`. It looks like redundancy and it is two different statements.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), 'utf8');

interface Manifest {
  name: string;
  private?: boolean;
  exports?: Record<string, unknown>;
  files?: string[];
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
}
const PKG = JSON.parse(read('package.json')) as Manifest;
const SHARED = ['@the-inclusionist/engine', 'zdog'] as const;

describe('[Interface] the package can be installed by somebody else', () => {
  it('is not private, which is what step 3 of the six means', () => {
    // ⚠️ ADR-0068 §6 counts «published» as one of six steps a game takes end to end, and
    // `private: true` is a one-word refusal of it. It was correct while nothing consumed this.
    expect(PKG.private, 'private: true — npm will refuse to publish this').toBeUndefined();
  });

  it('names an entry point, a stylesheet, and its own manifest', () => {
    /**
     * 📌 `./style.css` IS SHIPPED AS SOURCE AND NOT AS A BUNDLE, deliberately. Its first line is
     * `@import '@the-inclusionist/engine/style.css' layer(engine)`, and leaving that a BARE
     * specifier is what makes a platform resolve one copy of the engine's sheet however many
     * cartridges ask for it. Bundling the CSS would inline a copy per game — the exact thing
     * ADR-0117 refuses about fonts, one layer up.
     */
    const exp = PKG.exports as Record<string, Record<string, string> | string>;
    expect(exp, 'no exports map: node cannot resolve anything in this package').toBeDefined();
    expect(exp['.']).toMatchObject({
      types: './dist-lib/types/index.d.ts',
      default: './dist-lib/index.js',
    });
    expect(exp['./style.css'], 'the game ships no stylesheet').toBe('./app/css/style.css');
  });

  it('the build produces every path the exports map promises', () => {
    /**
     * ⚠️ THE HALF THAT ROTS. An `exports` entry is a promise about a file, and nothing in a normal
     * test run opens it — the path can be wrong for weeks and only a consumer finds out. This does
     * not open the files either (they are gitignored build output); it holds the two statements to
     * each other, which is the part that can be checked without a build.
     */
    const exp = PKG.exports as Record<string, Record<string, string> | string>;
    const promised = Object.values(exp)
      .flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v)))
      .map((p) => p.replace(/^\.\//, ''));
    const shipped = PKG.files ?? [];
    for (const path of promised) {
      if (path === 'package.json') continue;
      expect(
        shipped.some((f) => path === f || path.startsWith(`${f}/`)),
        `exports promises ${path}, and files does not ship it`,
      ).toBe(true);
    }
  });

  it('the lib target is a script, and the pack hook builds it', () => {
    // ⚠️ WITHOUT `prepack` THE TARBALL IS EMPTY OF EVERYTHING THAT MATTERS: `dist-lib` is build
    // output and gitignored, so a publish from a clean clone would ship a manifest pointing at
    // nothing. The hook is what makes `files: ['dist-lib']` true at the moment it is read.
    expect(PKG.scripts['build:lib'], 'there is no lib target to build').toBeDefined();
    expect(PKG.scripts['build:lib']).toContain('tsc -p tsconfig.pkg.json');
    expect(PKG.scripts.prepack, 'nothing builds the lib before it is packed').toContain('build:lib');
  });

  it.each(SHARED)('%s is declared twice, and the two mean different things', (name) => {
    expect(
      PKG.peerDependencies?.[name],
      `${name} is not a peer: a platform would install one copy per cartridge`,
    ).toBeDefined();
    expect(
      PKG.devDependencies[name],
      `${name} is not a devDependency: a clean clone of this repository cannot compile`,
    ).toBeDefined();
    expect(
      PKG.dependencies?.[name],
      `${name} is still a plain dependency, which ships a second copy into every consumer`,
    ).toBeUndefined();
    // The two must not drift: a peer range that excludes what this tree compiles against is a
    // package that tests one engine and asks the consumer for another.
    expect(PKG.peerDependencies?.[name], `the peer and dev ranges for ${name} disagree`)
      .toBe(PKG.devDependencies[name]);
  });

  it('ships no font, no art and no runtime — ADR-0117', () => {
    /**
     * ⚠️ «A CARTRIDGE DECLARES NO DELIVERY — no font file, no voice, no runtime in a game's own
     * package or `dist`». This game HAS three woff2 in its app build, and correctly: the standalone
     * page is a real page. What must not happen is those travelling in the package, because the
     * platform delivers them once (ADR-0119) and six copies is the whole defect.
     *
     * 📌 Checked on `files` rather than on the tarball, because this is the run that always
     * happens; the tarball is walked by `npm pack --dry-run` in CI.
     */
    const forbidden = /woff|\.ttf|\.otf|assets\/|public\//i;
    const offenders = (PKG.files ?? []).filter((f) => forbidden.test(f));
    expect(offenders, 'the package ships delivery a platform already makes').toEqual([]);
  });

  it('the two build targets differ in the one way that matters', () => {
    /**
     * ⚠️ EXTERNAL IS THE WHOLE POINT OF THE LIB TARGET. Bundling the engine into it would put one
     * copy per cartridge into a platform that already ships it — and a bundler would report that
     * weight as this game's, six times over, with nothing saying where it came from.
     *
     * 📏 A regex prefix and not the bare name, and the difference is nine imports: this game reaches
     * `@the-inclusionist/engine` plus eight deep paths under it. Listing the root alone would
     * externalise one and bundle the other eight in silence.
     */
    const config = read('vite.config.ts');
    expect(config, 'the lib target has no external list').toMatch(/external:\s*\[/);
    expect(config, 'only the engine root is external; the deep paths would be bundled')
      .toContain('/^@the-inclusionist\\/engine/');
    expect(config, 'zdog would be bundled into the cartridge').toMatch(/'zdog'/);
  });

  it('the lib entry hands over the dictionaries, and the slug (F7, ADR-0082 §1)', () => {
    /**
     * ⚠️ NOTHING IN THIS REPOSITORY IMPORTS `app/js/index.ts`, which is exactly why it needs a gate.
     * It exists for a consumer that does not exist yet, so an export could be deleted and every
     * test, every build and the whole standalone page would stay green — the failure would arrive
     * as a platform's compile error, weeks later, in somebody else's repository.
     *
     * 📌 THE DICTIONARIES ARE THE POINT OF F7. A platform registers a cartridge's words into
     * whatever catalogue it keeps, and it can only do that if the raw objects travel. `createI18n`
     * travels beside them so a shell may instead take the whole instance — «either of the two», as
     * the plan puts it, and the choice is the shell's rather than this game's.
     *
     * 📏 The names are PARSED rather than pattern-matched. The first version used a regex over the
     * whole file and matched `pt` inside the word «puts» in the prose above — a gate that reads a
     * comment is a gate that passes for the wrong reason, which this file has already been bitten
     * by once today.
     */
    const entry = read('app', 'js', 'index.ts');
    const exported = new Set<string>();
    for (const block of entry.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const part of block[1]!.split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim();
        if (name) exported.add(name);
      }
    }
    for (const decl of entry.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g)) {
      exported.add(decl[1]!);
    }

    for (const name of ['pt', 'en', 'es', 'createI18n', 'boot', 'SLUG', 'createWhackDeclaration']) {
      expect([...exported], `the lib entry no longer exports ${name}`).toContain(name);
    }

    // ⚠️ AND THE SLUG HAS TO BE THE PACKAGE'S OWN NAME (ADR-0082 §1): repository, package and slug
    // are one string, because a manifest picks a cartridge by it and two spellings are two games.
    const slug = /SLUG\s*=\s*'([^']+)'/.exec(entry)?.[1];
    expect(slug, 'the slug and the package name disagree').toBe(PKG.name.split('/')[1]);
  });

  it('the standalone build is a PWA, and the cartridge is not (ADR-0140)', () => {
    /**
     * ⚠️ TWO STATEMENTS, AND THE SECOND IS THE ONE THAT WOULD GO WRONG QUIETLY. ADR-0117 wrote «A
     * GAME IS A CARTRIDGE, NOT A PWA»; ADR-0140 supersedes exactly that clause and nothing else,
     * because a standalone build that exists for whoever works on this repository is not a unit of
     * installation for anybody — while a standalone build DEPLOYED FOR CHILDREN would be, and every
     * word of ADR-0117 would apply to it again.
     *
     * 📌 So the app target gets a service worker and the LIB TARGET MUST NOT. A cartridge that
     * installed one would be claiming an origin that belongs to the platform, and nothing in a
     * platform's build would say where the second service worker came from.
     */
    const config = read('vite.config.ts');
    expect(config, 'the standalone build is no longer a PWA').toContain('VitePWA(');
    expect(config, 'the service worker is not switched off for the cartridge')
      .toMatch(/const PWA = LIB \? \[\]/);
  });

  it('declares the four manifest fields whose defaults are wrong here', () => {
    /**
     * ⚠️ ABSENCE IS NOT SILENCE — the plugin fills what a manifest omits, and 📏 the platformer
     * measured what with: `"lang":"en"` and `"scope":"/"`. Both are wrong for this game and the
     * second is wrong for every game.
     *
     *   `lang`       assistive technology reads it to pick a voice. With `en` a screen reader says
     *                «Colete: números pares» with English phonemes to a child learning to read.
     *   `scope`      `/` claims the WHOLE ORIGIN, which under ADR-0117 belongs to the platform.
     *   `start_url`  the plugin left it at `/` even with a relative scope — measured in the
     *                generated manifest, and the pair pointing two different ways is worse than
     *                either alone.
     *   `id`         without it the identity IS the `start_url`, so changing that one day puts a
     *                second installation beside the one a child already had, with her scores on
     *                the other side of it.
     */
    const config = read('vite.config.ts');
    expect(config, 'lang is left to the plugin, which writes en').toMatch(/lang: 'pt-BR'/);
    expect(config, 'scope is left to the plugin, which claims the origin').toMatch(/scope: '\.\/'/);
    expect(config, 'start_url is left to the plugin, which points at the origin root')
      .toMatch(/start_url: '\.\/'/);
    expect(config, 'the application has no stable identity').toMatch(/id: '\.\/'/);
  });

  it('paints the install screen in the colour the palette was measured against', () => {
    /**
     * 📏 THE GROUND, AND NOT A COLOUR CHOSEN HERE. `render/palette.ts` measured every contrast in
     * this game against `--ground`; the browser paints `background_color` behind the game while it
     * loads, so any other value is a flash of a colour this game does not contain.
     *
     * ⚠️ HELD TO THE STYLESHEET RATHER THAN TO A LITERAL, because two hand-copied hex strings agree
     * only until somebody edits one — and the one that would be edited is the CSS.
     */
    const ground = /--ground:\s*(#[0-9A-Fa-f]{6})/.exec(read('app', 'css', 'style.css'))?.[1];
    expect(ground, 'the stylesheet no longer names a ground colour').toBeTruthy();
    const config = read('vite.config.ts');
    expect(config, 'the install screen flashes a colour this game does not use')
      .toContain(`background_color: '${ground}'`);
    expect(config).toContain(`theme_color: '${ground}'`);
  });

  it('the CI builds the target the reusable workflow does not', () => {
    /**
     * 📏 MEASURED IN THE ENGINE'S `game-ci.yml`: it runs `npm ci`, `npm run typecheck`, `npm test`
     * and `npm run build` — and `build` is the APP target. The lib target would never be built by
     * any runner, and ADR-0140's whole claim is that both come from one tree.
     *
     * 📌 The job's eventual home is that reusable workflow, so six games inherit the gate rather
     * than five copying it. Adding an input there is the engine repository's call.
     */
    const ci = read('.github', 'workflows', 'ci.yml');
    expect(ci, 'no job builds the lib target').toContain('npm run build:lib');
    expect(ci, 'nothing proves the package is packable').toContain('npm pack --dry-run');
  });
});
