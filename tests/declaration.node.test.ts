// SPDX-License-Identifier: AGPL-3.0-or-later
// The seven fields. This is the file that buys the accessibility stack.
//
// Answering `core/contract.ts` is what gets this game a sonar for a blind player, role-based high
// contrast, a screen reader and a translated HUD without writing a line of any of them. The
// mapping below is the whole trick, and it is one line long: a lit tile carrying a WRONG value is
// a `hazard`. That single choice makes the engine's sonar point at the tiles worth hitting and its
// colour-blocking mark the ones that cost — with no audio code in this game at all.
//
// This game is also the FIRST consumer of `tick: 'clock'` anywhere in the engine; the field is
// marked "no consumer in code yet" in contract.ts, and ADR-0030 says the contract only becomes a
// result once two presets exist. Chess is the first, with 'player'. This is the second.

import { describe, expect, it } from 'vitest';
import { conformanceProblems, speakableProblems } from '@the-inclusionist/engine/core/contract.js';
import { EVEN, MULTIPLE_OF_3 } from '../app/js/rules/category.ts';
import { MAT_CELLS, MAT_COLS, MAT_ROWS, cellOfSpot, inBounds, spotOfCell } from '../app/js/rules/grid.ts';
import { ROUND_GOAL } from '../app/js/rules/difficulty.ts';
import type { Wave } from '../app/js/rules/wave.ts';
import { createWhackDeclaration, type RoundView } from '../app/js/declaration/whack-declaration.ts';

const WAVE: Wave = {
  deadlineMs: 12_020,
  tiles: [
    { cell: 0, value: 4, correct: true },    // spot 0,0
    { cell: 7, value: 7, correct: false },   // spot 2,1
    { cell: 13, value: 10, correct: true },  // spot 3,2
  ],
};

function view(over: Partial<RoundView> = {}): RoundView {
  return {
    category: EVEN,
    wave: WAVE,
    hits: 3,
    focus: { x: 2, y: 1 },
    ...over,
  };
}

/** Translates by echoing the key, so a test can tell a real lookup from a hardcoded string. */
const echo = (key: string): string => `<${key}>`;

function declOf(over: Partial<RoundView> = {}) {
  let current = view(over);
  return {
    decl: createWhackDeclaration({ view: () => current, t: echo }),
    set: (next: Partial<RoundView>) => { current = view({ ...over, ...next }); },
  };
}

describe('[Interface] the declaration is well formed', () => {
  it('has no conformance problems', () => {
    expect(conformanceProblems(declOf().decl)).toEqual([]);
  });

  it('declares the mat as a grid of the right size', () => {
    expect(declOf().decl.topology).toEqual({ kind: 'grid', cols: MAT_COLS, rows: MAT_ROWS });
  });

  it('declares the CLOCK as the owner of the tick', () => {
    // Not decoration: this is the bit that tells the engine timing pressure applies, and so that
    // WCAG 2.2.1 is in play. Chess answers 'player'; nothing answered 'clock' before this game.
    expect(declOf().decl.tick).toBe('clock');
  });

  it('is still conformant with no wave in play', () => {
    // Between waves is a real state, and a contract that only holds mid-wave would throw during
    // the gap the engine is most likely to ask about.
    expect(conformanceProblems(declOf({ wave: null }).decl)).toEqual([]);
  });
});

describe('[Right] roleAt is the whole accessibility mapping', () => {
  const { decl } = declOf();

  it('calls a lit correct tile the goal', () => {
    expect(decl.roleAt(spotOfCell(0))).toBe('goal');
    expect(decl.roleAt(spotOfCell(13))).toBe('goal');
  });

  it('calls a lit INCORRECT tile a hazard', () => {
    // The line that makes the sonar and the colour-blocking work. A wrong tile costs a life, so
    // it is a hazard in exactly the sense the engine already means.
    expect(decl.roleAt(spotOfCell(7))).toBe('hazard');
  });

  it('calls an unlit tile free', () => {
    expect(decl.roleAt(spotOfCell(1))).toBe('free');
    expect(decl.roleAt(spotOfCell(19))).toBe('free');
  });

  it('calls everything free when no wave is up', () => {
    expect(declOf({ wave: null }).decl.roleAt(spotOfCell(0))).toBe('free');
  });

  it('answers for a spot off the mat instead of throwing', () => {
    // The engine sweeps neighbours, and a sweep near an edge asks about places that do not exist.
    for (const at of [{ x: -1, y: 0 }, { x: MAT_COLS, y: 0 }, { x: 0, y: MAT_ROWS }]) {
      expect(decl.roleAt(at)).toBe('free');
    }
  });
});

describe('[Right] nameAt says the number, and says it well', () => {
  const { decl } = declOf();

  it('names a lit tile by its value', () => {
    expect(decl.nameAt(spotOfCell(0))?.text).toBe('4');
    expect(decl.nameAt(spotOfCell(13))?.text).toBe('10');
  });

  it('names the wrong tile too', () => {
    // Silence on a wrong tile would tell a blind player which ones are correct by omission,
    // handing them an advantage a sighted player does not get and destroying the task.
    expect(decl.nameAt(spotOfCell(7))?.text).toBe('7');
  });

  it('returns null for an unlit tile', () => {
    expect(decl.nameAt(spotOfCell(1))).toBeNull();
  });

  it('is a well formed Speakable', () => {
    for (const cell of [0, 7, 13]) {
      expect(speakableProblems(decl.nameAt(spotOfCell(cell)))).toEqual([]);
    }
  });

  it('never returns an empty name, which reads as silence', () => {
    for (const cell of [0, 7, 13]) {
      expect(decl.nameAt(spotOfCell(cell))?.text.trim()).not.toBe('');
    }
  });
});

