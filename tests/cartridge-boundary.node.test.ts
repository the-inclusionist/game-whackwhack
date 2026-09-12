// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0139's second gate: `grep createGame` in a cartridge's source returns nothing.
//
// ========================= WHY THE RULE IS ABOUT THE CALLER, NOT THE BYTES =========================
// ⚠️ `createGame` MOUNTS THE PAGE, not the game. The accessibility bar, the pause card, the six
// colour-vision filters, the TTS, the sonar, the settings panel, the menu navigation and the
// keyboard runtime all come out of one call — so six cartridges each making that call inside one
// platform would deduplicate the BYTES (a bundler sees one module) and MULTIPLY THE RUNTIME: six
// accessibility bars, six TTS instances, six keyboard runtimes competing for one document.
//
// 📌 WHICH IS WHY THE FAILURE IS INVISIBLE TO EVERY OTHER TEST HERE. A standalone build calls it
// once and behaves perfectly; the defect only exists where a second cartridge does. This gate and
// `tests/rng-boundary.node.test.ts` are the same shape for the same reason, and ADR-0141 says it in
// as many words about its own: «the lint is load-bearing, not decorative».
//
// ========================= THE SAME RULE COVERS THE LOOP =========================
// ADR-0139 §3 puts `startLoop` on the shell's side of the same line: «six cartridges each opening
// their own frame callback is six loops competing for one frame». It is one boundary with two
// names, so it is one gate — a repository that splits them ends up with one of the two enforced.
//
// ========================= WHERE THIS EVENTUALLY LIVES =========================
// Not here. ADR-0068 §4 has a reusable workflow the six games already call, and a gate that six
// repositories INHERIT is worth more than a gate five of them copy. Until that exists, it lives in
// the repository the record named as the first cartridge.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(import.meta.dirname, '..', 'app', 'js');

/**
 * THE ONE FILE ON THE OTHER SIDE OF THE LINE.
 *
 * ⚠️ It is named, not pattern-matched, and that is the decision: a rule like «anything called
 * `standalone`» would let the next shell-shaped file in by having the right name, and the whole
 * point is that there is exactly ONE caller. ADR-0140 §2: the shell is what is allowed to differ
 * between the standalone page and the platform, and the game between them is the same file.
 */
const SHELL = 'boot/standalone.ts';

/** What only a shell may call. Both come from ADR-0139 — §2 for the first, §3 for the second. */
const HOST_ONLY = ['createGame', 'startLoop'] as const;

function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourcesUnder(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/**
 * Strips comments, and this file needs it more than most: `boot/main.ts` says the word `createGame`
 * eleven times explaining why it does not call it. A gate that could not tell an explanation from a
 * call would punish the file for documenting the rule it obeys.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const FILES = sourcesUnder(APP).map((full) => ({
  name: relative(APP, full).replace(/\\/g, '/'),
  source: code(readFileSync(full, 'utf8')),
}));

const CARTRIDGE = FILES.filter((f) => f.name !== SHELL);

describe('[Interface] ADR-0139 gate 2 — the cartridge never calls the host', () => {
  it('has a tree to judge, and a shell that is inside it', () => {
    /**
     * ⚠️ THE VACUITY GUARD, AND IT IS TWO GUARDS. A walker that found nothing would report every
     * file clean, instantly, and look exactly like a pass — that is the first. The second is
     * subtler and is the one that would really have happened: `SHELL` is a hard-coded path, and a
     * rename would silently move the shell into the set being judged, whereupon this whole file
     * fails loudly rather than passing quietly. Asserting the path resolves keeps the failure
     * honest instead of mysterious.
     */
    expect(FILES.length, 'the walker found no modules to judge').toBeGreaterThan(25);
    expect(
      FILES.some((f) => f.name === SHELL),
      `the shell is not at ${SHELL} any more; this gate is judging it as a cartridge`,
    ).toBe(true);
    expect(CARTRIDGE.length).toBe(FILES.length - 1);
  });

  it.each(HOST_ONLY)('the shell is the only caller of %s', (name) => {
    /**
     * ⚠️ THE OTHER HALF OF THE VACUITY GUARD, and it is the one that matters. Every negative rule
     * below is satisfied by a repository that lost the call ENTIRELY — a standalone page that never
     * calls `createGame` mounts no accessibility bar at all, and this file would applaud it.
     */
    const shell = FILES.find((f) => f.name === SHELL)!.source;
    expect(
      new RegExp(`\\b${name}\\s*\\(`).test(shell),
      `${SHELL} does not call ${name}: the page is not being mounted by anybody`,
    ).toBe(true);
  });

  it.each(HOST_ONLY)('no cartridge module calls %s', (name) => {
    // A call, not a mention: `\b<name>\s*\(` after comments are gone. An import of the symbol
    // without a call is caught by the next case, which is a different failure with a different fix.
    const callers = CARTRIDGE
      .filter((f) => new RegExp(`\\b${name}\\s*\\(`).test(f.source))
      .map((f) => f.name);
    expect(
      callers,
      `${name} is the host's to call (ADR-0139). Six cartridges calling it is six of everything it mounts`,
    ).toEqual([]);
  });

  it.each(HOST_ONLY)('no cartridge module even imports %s', (name) => {
    /**
     * 📌 STRICTER THAN THE GATE ASKS, ON PURPOSE. An import with no call is dead weight today and a
     * call tomorrow, and it is the state this file would find hardest to explain: the boundary held
     * by nothing but nobody having got round to using what they imported.
     *
     * ⚠️ And it closes a real hole in the case above: `const f = createGame; f(opts)` calls it
     * without ever matching `createGame\\s*\\(`. Reaching the symbol at all is the thing to refuse.
     */
    const importers = CARTRIDGE
      .filter((f) => new RegExp(`import[^;]*\\b${name}\\b[^;]*from`, 's').test(f.source))
      .map((f) => f.name);
    expect(importers, `${name} is imported where it may not be called`).toEqual([]);
  });

  it('refuses a namespace import of the engine, which would reach both by property', () => {
    /**
     * ⚠️ THE DOOR ROUND THE BACK, and `tests/rng-boundary.node.test.ts` refuses the same one for the
     * same reason: `import * as engine from '@the-inclusionist/engine'` satisfies every rule above
     * and then writes `engine.createGame(...)`. A named-import rule that ignores namespace imports
     * is a rule with a documented bypass.
     */
    const offenders = CARTRIDGE
      .filter((f) => /import\s+\*\s+as\s+\w+\s+from\s+'@the-inclusionist\/engine/.test(f.source))
      .map((f) => f.name);
    expect(offenders, 'a namespace import reaches the host functions by property').toEqual([]);
  });
});
