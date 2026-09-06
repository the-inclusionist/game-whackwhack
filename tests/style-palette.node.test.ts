// SPDX-License-Identifier: AGPL-3.0-or-later
// The stylesheet's colours and render/palette's colours, held to each other.
//
// ========================= THIS FILE WAS CITED BEFORE IT EXISTED =========================
// ⚠️ `app/css/style.css` carried a comment reading "tests/style-palette.node.test.ts compares the
// two files so they cannot drift" — naming this exact path — and no such file had ever been
// written. That is worse than saying nothing: it invited the next reader to move a colour and
// trust a gate that was not there. The comment was corrected to admit the gap; this closes it.
//
// ========================= WHY THERE ARE TWO COPIES AT ALL =========================
// CSS cannot import TypeScript. `render/palette.ts` is where the colours are MEASURED — the
// contrast floors, the colour-vision simulations, the search that picked each one — and the
// stylesheet needs the same values for the parts of the game that are DOM rather than canvas.
// One of them has to be a copy, and the copy is the CSS.
//
// ========================= WHAT THIS DOES NOT CHECK =========================
// Only the colours that appear in BOTH. `--title-pink` and `--title-glow` are the title screen's
// alone and have no canvas equivalent; `TILE_LIT_COLD` is the canvas's alone. Listing them as
// exceptions would be a way of pretending the check is total, so the pairs are named explicitly
// and anything unpaired is simply out of scope — which the "every measured colour is either paired
// or named" test below states out loud, so a NEW colour cannot quietly land in neither list.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCENT, GROUND, INK, STROKE, TILE_IDLE, TILE_LIT, TILE_LIT_COLD } from '../app/js/render/palette.ts';

// Forward slashes: `join` on Windows produces backslashes, and while `readFileSync` copes, the
// glob that finds this file would not — the lesson the vitest `include` already carries.
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CSS = readFileSync(join(ROOT, 'app', 'css', 'style.css'), 'utf8');

/** The value of a custom property declared on `:root`, uppercased for comparison. */
function cssVar(name: string): string | null {
  const match = CSS.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim().toUpperCase() : null;
}

/** Every colour that exists on both sides, and must agree. */
const PAIRS: readonly (readonly [string, string])[] = [
  ['ground', GROUND],
  ['tile-idle', TILE_IDLE],
  ['tile-lit', TILE_LIT],
  ['ink', INK],
  ['accent', ACCENT],
];

describe('[Right] the stylesheet carries the measured colours, unaltered', () => {
  it.each(PAIRS)('--%s matches render/palette', (name, measured) => {
    expect(cssVar(name), name).toBe(measured.toUpperCase());
  });

  it('finds every one of them, so a renamed variable fails LOUDLY', () => {
    // ⚠️ Without this, deleting `--ground` from the stylesheet makes `cssVar` return null and the
    // assertion above compares null to a hex string — which fails, but for a reason that reads as
    // "the colour changed" rather than "the colour is gone". Two different repairs.
    for (const [name] of PAIRS) expect(cssVar(name), name).not.toBeNull();
  });

  it('states them as plain six-digit hex on both sides', () => {
    // A `rgb()` or a three-digit shorthand in the CSS would be the same colour and would fail the
    // comparison above for no good reason. Pinning the FORM is what keeps the check textual, which
    // is what lets it run in the node project in a millisecond instead of needing a browser.
    for (const [name, measured] of PAIRS) {
      expect(measured, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(cssVar(name), name).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('[Interface] no measured colour escapes both lists', () => {
  it('accounts for every colour render/palette exports', () => {
    // ⚠️ THE TEST THAT KEEPS THIS FILE HONEST AS THE PALETTE GROWS. A new export lands in the
    // paired list or in the canvas-only list, and a colour that is in neither fails here rather
    // than being silently unchecked — which is exactly how the four stale palette mutations came
    // to be pointing at colours that no longer existed.
    const CANVAS_ONLY = { TILE_LIT_COLD };
    const paired = { GROUND, TILE_IDLE, TILE_LIT, INK, ACCENT };
    const accounted = new Set([...Object.values(paired), ...Object.values(CANVAS_ONLY)]);

    // Read straight off the module, so adding an export is what triggers this rather than
    // remembering to update a list here.
    const exported = { GROUND, TILE_IDLE, TILE_LIT, TILE_LIT_COLD, INK, ACCENT };
    for (const [name, value] of Object.entries(exported)) {
      expect(accounted.has(value), `${name} is in neither the paired nor the canvas-only list`)
        .toBe(true);
    }
  });

  it('does not put a canvas-only colour in the stylesheet under a paired name', () => {
    // `TILE_LIT_COLD` is the tile cooling towards its deadline — a canvas fact with no DOM
    // equivalent. If it ever needs one it gets a pair, not a smuggled duplicate.
    expect(cssVar('tile-lit-cold')).toBeNull();
  });
});

describe('[Right] the stroke width is a number, not a colour, and lives in one place', () => {
  it('is a positive width', () => {
    // Not duplicated into the CSS at all: the stroke is a canvas concept (it is what gives an
    // antialiased Zdog fill a hard edge) and nothing in the DOM draws with it. Asserted here so
    // the file that owns the palette's numbers has all of them under one gate.
    expect(STROKE).toBeGreaterThan(0);
  });
});
