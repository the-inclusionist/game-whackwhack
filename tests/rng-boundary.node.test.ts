// SPDX-License-Identifier: AGPL-3.0-or-later
// A cartridge owns its random stream. This is the gate ADR-0141 asks for, and it is written here
// because that record says so: «The first is written in `game-whackwhack`, which is the game going
// end to end first per ADR-0068 §6, and which is also the game measured importing `rnd`.»
//
// ========================= WHY A GATE AND NOT A CONVENTION =========================
// `@the-inclusionist/engine/core/rng.js` exports two things that look identical at the import site:
//
//   export const createRng: (semente?: number) => Rng;   // an INDEPENDENT stream
//   const _padrao = createRng(SEMENTE_PADRAO);           // module scope, shared
//   export const rnd, randInt, shuffle, reseed;          // all bound to _padrao
//
// 🔴 THE WRONG IMPORT IS THE SHORTER ONE, and this repository took it: ADR-0141 measured
// `app/js/boot/main.ts:23` as `import { rnd }`. In a standalone build that is harmless — one game,
// one stream — and inside the platform two cartridges draw from the SAME stream, so each one's
// draws depend on how much the other drew and a `reseed` in one repositions the other's underneath.
//
// ⚠️ AND THAT IS EXACTLY WHY THIS FILE HAS TO EXIST. The defect is invisible where the tests run.
// Every test in this repository passes with the wrong import, because a standalone build has one
// stream and cannot collide with itself. The record says it plainly: «the lint is load-bearing, not
// decorative».
//
// ========================= WHY THE RULE IS NEGATIVE =========================
// ADR-0141 §2: saying «use `ctx.rng`» would not be enough. A cartridge that uses its own stream for
// almost everything and reaches for the imported `shuffle` ONCE has the whole defect — the shared
// stream advances and another cartridge's draws move. There is no partial version of this, so the
// forbidden list IS the rule.
//
// 📌 ITS EVENTUAL HOME IS NOT HERE. The record puts the gate «beside the other cross-repository
// gates a game already calls — the same reusable workflow of ADR-0068 §4 — so that six repositories
// inherit it rather than copy it». Until that exists, it lives where the defect was measured.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(import.meta.dirname, '..', 'app', 'js');

function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourcesUnder(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const FILES = sourcesUnder(APP);

/** The four bound to the module-level stream. `createRng` is the correct door and is not here. */
const SHARED = ['rnd', 'randInt', 'shuffle', 'reseed'] as const;

/** Strips comments, so the examples in the prose above are not read as code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

interface RngImport {
  readonly file: string;
  /** The text between the braces, or `*` for a namespace import. */
  readonly clause: string;
}

/**
 * Every import of the engine's rng module, with what it pulled in.
 *
 * ⚠️ NOT ANCHORED TO A LINE START, for the reason the sibling gate records the hard way: two
 * mutations once walked through `import a from 'x'; import { TILE } from '…'` because the pattern
 * only found the first import on a line.
 */
function rngImports(file: string): RngImport[] {
  const text = code(readFileSync(file, 'utf8'));
  const out: RngImport[] = [];
  const spec = String.raw`['"][^'"]*core/rng\.js['"]`;
  for (const m of text.matchAll(new RegExp(String.raw`\bimport\s+([\s\S]*?)\s+from\s*${spec}`, 'g'))) {
    out.push({ file, clause: m[1] });
  }
  return out;
}

const ALL = FILES.flatMap(rngImports);

describe('[Interface] this game draws from its own stream, never the shared one', () => {
  it('finds an rng import to judge, so the sweep is not empty', () => {
    // ⚠️ A gate over zero imports reports success. If this game ever stops importing the module at
    // all, that is a change worth noticing rather than a reason to pass quietly.
    expect(ALL.length, 'no import of core/rng found anywhere — has the module moved?')
      .toBeGreaterThan(0);
    expect(FILES.length).toBeGreaterThan(20);
  });

  it.each(SHARED)('imports no `%s`, because it is bound to the shared stream', (name) => {
    for (const { file, clause } of ALL) {
      const named = new RegExp(String.raw`(^|[{,\s])${name}(\s*,|\s*as\s|\s*\}|\s*$)`);
      expect(
        named.test(clause),
        `${relative(APP, file)} imports \`${name}\` from core/rng — it is bound to the engine's`
          + ` module-level stream, so a second cartridge on the page moves this game's draws.`
          + ` Take the stream from \`createRng\` (or, once the factory exists, from \`ctx.rng\`).`,
      ).toBe(false);
    }
  });

  it('takes no namespace import of the module either', () => {
    /**
     * ⚠️ THE HOLE A NAMED-BINDING CHECK LEAVES OPEN. `import * as rng from '…/core/rng.js'` passes
     * every assertion above and hands the caller all four shared functions through `rng.shuffle`.
     * Forbidding the shape is cheaper than teaching this file to follow a namespace around.
     */
    for (const { file, clause } of ALL) {
      expect(
        clause.includes('*'),
        `${relative(APP, file)} takes a namespace import of core/rng, which reaches the shared`
          + ` stream through a property and past the checks above`,
      ).toBe(false);
    }
  });

  it('does import `createRng`, which is the door that is correct', () => {
    // The positive half. Not redundant with the negatives: a file that imported nothing at all
    // would satisfy every rule above and have no stream, which is a different defect.
    expect(ALL.some(({ clause }) => /\bcreateRng\b/.test(clause)),
      'nothing imports createRng — where does this game get its stream?').toBe(true);
  });
});
