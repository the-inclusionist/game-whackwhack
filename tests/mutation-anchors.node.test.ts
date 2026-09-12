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
  /**
   * 🔴 FOUR CHARACTERS AND NOT THREE, AND THE MISSING ONE WAS THE BACKSLASH ITSELF. This ran as
   * three separate passes — over `"`, over `` ` `` and over `$` — and called a live anchor rotten
   * the first time one carried \`\\/\` from a regex literal in `vite.config.ts`. The shell
   * unescapes all FOUR inside double quotes, so `mutate.cjs` saw the right text and only this file
   * disagreed — and a checker that cries rot where there is none gets switched off exactly as fast
   * as one that misses it. It has to model the shell exactly rather than nearly.
   *
   * ⚠️ ONE PASS AND NOT FOUR. Chained passes re-process what an earlier one produced, so a
   * doubled backslash before a quote would be unescaped twice. A single alternation cannot.
   *
   * 📌 \`\\n\` IS DELIBERATELY LEFT ALONE: the shell passes it through as two characters and
   * `mutate.cjs` is what turns it into a newline. Unescaping it here would make this file
   * disagree with the tool it exists to check.
   */
  return inner.replace(/\\(["`$\\])/g, '$1');
}

/** `$RULES/round.ts` → `app/js/rules/round.ts`. A root the script never set is left alone. */
function expand(path: string, roots: Map<string, string>): string {
  return path.replace(/^\$([A-Z0-9_]+)\//, (whole, key: string) => {
    const base = roots.get(key);
    return base === undefined ? whole : `${base === '.' ? '' : `${base}/`}`;
  });
}

const ALL = mutations();

/**
 * ⚠️ THE HARNESS SETS THIS WHILE A MUTATION IS APPLIED, AND THE REASON IS A DEFECT THIS FILE
 * CAUSED. Applying a mutation deletes the very line its own anchor points at, so every check
 * below failed for every mutation — and `tests/mutation-check.sh` reads a red suite as «caught».
 * The result was that EVERY mutation reported caught, whether its real gate bit or not, for five
 * commits including the first full sweep of 216.
 *
 * 🔴 A GATE THAT REPORTS SUCCESS FOR REASONS OF ITS OWN is the exact defect this repository hunts,
 * and it was living inside the tool that hunts it. The verdicts were re-run after this line.
 *
 * 📌 Skipping is right rather than convenient: mid-mutation the tree is DELIBERATELY inconsistent,
 * and there is nothing true for this file to say about it. It runs on every `npm test`, which is
 * when an anchor actually rots.
 */
const MUTATING = process.env.INCL_MUTATING === '1';

describe('[Interface] every mutation still points at something', () => {
  it('the everyday --changed run can reach the config files too', () => {
    /**
     * 🔴 IT COULD NOT, FOR EIGHT MUTATIONS. `CFG=.`, so `"$CFG/package.json"` expands at declaration
     * time to `./package.json`, while `git status --porcelain` prints `package.json` — and the
     * substring match between them never fired. The everyday command said «proved what you touched»
     * while silently touching nothing in the manifest, the build config or the workflow, which are
     * exactly the three files whose defects reach a CONSUMER and nobody else.
     *
     * 📌 Held as a text check on the script because the alternative is running the harness, and a
     * gate that costs twenty minutes is a gate nobody runs. Found by noticing that a changed
     * `vite.config.ts` ran zero of its two mutations.
     */
    const script = read('tests/mutation-check.sh');
    expect(
      script,
      'the --changed matcher no longer strips ./, so every $CFG mutation is invisible to it',
    ).toContain('${FILES[$i]#./}');
  });

  it('the anchors travel in a file, because argv is not safe on this machine', () => {
    /**
     * 🔴 GIT BASH HANDS argv TO A WINDOWS COMMAND LINE, and the Windows parser then reads shell
     * metacharacters out of the middle of an argument. An anchor carrying `&&` arrived truncated
     * and its tail RAN as a second command; the harness reported the mutation as escaped, which is
     * honest and still wrong — a gate that cannot be exercised is not a gate that does not bite.
     *
     * The replacement side learned this first, through newlines. This is the same rule reaching the
     * anchor side: on this machine, anything a shell might read travels in a FILE.
     */
    /**
     * 🔴 AND THE FIRST VERSION OF THIS ASSERTION READ THE COMMENT. It asked the script to contain
     * `--from-file`, which the paragraph explaining the rule contains too — so removing the flag
     * from the CALL left it green. Proven by hand and found by that: it matches the invocation now,
     * which is the only occurrence that does anything.
     */
    const script = read('tests/mutation-check.sh');
    expect(script, 'the anchor is passed through argv again')
      .toMatch(/node tests\/mutate\.cjs "\$f" --from-file/);
  });

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
  /**
   * ⚠️ ONLY THIS ONE SKIPS, and narrowing it was a correction. Silencing the whole file also
   * silenced the two checks that read nothing but the script — the count and the shell scan —
   * and a mutation on the reader itself then escaped, because the test that would have caught it
   * was skipped by the harness that was testing it.
   *
   * This is the only check that reads the MUTATED tree, so it is the only one with nothing true
   * to say mid-mutation.
   */
  it.skipIf(MUTATING).each(ALL.map((m) => [m.name, m.file, m.from] as const))(
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

describe('[Interface] no anchor is one the shell would eat before the harness sees it', () => {
  /**
   * ⚠️ A BLIND SPOT IN THE CHECK ABOVE, found the day it was written and fixed the same hour.
   *
   * The anchors are double-quoted shell strings, so an unescaped backtick is COMMAND
   * SUBSTITUTION and an unescaped `$` is a variable. The shell rewrites the argument before
   * `mutate.cjs` ever sees it, so the harness reports `SKIP (anchor drifted)` while the text in
   * the file matches perfectly — and the check above, which reads the file rather than running
   * it, reports the anchor live. Two honest checks, opposite answers, and the mutation silently
   * never runs.
   *
   * 📏 It has cost this repository three times in one afternoon: a backtick around `start` (which
   * on Windows also OPENED A CONSOLE WINDOW, once per parse), a pair around a repository name,
   * and quotes inside a mutation NAME that truncated the argument.
   *
   * 📌 The `$ROOT/` prefix of the file argument is the one expansion that is MEANT to happen, so
   * only the anchors are scanned here.
   */
  const RAW = read('tests/mutation-check.sh').split('\n');

  /** The anchor lines exactly as the file holds them: the third line of each four-line call. */
  const anchorLines = RAW
    .map((line, i) => (RAW[i - 2]?.startsWith('add "') ? line : null))
    .filter((line): line is string => line !== null);

  it('finds an anchor line for every mutation, so this scan is not empty', () => {
    expect(anchorLines.length).toBe(ALL.length);
  });

  it.each(anchorLines.map((line, i) => [ALL[i]?.name ?? `#${i}`, line] as const))(
    '%s — its anchor survives the shell',
    (_name, line) => {
      const unescaped = /(^|[^\\\\])([`$])/.exec(line.replace(/\\\\\\\\/g, ''));
      expect(
        unescaped,
        `an unescaped ${unescaped?.[2] === '$' ? 'dollar' : 'backtick'} — the shell rewrites this`
          + ` anchor before mutate.cjs sees it, and the mutation never runs:\n  ${line.trim()}`,
      ).toBeNull();
    },
  );
});
