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
