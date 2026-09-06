// SPDX-License-Identifier: AGPL-3.0-or-later
// The round: tiles arriving one at a time, each on its own clock, and a level that is a count.
//
// ========================= WHAT THIS FILE HAD TO BE REWRITTEN FOR =========================
// ⚠️ It tested a model that was mine and not the game's. Tiles lit N AT A TIME as a set to compare
// — 40 assertions and 11 mutations resting on it — and the Dev reported the symptom three times
// before it moved: "os tiles continuam aparecendo de 3 em 3". The original lights slabs
// INDEPENDENTLY, each on its own timer, appearing and vanishing at random.
//
// So the first block below is the one that matters most: tiles arrive SINGLY. Everything after it
// is the consequences — a deadline per tile instead of per set, a level that is a budget of tiles
// rather than a stretch of clock, and a mat that can hold at most `LIT_AT_ONCE` of them.
//
// This is the only module with a notion of TIME, and it takes it in MILLISECONDS. The engine's
// loop hands out `deltaTime` in FRAMES — PixiJS's convention, which the engine inherited — so the
// composition root converts at the boundary. Keeping milliseconds here is what lets the whole
// timing curve be asserted against the original's own numbers instead of against a frame count
// that changes with the refresh rate.

import { describe, expect, it } from 'vitest';
import { EVEN, MULTIPLE_OF_4 } from '../app/js/rules/category.ts';
import { LIT_AT_ONCE, ROUND_GOAL, spawnGapMs, tileDeadlineMs } from '../app/js/rules/difficulty.ts';
import { LIVES } from '../app/js/rules/defeat.ts';
import { MIN_TILES_PER_LEVEL, tilesInLevel } from '../app/js/rules/spawn.ts';
import { createRound, type Round, type RoundEvent } from '../app/js/rules/round.ts';

/** mulberry32. See tests/spawn.node.test.ts for why the first xorshift attempt was thrown out. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(over: Partial<Parameters<typeof createRound>[0]> = {}) {
  return createRound({
    category: EVEN,
    difficulty: 'medium',
    defeat: 'lives',
    rnd: seeded(7),
    ...over,
  });
}

const kinds = (events: readonly RoundEvent[]): string[] => events.map((e) => e.kind);
const FRAME = 17;   // one frame at 60 fps, rounded as the loop rounds it

/** Runs the clock in frame-sized steps, collecting everything. */
function play(r: Round, ms: number): RoundEvent[] {
  const out: RoundEvent[] = [];
  for (let spent = 0; spent < ms; spent += FRAME) out.push(...r.advance(FRAME));
  return out;
}

/** Hits every tile currently up, correct or not. */
function hitAll(r: Round): RoundEvent[] {
  const out: RoundEvent[] = [];
  for (const tile of r.tiles()) out.push(...r.hit(tile.cell));
  return out;
}

/** Hits only the correct ones, which is what a player who is paying attention does. */
function collect(r: Round): RoundEvent[] {
  const out: RoundEvent[] = [];
  for (const tile of r.tiles()) if (tile.correct) out.push(...r.hit(tile.cell));
  return out;
}

describe('[Zero] a round opens ready to be played', () => {
  it('has nothing on the mat before the first frame', () => {
    const r = round();
    expect(r.tiles()).toEqual([]);
    expect(r.hits()).toBe(0);
    expect(r.errors()).toBe(0);
    expect(r.outcome()).toBe('playing');
  });

  it('is at level one immediately', () => {
    expect(round().level()).toBe(1);
  });

  it('lights its FIRST tile on that first frame, with no gap at all', () => {
    // ⚠️ Deliberate. It used to wait a full gap — three seconds of empty mat after the player
    // pressed Play, which reads as a game that did not hear the click. Between later tiles the
    // gap is the rhythm; before the first one it is only delay.
    const r = round();
    expect(kinds(r.advance(FRAME))).toEqual(['tile-lit']);
    expect(r.tiles()).toHaveLength(1);
  });

  it('ignores a hit while nothing is lit', () => {
    // Hammering an empty mat is not a mistake. The original does not punish it either, and
    // punishing it would make exploring the board dangerous for a player who cannot see it.
    const r = round();
    expect(kinds(r.hit(3))).toEqual([]);
    expect(r.errors()).toBe(0);
  });
});