describe('[Right] the objective counts toward the round goal', () => {
  it('reports hits out of the goal', () => {
    const o = declOf().decl.objectiveOf(0);
    expect(o.have).toBe(3);
    expect(o.need).toBe(ROUND_GOAL);
  });

  it('names the objective through the dictionary, never as prose', () => {
    // The echo translator proves the key was actually looked up. A hardcoded "evens" would pass
    // a test that only checked for a non-empty string.
    expect(declOf().decl.objectiveOf(0).name.text).toBe(`<${EVEN.nameKey}>`);
    expect(declOf({ category: MULTIPLE_OF_3 }).decl.objectiveOf(0).name.text)
      .toBe(`<${MULTIPLE_OF_3.nameKey}>`);
  });

  it('carries the gender the frame needs to agree with', () => {
    expect(speakableProblems(declOf().decl.objectiveOf(0).name)).toEqual([]);
    expect(declOf().decl.objectiveOf(0).name.plural).toBe(true);
  });
});

describe('[Right] targetsOf points only at what is worth hitting', () => {
  it('returns the lit correct tiles', () => {
    expect(declOf().decl.targetsOf(0)).toEqual([spotOfCell(0), spotOfCell(13)]);
  });

  it('leaves the hazard out, so the sonar never aims a player at a mistake', () => {
    expect(declOf().decl.targetsOf(0)).not.toContainEqual(spotOfCell(7));
  });

  it('is empty between waves, which is an answer and not an error', () => {
    expect(declOf({ wave: null }).decl.targetsOf(0)).toEqual([]);
  });
});

describe('[Right] focusOf reports where the keyboard cursor is', () => {
  it('gives the focused spot with no heading', () => {
    // A whack-a-mole cursor does not face anywhere: there is no travel, only a position.
    const f = declOf().decl.focusOf(0);
    expect(f?.at).toEqual({ x: 2, y: 1 });
    expect(f?.heading).toBe('none');
  });

  it('is null when nothing has focus', () => {
    expect(declOf({ focus: null }).decl.focusOf(0)).toBeNull();
  });
});

describe('[Simple] the declaration reads live state, it does not snapshot it', () => {
  it('follows the wave as it changes', () => {
    // Built once at boot and consulted every frame. A declaration that closed over the first
    // wave would answer about a wave that ended minutes ago, and nothing would report it.
    const { decl, set } = declOf();
    expect(decl.roleAt(spotOfCell(0))).toBe('goal');
    set({ wave: { deadlineMs: 5_000, tiles: [{ cell: 0, value: 3, correct: false }] } });
    expect(decl.roleAt(spotOfCell(0))).toBe('hazard');
    expect(decl.nameAt(spotOfCell(0))?.text).toBe('3');
  });

  it('follows the score', () => {
    const { decl, set } = declOf();
    set({ hits: 11 });
    expect(decl.objectiveOf(0).have).toBe(11);
  });
});

describe('[Right] the mat is the original\'s twenty slabs', () => {
  // Pinned as LITERALS on purpose. Every other test here spells the mat with MAT_COLS and
  // MAT_CELLS, which means they hold for a mat of any size — a 4x4 mat passed all of them. The
  // twenty slabs are a product fact carried over from si-em/whackwhack, not an implementation
  // detail, so one test has to state the numbers rather than refer to them.
  it('is five columns by four rows', () => {
    expect(MAT_COLS).toBe(5);
    expect(MAT_ROWS).toBe(4);
  });

  it('has twenty cells', () => {
    expect(MAT_CELLS).toBe(20);
  });

  it('is wider than it is deep, which is the landscape orientation', () => {
    expect(MAT_COLS).toBeGreaterThan(MAT_ROWS);
  });
});

describe('[Boundary] the grid maps both ways without an off-by-one', () => {
  it('round-trips every cell', () => {
    for (let cell = 0; cell < MAT_CELLS; cell++) {
      expect(cellOfSpot(spotOfCell(cell))).toBe(cell);
    }
  });

  it('puts cell 0 at the origin and the last cell at the far corner', () => {
    expect(spotOfCell(0)).toEqual({ x: 0, y: 0 });
    expect(spotOfCell(MAT_CELLS - 1)).toEqual({ x: MAT_COLS - 1, y: MAT_ROWS - 1 });
  });

  it('is row-major, so the first row fills before the second starts', () => {
    expect(spotOfCell(MAT_COLS - 1)).toEqual({ x: MAT_COLS - 1, y: 0 });
    expect(spotOfCell(MAT_COLS)).toEqual({ x: 0, y: 1 });
  });

  it('rejects what is off the mat', () => {
    for (const at of [{ x: -1, y: 0 }, { x: 0, y: -1 }, { x: MAT_COLS, y: 0 }, { x: 0, y: MAT_ROWS }]) {
      expect(inBounds(at)).toBe(false);
      expect(cellOfSpot(at)).toBe(-1);
    }
  });

  it('rejects a fractional spot', () => {
    expect(inBounds({ x: 1.5, y: 0 })).toBe(false);
  });
});
