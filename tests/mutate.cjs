// SPDX-License-Identifier: AGPL-3.0-or-later
// One literal substitution in one file, used by mutation-check.sh.
//
//   node tests/mutate.cjs <file> <from> <to>
//   node tests/mutate.cjs <file> <from> --to-file <path>
//
// ⚠️ TWO SANDBOX TRAPS ARE BAKED INTO THIS FILE, both of which fail SILENTLY and both of which
// made a mutation harness report healthy gates as escaped:
//
//  1. This is a FILE and not a `node -e` one-liner. Under this sandbox `node -e` writes nothing,
//     prints nothing — not even to stderr — and still exits 0.
//  2. `--to-file` exists because a multi-line REPLACEMENT does not survive being passed as an
//     argument: Git Bash serialises argv into a single Windows command line, and the argument
//     arrives truncated at the first newline. When the surviving first line happens to equal the
//     anchor, `replace` is a no-op, the file is untouched, and the exit code is still 0.
//
// Both are the same lesson the heredoc rule already teaches: on this machine, anything with a
// newline in it travels in a file, never in an argument.
const fs = require('fs');

/*
 * 🔴 A THIRD INSTANCE OF THE SAME DISEASE, found on 2026-09-11 and worse than the first two.
 * Git Bash serialises argv into a single Windows command line, and the Windows parser then reads
 * SHELL METACHARACTERS out of the middle of an argument. An anchor containing `&&` --
 * `"build:lib": "vite build && tsc -p tsconfig.pkg.json"` -- arrived as
 * `"build:lib": "vite build ` and the rest RAN AS A SECOND COMMAND.
 *
 * ⚠️ It surfaced as `usage:` and the harness counted the mutation as escaped, which is the honest
 * outcome and still the wrong one: a gate that cannot be exercised is reported as a gate that does
 * not bite. `--from-file` closes the class the same way `--to-file` closed the newline one.
 *
 * 📌 THE RULE IS NOW GENERAL: on this machine, anything a shell might read travels in a FILE.
 */
const argv = process.argv.slice(2);
function take(flag) {
  const at = argv.indexOf(flag);
  if (at === -1) return null;
  const value = argv[at + 1];
  argv.splice(at, 2);
  return value === undefined ? null : fs.readFileSync(value, 'utf8');
}
const toFromFile = take('--to-file');
const fromFile = take('--from-file');
const [file, fromArg, third] = argv;
const from = fromFile === null ? fromArg : fromFile;
const to = toFromFile === null ? third : toFromFile;

if (typeof to !== 'string') {
  process.stderr.write('usage: mutate.cjs <file> <from> (<to> | --to-file <path>)\n');
  process.exit(2);
}

// The truncation trap again, this time on the ANCHOR side. A multi-line `from` arrives cut at its
// first newline, argv shifts under it, and `--to-file` lands in the wrong slot — which surfaces as
// a usage error rather than as what it is. Say what it is.
if (fromFile === null && typeof from === 'string' && /[\n&|<>^]/.test(from)) {
  process.stderr.write(
    'refusing an anchor with a newline or a shell metacharacter passed as an argument: on this\n' +
    'platform it arrives truncated, and the rest of it RUNS. Use --from-file.\n',
  );
  process.exit(5);
}

// ⚠️ AND THE SAME ON THE REPLACEMENT SIDE, which cost more than the anchor did. A multi-line `to`
// passed as an argument arrives cut at its first newline. When that surviving line is a valid
// substitution the edit SUCCEEDS and does the wrong thing — an insertion becomes a replacement,
// silently. That is how `engine.cenas.replace(...)` was deleted from the composition root by an
// edit meant to add a line above it, and the game stopped leaving its title screen.
//
// `--to-file` exists for exactly this and is not refused.
if (toFromFile === null && typeof to === 'string' && /[\n&|<>^]/.test(to)) {
  process.stderr.write(
    'refusing a multi-line replacement passed as an argument: it arrives truncated at the first\n' +
    'newline, which turns an insertion into a silent deletion. Use --to-file, or the Edit tool.\n',
  );
  process.exit(6);
}

const src = fs.readFileSync(file, 'utf8');
if (!src.includes(from)) {
  process.stderr.write('anchor not found in ' + file + ': ' + JSON.stringify(from) + '\n');
  process.exit(3);
}

const out = src.replace(from, to);
if (out === src) {
  // The truncation failure above lands here. Refusing beats reporting a gate as escaped when the
  // mutation was never applied in the first place.
  process.stderr.write('replacement changed nothing in ' + file + ' — is `to` identical to `from`?\n');
  process.exit(4);
}
fs.writeFileSync(file, out);
