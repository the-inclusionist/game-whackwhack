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

// The truncation trap again, this time on the ANCHOR side. A multi-line `from` arrives cut at its
// first newline, argv shifts under it, and `--to-file` lands in the wrong slot — which surfaces as
// a usage error rather than as what it is. Say what it is.
if (typeof from === 'string' && from.includes('\n')) {
  process.stderr.write(
    'refusing a multi-line anchor: it does not survive being passed as an argument on this\n' +
    'platform. Use the Edit tool, or pass a single-line anchor.\n',
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
if (third !== '--to-file' && typeof third === 'string' && third.includes('\n')) {
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