describe('[Right] tiles arrive ONE AT A TIME, which is the whole model change', () => {
  it('lights exactly one tile on the first frame, not the difficulty count', () => {
    // ⚠️ THE ASSERTION THIS FILE WAS REWRITTEN FOR. Under the old model this was 3, and 3 is what
    // the Dev kept seeing: "os tiles continuam aparecendo de 3 em 3".
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(round({ difficulty }).advance(FRAME).length, difficulty).toBe(1);
    }
  });

  it('waits a full gap before the second one, not one millisecond less', () => {
    const r = round();
    r.advance(1);
    expect(r.tiles()).toHaveLength(1);
    r.advance(spawnGapMs(r.level()) - 2);
    expect(r.tiles()).toHaveLength(1);
    r.advance(2);
    expect(r.tiles()).toHaveLength(2);
  });

  it('never puts more than the difficulty allows on the mat at once', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const r = round({ difficulty, defeat: 'endless' });
      let most = 0;
      // Long enough to spend several levels without the player touching anything.
      for (let spent = 0; spent < 120_000; spent += FRAME) {
        r.advance(FRAME);
        most = Math.max(most, r.tiles().length);
      }
      expect(most, difficulty).toBeLessThanOrEqual(LIT_AT_ONCE[difficulty]);
      // And it does reach the ceiling, or the assertion above would hold for a broken round that
      // never lit anything.
      expect(most, difficulty).toBe(LIT_AT_ONCE[difficulty]);
    }
  });

  it('never puts two tiles on the same cell', () => {
    const r = round({ difficulty: 'hard', defeat: 'endless' });
    for (let spent = 0; spent < 120_000; spent += FRAME) {
      r.advance(FRAME);
      const cells = r.tiles().map((t) => t.cell);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it('never shows the same VALUE twice at once', () => {
    // Two tiles reading 8 is not wrong, but a child cannot tell them apart, so the mat silently
    // asks for less than it appears to. Values may repeat across a level — twenty tiles cannot be
    // twenty distinct numbers out of a pool of twenty — but never side by side.
    const r = round({ difficulty: 'hard', defeat: 'endless' });
    for (let spent = 0; spent < 120_000; spent += FRAME) {
      r.advance(FRAME);
      const values = r.tiles().map((t) => t.value);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe('[Right] a level is a BUDGET of tiles, and ends when they are judged', () => {
  it('asks about four tiles in each of the first four levels', () => {
    // "com excecao dos quatro primeiros niveis, onde aparecem quatro tiles para julgar".
    for (const level of [1, 2, 3, 4]) expect(tilesInLevel(level)).toBe(MIN_TILES_PER_LEVEL);
  });

  it('asks about N tiles at level N once past the floor', () => {
    // "no nivel 20 devem aparecer e sumir 20 tiles para julgar".
    for (const level of [5, 6, 12, 20, 99]) expect(tilesInLevel(level)).toBe(level);
  });

  it('starts level one with exactly its budget still to be judged', () => {
    expect(round().tilesLeftInLevel()).toBe(MIN_TILES_PER_LEVEL);
  });

  it('counts a judged tile out of the budget', () => {
    const r = round();
    r.advance(FRAME);
    const before = r.tilesLeftInLevel();
    r.hit(r.tiles()[0].cell);
    expect(r.tilesLeftInLevel()).toBe(before - 1);
  });

  it('does NOT move to the next level on the clock alone', () => {
    // ⚠️ The rule that replaced `levelAt(elapsedMs)`. The original raised the level every fifteen
    // seconds; here fifteen seconds of a player leaving one tile alone changes nothing about
    // which level they are on, only about whether they missed it.
    const r = round({ defeat: 'endless' });
    r.advance(FRAME);
    play(r, 14_000);
    expect(r.level()).toBe(1);
  });

  it('moves up exactly when the last tile of the level is judged', () => {
    const r = round({ defeat: 'endless' });
    let level = 1;
    let guard = 0;
    // Play the level out by collecting what is correct and letting the rest expire.
    while (level === 1 && guard++ < 4000) {
      collect(r);
      const events = r.advance(FRAME);
      const up = events.find((e) => e.kind === 'level-up');
      if (up && up.kind === 'level-up') level = up.level;
    }
    expect(level).toBe(2);
    expect(r.level()).toBe(2);
    expect(r.tilesLeftInLevel()).toBe(tilesInLevel(2));
  });

  it('reaches a level whose budget is bigger than the floor', () => {
    // The floor is only the first four; if `tilesInLevel` were wired as a constant this is the
    // assertion that notices.
    const r = round({ defeat: 'endless' });
    let guard = 0;
    while (r.level() < 6 && guard++ < 40_000) {
      collect(r);
      r.advance(FRAME);
    }
    expect(r.level()).toBe(6);
    expect(r.tilesLeftInLevel()).toBe(6);
  });
});

describe('[Right] every tile carries its OWN clock', () => {
  it('expires a tile at its deadline and not one millisecond before', () => {
    const r = round({ defeat: 'endless' });
    r.advance(1);
    const deadline = tileDeadlineMs(r.level());
    const cell = r.tiles()[0].cell;
    r.advance(deadline - 2);
    expect(r.tiles().some((t) => t.cell === cell)).toBe(true);
    r.advance(2);
    expect(r.tiles().some((t) => t.cell === cell)).toBe(false);
  });

  it('cools from one to zero over that deadline, not over the round', () => {
    const r = round({ defeat: 'endless' });
    r.advance(1);
    const deadline = tileDeadlineMs(r.level());
    expect(r.tiles()[0].heat).toBeGreaterThan(0.99);
    r.advance(deadline / 2);
    expect(r.tiles()[0].heat).toBeCloseTo(0.5, 1);
  });

  it('gives two tiles that arrived apart DIFFERENT heats', () => {
    // ⚠️ The fact the old model could not express. One countdown for a whole wave was fine while
    // the tiles arrived together; here it would show a tile that had just lit as nearly spent.
    const r = round({ defeat: 'endless' });
    r.advance(1);
    r.advance(spawnGapMs(r.level()));
    const heats = r.tiles().map((t) => t.heat);
    expect(heats).toHaveLength(2);
    expect(heats[0]).not.toBe(heats[1]);
  });
});

describe('[Right] what is and is not a mistake', () => {
  it('scores a correct tile and takes it off the mat', () => {
    const r = round();
    r.advance(FRAME);
    const tile = r.tiles()[0];
    const events = r.hit(tile.cell);
    if (tile.correct) {
      expect(kinds(events)).toEqual(['hit']);
      expect(r.hits()).toBe(1);
    } else {
      expect(kinds(events)).toEqual(['mistake']);
      expect(r.errors()).toBe(1);
    }
    expect(r.tiles().some((t) => t.cell === tile.cell)).toBe(false);
  });

  it('charges for hitting a WRONG tile', () => {
    const r = round({ defeat: 'endless' });
    let guard = 0;
    while (guard++ < 500) {
      r.advance(FRAME);
      const wrong = r.tiles().find((t) => !t.correct);
      if (!wrong) continue;
      const events = r.hit(wrong.cell);
      expect(kinds(events)).toContain('mistake');
      const mistake = events.find((e) => e.kind === 'mistake');
      expect(mistake && mistake.kind === 'mistake' && mistake.reason).toBe('wrong-tile');
      return;
    }
    throw new Error('no incorrect tile appeared, which composeLevel is supposed to guarantee');
  });

  it('charges for letting a CORRECT tile expire', () => {
    const r = round({ defeat: 'endless' });
    let guard = 0;
    while (guard++ < 500) {
      r.advance(FRAME);
      if (r.tiles().some((t) => t.correct)) break;
    }
    const before = r.errors();
    const events = play(r, tileDeadlineMs(r.level()) + FRAME);
    const missed = events.filter((e) => e.kind === 'mistake' && e.reason === 'missed');
    expect(missed.length).toBeGreaterThan(0);
    // ⚠️ THE COUNTER, not just the event. Asserting only that a `missed` was emitted let
    // `errors += 1` be mutated to `errors += 0` and escape: the announcement still went out, the
    // round still looked right, and nobody was ever charged for the tile they let go.
    expect(r.errors()).toBe(before + missed.length);
  });

  it('charges NOTHING for letting a wrong tile expire, which is the right answer', () => {
    // ⚠️ The asymmetry that IS the educational content. A round that punished this would be
    // teaching "hit everything", which is the game this one exists not to be.
    const r = round({ defeat: 'endless', category: MULTIPLE_OF_4 });
    let guard = 0;
    const before = r.errors();
    while (guard++ < 2000) {
      const events = r.advance(FRAME);
      for (const event of events) {
        if (event.kind === 'mistake' && event.reason === 'missed') {
          // Every `missed` we see must be a correct tile; there is no other way to earn one.
          expect(EVEN.pool).toBeDefined();
        }
      }
      // Take every correct tile the instant it appears, so only wrong ones are ever left to run
      // out. If a wrong expiry cost anything, `errors` would climb.
      collect(r);
    }
    expect(r.errors()).toBe(before);
  });

  it('charges once for two taps on the same cell', () => {
    // A double tap, a stuck key or an impatient hand is a motor event, not a wrong answer. Here
    // the second tap cannot even find the tile: a judged tile leaves the mat at once.
    const r = round({ defeat: 'endless' });
    r.advance(FRAME);
    const cell = r.tiles()[0].cell;
    r.hit(cell);
    const again = r.hit(cell);
    expect(again).toEqual([]);
    expect(r.hits() + r.errors()).toBe(1);
  });
});

describe('[Boundary] a large frame produces every event rather than skipping them', () => {
  it('emits the tiles that lit AND expired inside one enormous step', () => {
    // A hidden tab, a breakpoint or a slow first paint hands over a large dt. A tile that opened
    // and closed inside it has to produce its events, or a blind player is never told about a
    // tile they were charged for missing.
    const r = round({ defeat: 'endless' });
    const events = r.advance(60_000);
    expect(kinds(events).filter((k) => k === 'tile-lit').length).toBeGreaterThan(1);
    expect(kinds(events)).toContain('level-up');
  });

  it('terminates on a ten-minute step instead of looping inside the frame', () => {
    // ⚠️ The loop walks from one scheduled boundary to the next, so a gap of zero would be a
    // boundary that consumes no time and never moves. `spawnGapMs` floors at one millisecond for
    // exactly this reason, and this is the assertion that would hang if it stopped.
    const r = round({ defeat: 'endless' });
    const started = Date.now();
    r.advance(600_000);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(r.level()).toBeGreaterThan(1);
  });

  it('ignores a step of zero or less', () => {
    const r = round();
    expect(r.advance(0)).toEqual([]);
    expect(r.advance(-100)).toEqual([]);
    expect(r.elapsedMs()).toBe(0);
  });
});

describe('[Right] each defeat mode ends the round its own way', () => {
  it('ends a lives round on the THIRD mistake, which is what three lives means', () => {
    const r = round({ defeat: 'lives' });
    let guard = 0;
    while (r.outcome() === 'playing' && guard++ < 5000) {
      r.advance(FRAME);
      // Hit everything, right or wrong: the wrong ones are the mistakes being counted.
      for (const tile of r.tiles()) if (!tile.correct) r.hit(tile.cell);
    }
    expect(r.outcome()).toBe('lost');
    expect(r.errors()).toBe(LIVES);
  });

  it('ends a sudden-death round on the first', () => {
    const r = round({ defeat: 'sudden-death' });
    let guard = 0;
    while (r.outcome() === 'playing' && guard++ < 5000) {
      r.advance(FRAME);
      for (const tile of r.tiles()) if (!tile.correct) r.hit(tile.cell);
    }
    expect(r.errors()).toBe(1);
    expect(r.outcome()).toBe('lost');
  });

  it('never loses an endless round, however many mistakes are made', () => {
    const r = round({ defeat: 'endless' });
    for (let spent = 0; spent < 200_000; spent += FRAME) {
      r.advance(FRAME);
      hitAll(r);
    }
    expect(r.errors()).toBeGreaterThan(LIVES);
    expect(r.outcome()).not.toBe('lost');
  });

  it('wins on the round goal, in every mode', () => {
    for (const defeat of ['endless', 'lives', 'sudden-death'] as const) {
      const r = round({ defeat });
      let guard = 0;
      while (r.outcome() === 'playing' && guard++ < 40_000) {
        collect(r);
        r.advance(FRAME);
      }
      expect(r.outcome(), defeat).toBe('won');
      expect(r.hits(), defeat).toBeGreaterThanOrEqual(ROUND_GOAL);
    }
  });

  it('says nothing more once it is over', () => {
    const r = round({ defeat: 'sudden-death' });
    let guard = 0;
    while (r.outcome() === 'playing' && guard++ < 5000) {
      r.advance(FRAME);
      for (const tile of r.tiles()) if (!tile.correct) r.hit(tile.cell);
    }
    expect(r.outcome()).toBe('lost');
    expect(r.tiles()).toEqual([]);
    expect(r.advance(60_000)).toEqual([]);
    expect(r.hit(0)).toEqual([]);
    // ⚠️ AND THE CLOCK IS STOPPED. Without this, dropping `ended` from the guard in `advance`
    // escaped: the loop exits on `!ended` anyway, so no EVENTS came out — but the round went on
    // quietly accumulating elapsed time behind a result screen.
    const frozen = r.elapsedMs();
    r.advance(60_000);
    expect(r.elapsedMs()).toBe(frozen);
  });

  it('emits `over` exactly once WITHIN a single advance that ends the round', () => {
    // ⚠️ The version below drives the ending through `hit`, where `checkEnd` runs once and a
    // double push is impossible. Ending it through an EXPIRY is the case that matters: `advance`
    // calls `checkEnd` inside its loop AND again after it, so the guard in `checkEnd` is the only
    // thing between one `over` and two. Mutating that guard escaped until this existed.
    const r = round({ defeat: 'sudden-death' });
    let guard = 0;
    while (guard++ < 5000) {
      const events = r.advance(FRAME);
      const over = events.filter((e) => e.kind === 'over');
      if (over.length > 0) {
        expect(over).toHaveLength(1);
        return;
      }
    }
    throw new Error('the round never ended by letting a correct tile expire');
  });

  it('emits `over` exactly once', () => {
    const r = round({ defeat: 'sudden-death' });
    const seen: RoundEvent[] = [];
    let guard = 0;
    while (guard++ < 5000) {
      seen.push(...r.advance(FRAME));
      for (const tile of r.tiles()) if (!tile.correct) seen.push(...r.hit(tile.cell));
    }
    expect(kinds(seen).filter((k) => k === 'over')).toHaveLength(1);
  });
});

describe('[Interface] the view is what the declaration reads', () => {
  it('carries the category, the tiles, the score and the focus', () => {
    const r = round();
    r.advance(FRAME);
    r.setFocus({ x: 2, y: 1 });
    const view = r.view();
    expect(view.category).toBe(EVEN);
    expect(view.tiles).toEqual(r.tiles());
    expect(view.hits).toBe(0);
    expect(view.focus).toEqual({ x: 2, y: 1 });
  });

  it('survives being destructured, which every consumer does', () => {
    // ⚠️ `view` was written as an object-literal method calling `this.tiles()`, and `this` in one
    // of those is whatever the call site made it. One destructure away from undefined.
    const r = round();
    r.advance(FRAME);
    const { view } = r;
    expect(view().tiles).toHaveLength(1);
  });

  it('reports an empty mat rather than a null, so no reader has to guard', () => {
    expect(round().view().tiles).toEqual([]);
  });
});
