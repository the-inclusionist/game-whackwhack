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

const [file, from, third, fourth] = process.argv.slice(2);
const to = third === '--to-file' ? fs.readFileSync(fourth, 'utf8') : third;

if (typeof to !== 'string') {
  process.stderr.write('usage: mutate.cjs <file> <from> (<to> | --to-file <path>)\n');
  process.exit(2);
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
