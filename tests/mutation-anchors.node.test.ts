// SPDX-License-Identifier: AGPL-3.0-or-later
// Every mutation in tests/mutation-check.sh still has something to bite.
//
// ========================= WHY THIS FILE EXISTS =========================
// ⚠️ A MUTATION WHOSE ANCHOR NO LONGER MATCHES LOOKS EXACTLY LIKE COVERAGE. The harness reports
// `SKIP (anchor drifted)` and counts it as escaped, which is correct — but only somebody running
// the harness ever sees it, and the harness takes about fifty minutes to run in full because every
// mutation re-transforms the module graph. So the whole set was run in pieces, and a piece nobody
// ran that week hid its own rot.
//
// 📏 MEASURED IN ONE AFTERNOON, 2026-09-11: five anchors rotted across three commits. Two against
// `USED` when the preset gained `start`, three against `tileDeadlineMs` when it gained a second
// parameter. Each was found by chance, because that day's work happened to touch the same file.
//
// This check costs a second and needs no mutation to be applied at all. It cannot tell whether a
// gate BITES — only the harness can, and only by running — but it does tell whether the gate still
// points at anything, which is the failure that actually happens.
//
// ⚠️ AND IT DOES NOT REPLACE THE HARNESS. A green run here means every anchor is live; it says
// nothing about whether the suite would go red. The two answer different questions and the harness
// remains the gate.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

interface Mutation {
  readonly name: string;
  readonly file: string;
  readonly from: string;
}

/**
 * Reads the `add` calls out of the shell script.
 *
 * ⚠️ THE SCRIPT IS THE SOURCE OF TRUTH AND THIS IS A READER, never a second copy. A list of
 * anchors maintained here would drift from the list that runs, which is the exact defect being
 * guarded against, one level up.
 *
 * The shape is fixed and four lines long — `add "name" \`, then file, then from, then to — so it
 * is parsed rather than pattern-matched loosely: a looser regex that skipped an entry would report
 * a clean sweep over fewer mutations than exist.
 */
function mutations(): Mutation[] {
  const lines = read('tests/mutation-check.sh').split('\n');
  const roots = new Map<string, string>();
  const out: Mutation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const assign = /^([A-Z0-9_]+)=(.+)$/.exec(lines[i]);
    if (assign && !lines[i].includes('$')) roots.set(assign[1], assign[2]);

    if (!lines[i].startsWith('add "')) continue;
    const name = unquote(lines[i].slice(4));
    const file = expand(unquote(lines[i + 1]), roots);
    const from = unquote(lines[i + 2]);
    out.push({ name, file, from });
  }
  return out;
}

/**
 * Strips the trailing `\`, the surrounding quotes, and the escapes the script uses.
 *
 * ⚠️ `\$` IS ONE OF THEM, and leaving it out cost two false positives the first time this
 * file ran: the script writes `\${factor}` so the shell does not expand it, and an anchor read
 * without that unescaping matches nothing. A checker that reports rot where there is none gets
 * switched off exactly as fast as one that misses it.
 */
function unquote(line: string): string {
  const trimmed = line.trim().replace(/\s*\\$/, '');
  const inner = trimmed.replace(/^"/, '').replace(/"$/, '');
  return inner
    .replace(/\\"/g, '"')
    .replace(/\\`/g, '`')
    .replace(/\\\$/g, '$');
}

/** `$RULES/round.ts` → `app/js/rules/round.ts`. A root the script never set is left alone. */
function expand(path: string, roots: Map<string, string>): string {
  return path.replace(/^\$([A-Z0-9_]+)\//, (whole, key: string) => {
    const base = roots.get(key);
    return base === undefined ? whole : `${base === '.' ? '' : `${base}/`}`;
  });
}

const ALL = mutations();

describe('[Interface] every mutation still points at something', () => {
  it('finds the whole set, so a clean sweep is not a sweep over nothing', () => {
    // ⚠️ THE VACUITY CHECK FOR THIS FILE. A parser that matched no `add` line would report every
    // anchor live, in a fraction of a second, and look exactly like a pass.
    const declared = read('tests/mutation-check.sh').split('\n')
      .filter((l) => l.startsWith('add "')).length;
    expect(ALL.length, 'the parser lost mutations the script declares').toBe(declared);
    expect(ALL.length).toBeGreaterThan(150);
  });

  // ⚠️ The NAME is in the tuple and unused in the body on purpose: it is what vitest prints as
  // the case title, so a failure says WHICH mutation rotted rather than only which file.
  it.each(ALL.map((m) => [m.name, m.file, m.from] as const))(
    '%s — its anchor is still in %s',
    (_name, file, from) => {
      /**
       * ⚠️ THE HARNESS REPORTS THIS AS `SKIP` AND COUNTS IT AS ESCAPED, which is right and is also
       * invisible unless somebody runs the harness. Five anchors rotted in one afternoon; each was
       * found by accident. Here it is found by `npm test`.
       */
      const text = read(file);
      expect(
        text.includes(from),
        `anchor drifted — this mutation can never be applied:\n  ${from}`,
      ).toBe(true);
    },
  );
});
