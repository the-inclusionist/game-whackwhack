// SPDX-License-Identifier: AGPL-3.0-or-later
// The rules layer stays pure. This is a structural gate, in the spirit of the engine's own
// tests/engine-boundary.node.test.js.
//
// It is not tidiness. `rules/` is where a category, a timing curve and a defeat mode live, and the
// question that decides whether adding "consonants versus vowels" later is a data change or
// surgery is exactly this one: can the rules be exercised without a canvas? The moment a rules
// module imports the renderer, every test of them needs a browser, the suite goes from
// milliseconds to seconds, and the pressure to test them at all quietly drops.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RULES_DIR = join(import.meta.dirname, '..', 'app', 'js', 'rules');

function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourcesUnder(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const FILES = sourcesUnder(RULES_DIR);

/**
 * Every module specifier this file imports from, type-only imports included.
 *
 * ⚠️ NOT ANCHORED TO THE START OF A LINE, and it was. `(?:^|\n)\s*import` finds the FIRST import
 * on a line and no other, so `import a from 'x'; import { TILE } from '../render/resolution.ts'`
 * — one line, two imports — was invisible to every assertion below. Two mutations escaped through
 * exactly that hole, one in `rules/spawn.ts` and one in `rules/category.ts`, and both of them are
 * the specific thing this file exists to forbid.
 *
 * Comments are stripped first, because an unanchored pattern would otherwise find the example
 * import in a doc comment and fail on it — which is a false positive, but a confusing one.
 */
function importsOf(source: string): string[] {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const out: string[] = [];
  for (const m of code.matchAll(/\b(?:import|export)\s[^;\n]*?from\s*['"]([^'"]+)['"]/g)) {
    out.push(m[1]);
  }
  for (const m of code.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  return out;
}

describe('[Interface] the rules layer has no idea a screen exists', () => {
  it('finds the modules it is meant to be guarding', () => {
    // A gate that silently guards an empty list is worse than no gate: it reports success.
    expect(FILES.length).toBeGreaterThanOrEqual(4);
  });

  it('imports nothing from render, ui, boot or declaration', () => {
    for (const file of FILES) {
      const where = relative(RULES_DIR, file);
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        expect(spec, `${where} imports ${spec}`).not.toMatch(/(^|\/)(render|ui|boot|declaration)\//);
      }
    }
  });

  it('imports neither the engine, PixiJS nor Zdog', () => {
    // The engine is a fine dependency for the declaration and the composition root. Here it would
    // mean the rules could not run in the node project, which is the whole point of the layer.
    for (const file of FILES) {
      const where = relative(RULES_DIR, file);
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        expect(spec, `${where} imports ${spec}`)
          .not.toMatch(/^(@the-inclusionist\/engine|pixi\.js|zdog)/);
      }
    }
  });

  it('only ever imports its own siblings', () => {
    for (const file of FILES) {
      const where = relative(RULES_DIR, file);
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        expect(spec, `${where} imports ${spec}`).toMatch(/^\.\.?\//);
      }
    }
  });

  it('names no browser global', () => {
    // `document`, `window` and friends do not exist in the node project, so this would be caught
    // by any test that ran the code — but only along whichever branch that test happened to take.
    for (const file of FILES) {
      const where = relative(RULES_DIR, file);
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments, sparing the // in a URL
      expect(code, `${where}`).not.toMatch(/\b(document|window|navigator|localStorage|HTMLElement)\b/);
    }
  });
});
