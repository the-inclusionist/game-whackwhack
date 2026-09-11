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
import type { RoundTile } from '../app/js/rules/round.ts';
import { createWhackDeclaration, type RoundView } from '../app/js/declaration/whack-declaration.ts';

/**
  * Three tiles on the mat, each with its own heat.
  *
  * ⚠️ There is no `resolved` flag and no wrapping wave any more. A judged tile LEAVES this list,
  * so "answered but still in the array" is not a state the declaration can be handed — which is
  * what makes the `!t.resolved` filters this file used to check for unnecessary rather than
  * merely absent. The bug they existed for (the sonar aiming at a collected tile) cannot be
  * written now.
  */
const TILES: RoundTile[] = [
  { cell: 0, value: 4, correct: true, heat: 1 },      // spot 0,0
  { cell: 7, value: 7, correct: false, heat: 0.6 },   // spot 2,1
  { cell: 13, value: 10, correct: true, heat: 0.2 },  // spot 3,2
];

function view(over: Partial<RoundView> = {}): RoundView {
  return {
    category: EVEN,
    tiles: TILES,
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
    // ⚠️ CALLED, not read. `topology` became a function in ADR-0084 — the engine's contract
    // changed under this game mid-session, on the day the 15-puzzle's three board sizes proved a
    // value could not express a board that resizes. This mat does not resize, so it answers a
    // constant; the shape of the answer is the engine's business, not the mat's.
    expect(declOf().decl.topology()).toEqual({
      kind: 'grid',
      size: [MAT_COLS, MAT_ROWS],
      move: 'orthogonal',
      frame: 'compass',
    });
  });

  it('declares an ORTHOGONAL metric, because this cursor cannot move diagonally', () => {
    // ⚠️ NOT COSMETIC. A grid used to be Chebyshev always -- "on a grid the diagonal costs one
    // step, and that is how a player counts" -- which is true only where the diagonal is legal.
    // `ui/grid-mirror`'s `step` moves one axis at a time and clamps; there is no diagonal on this
    // mat. Declaring one would make the sonar under-report distance to a player who cannot see
    // the board, which is not imprecision but sending a child confidently the wrong way.
    expect(declOf().decl.topology()).toMatchObject({ move: 'orthogonal' });
  });

  it('speaks directions by the COMPASS, because the mat is seen from above', () => {
    // `clock` is for a side-on platformer, where north and south mean nothing to a player looking
    // at the world from the side. This board has a far row and a near row.
    expect(declOf().decl.topology()).toMatchObject({ frame: 'compass' });
  });

  it('answers the same topology every time it is asked', () => {
    // The reason a fixed board can hold a function without ceremony being a lie: it IS constant,
    // and saying so twice has to give the same answer.
    const { decl } = declOf();
    expect(decl.topology()).toEqual(decl.topology());
  });

  it('holds ONE position at a time, because the verbs here are sequential', () => {
    /**
     * ⚠️ `conformanceProblems` ALREADY CHECKS THE SHAPE — that it is a function returning an
     * integer of at least one — so the block above covers everything except the thing that is
     * actually this game's decision: the NUMBER. Three would report whack-a-mole as unplayable on
     * a two-touch phone, and nothing in the engine could tell that this was wrong.
     *
     * One is right because nothing here is sustained: the cursor moves, THEN the hammer falls.
     * `ui/grid-mirror` acts on one intent per keydown and the pointer path is a single click.
     */
    expect(declOf().decl.holdsAtOnce()).toBe(1);
  });

  it('answers the same count every time, as a fixed demand should', () => {
    // A function rather than a value because a game with phases changes its demand between them.
    // This mat never does, and saying so twice has to give the same answer.
    const { decl } = declOf();
    expect(decl.holdsAtOnce()).toBe(decl.holdsAtOnce());
  });

  it('holds NO key, which is the other question and a different answer', () => {
    /**
     * ⚠️ `holdsAtOnce` ABOVE DOES NOT ANSWER THIS, and the two being read as one is what forced
     * `seguraTeclas` into the contract in engine 8.0.0. That number counts SIMULTANEOUS positions
     * and refuses zero; this one asks whether any position is HELD. "One at a time" and "one held
     * down" are the same numeral and different facts, and this game is the first: the cursor
     * moves, then the hammer falls, and nothing is sustained in between.
     *
     * What the answer buys is the absence of a control. Latching is offered where something can
     * be held; offering it here would put an adjustment on the accessibility bar that does
     * nothing, in front of the one child who went looking for it.
     */
    expect(declOf().decl.seguraTeclas()).toBe(false);
  });

  it('gives the same answer every time, because the bar is built from it ONCE', () => {
    // The engine reads this at boot and never again, on purpose: an icon that appeared and
    // vanished between phases would move the tab order under the hand of whoever was using it.
    const { decl } = declOf();
    expect(decl.seguraTeclas()).toBe(decl.seguraTeclas());
  });

  it('takes Enter off the pause, because Enter is how the hammer falls', () => {
    /**
     * ⚠️ THE ENGINE'S FACTORY BINDS `start` TO `KeyH` AND `Enter`, and it is right to: Enter has
     * paused for years, so declaring it described a key rather than giving it new work. In THIS
     * game the mat is twenty real `<button role="gridcell">`s, so Enter activates them natively —
     * a child would whack a tile and open the pause with one press.
     *
     * `mapeamentoDoTeclado` is where a game says so. Partial on purpose: the directions and the
     * hammer keep the engine's factory, because restating them would be owning a copy of a table
     * this game did not write.
     */
    const mapa = declOf().decl.mapeamentoDoTeclado!(1, 0)!;
    expect(mapa.start).toEqual(['KeyH', 'Escape']);
    expect(mapa.start).not.toContain('Enter');
    expect(Object.keys(mapa), 'only the colliding position is named').toEqual(['start']);
  });

  it('answers the same table for every seat, because this mat seats one child', () => {
    // The engine passes player count and seat because a two-player keyboard is not a one-player
    // keyboard. Ignoring both is an answer here, and saying so is what keeps it from looking like
    // an argument somebody forgot to use.
    const { decl } = declOf();
    expect(decl.mapeamentoDoTeclado!(2, 1)).toEqual(decl.mapeamentoDoTeclado!(1, 0));
  });

  it('does not REQUIRE a pointer, because the whole game is reachable by keyboard', () => {
    /**
     * ⚠️ THE FIELD IS OMITTED RATHER THAN DECLARED FALSE, and that is the engine's own
     * instruction: forcing three hundred games to write `needsPointer: () => false` would charge
     * the price of `holdsAtOnce` without its reason. Omission is the answer "no".
     *
     * The claim behind it is load-bearing and true throughout this game: twenty real buttons in
     * `ui/grid-mirror`, a real `<button>` on the title, radios and cyclers in the options. The
     * mouse tilt and the click-a-tile path are conveniences ON TOP, never the only way in.
     */
    const pointer = declOf().decl.needsPointer;
    if (pointer !== undefined) expect(pointer.call(declOf().decl)).toBe(false);
    else expect(pointer).toBeUndefined();
  });

  it('names the REGION as the world, not the canvas', () => {
    // ⚠️ The canvas is the tempting answer and is wrong twice: the grid mirror a screen reader
    // navigates is a sibling of it, and a player who needs a colour-vision simulation needs it
    // over the score as well as over the tiles.
    expect(declOf().decl.world()).toEqual({ kind: 'element', selector: '#game-region' });
  });

  it('does not answer `none`, which the contract refuses to treat as a default', () => {
    // "Um jogo de DOM puro não é um jogo onde empatia não faz sentido" — blindfold chess is the
    // proof. `none` is for an activity with no space at all, declared on purpose.
    expect(declOf().decl.world().kind).not.toBe('none');
  });

  it('declares the CLOCK as the owner of the tick', () => {
    // Not decoration: this is the bit that tells the engine timing pressure applies, and so that
    // WCAG 2.2.1 is in play. Chess answers 'player'; nothing answered 'clock' before this game.
    expect(declOf().decl.tick).toBe('clock');
  });

  it('is still conformant with an empty mat', () => {
    // An empty mat is a real state — between one tile leaving and the next arriving — and a
    // contract that only held while something was lit would throw during the very gap the engine
    // is most likely to ask about.
    expect(conformanceProblems(declOf({ tiles: [] }).decl)).toEqual([]);
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

  it('calls everything free when the mat is empty', () => {
    expect(declOf({ tiles: [] }).decl.roleAt(spotOfCell(0))).toBe('free');
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

  it('is empty on an empty mat, which is an answer and not an error', () => {
    expect(declOf({ tiles: [] }).decl.targetsOf(0)).toEqual([]);
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
  it('follows the mat as it changes', () => {
    // Built once at boot and consulted every frame. A declaration that closed over the first
    // tiles would answer about a mat that emptied minutes ago, and nothing would report it.
    const { decl, set } = declOf();
    expect(decl.roleAt(spotOfCell(0))).toBe('goal');
    set({ tiles: [{ cell: 0, value: 3, correct: false, heat: 1 }] });
    expect(decl.roleAt(spotOfCell(0))).toBe('hazard');
    expect(decl.nameAt(spotOfCell(0))?.text).toBe('3');
  });

  it('stops naming a tile the instant it leaves the mat', () => {
    // ⚠️ This WAS a reported bug, under the old model, and it took three copies of one rule to
    // cause: a judged tile stayed in the wave marked `resolved`, and the renderer, `targetsOf`
    // and `nameAt` each had to remember to skip it. Two of the three did not, so the sonar kept
    // aiming a blind player at a tile they had already collected. The rule lives in the round
    // now — a judged tile is simply not in the list — and this is the assertion that says so.
    const { decl, set } = declOf();
    expect(decl.targetsOf(0)).toContainEqual(spotOfCell(0));
    set({ tiles: TILES.filter((t) => t.cell !== 0) });
    expect(decl.nameAt(spotOfCell(0))).toBeNull();
    expect(decl.roleAt(spotOfCell(0))).toBe('free');
    expect(decl.targetsOf(0)).not.toContainEqual(spotOfCell(0));
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
  it('is four columns by five rows', () => {
    // ⚠️ Read off the ORIGINAL's stylesheet, not chosen: `.gamepad__surface` is
    // `repeat(4, 1fr)` columns over `repeat(5, 1fr)` rows. I had this the other way round,
    // reasoning from a 16:9 canvas, after being told "4x5 azulejos".
    expect(MAT_COLS).toBe(4);
    expect(MAT_ROWS).toBe(5);
  });

  it('has twenty cells', () => {
    expect(MAT_CELLS).toBe(20);
  });

  it('is DEEPER than it is wide, which is what costs the framing its vertical room', () => {
    expect(MAT_ROWS).toBeGreaterThan(MAT_COLS);
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
