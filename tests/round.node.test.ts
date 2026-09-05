// SPDX-License-Identifier: AGPL-3.0-or-later
// The round: waves arriving, tiles resolving, and the clock that does not wait for anyone.
//
// This is the only module with a notion of TIME, and it takes it in MILLISECONDS. The engine's
// loop hands out `deltaTime` in FRAMES — PixiJS's convention, which the engine inherited — so the
// composition root converts at the boundary. Keeping milliseconds here is what lets the whole
// timing curve be asserted against the original's own numbers instead of against a frame count
// that changes with the refresh rate.

import { describe, expect, it } from 'vitest';
import { EVEN, MULTIPLE_OF_4 } from '../app/js/rules/category.ts';
import { LIT_PER_WAVE, ROUND_GOAL, waveDeadlineMs, waveGapMs } from '../app/js/rules/difficulty.ts';
import { LIVES } from '../app/js/rules/defeat.ts';
import { createRound, type RoundEvent } from '../app/js/rules/round.ts';

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

describe('[Zero] a round starts with nothing lit', () => {
  it('has no wave before the first gap elapses', () => {
    const r = round();
    expect(r.wave()).toBeNull();
    expect(r.hits()).toBe(0);
    expect(r.errors()).toBe(0);
    expect(r.outcome()).toBe('playing');
  });

  it('is at level one immediately', () => {
    expect(round().level()).toBe(1);
  });

  it('ignores a hit while nothing is lit', () => {
    // Hammering an empty mat is not a mistake. The original does not punish it either, and
    // punishing it would make exploring the board dangerous for a player who cannot see it.
    const r = round();
    expect(kinds(r.hit(3))).toEqual([]);
    expect(r.errors()).toBe(0);
  });
});

describe('[Right] a wave lights after the gap and carries the difficulty', () => {
  it('lights nothing one millisecond early', () => {
    const r = round();
    r.advance(waveGapMs(1) - 1);
    expect(r.wave()).toBeNull();
  });

  it('lights exactly at the gap', () => {
    const r = round();
    const events = r.advance(waveGapMs(1));
    expect(kinds(events)).toContain('wave-lit');
    expect(r.wave()).not.toBeNull();
  });

  it.each(['easy', 'medium', 'hard'] as const)('lights %s many tiles', (difficulty) => {
    const r = round({ difficulty });
    r.advance(waveGapMs(1));
    expect(r.wave()!.tiles).toHaveLength(LIT_PER_WAVE[difficulty]);
  });

  it('gives the wave the deadline for the current level', () => {
    const r = round();
    r.advance(waveGapMs(1));
    expect(r.wave()!.deadlineMs).toBe(waveDeadlineMs(1));
  });

  it('does NOT let that deadline shrink as the wave runs', () => {
    // ⚠️ `deadlineMs` is the time the wave was GIVEN; the countdown is private. Sharing one
    // variable between the two — which is what this did first — makes the field report the time
    // REMAINING, so anything reading it sees a wave that appears to have just been created with
    // whatever is left. A HUD bar drawn from it would be full at every instant.
    const r = round();
    r.advance(waveGapMs(1));
    const declared = r.wave()!.deadlineMs;
    r.advance(waveDeadlineMs(1) / 2);
    expect(r.wave()!.deadlineMs).toBe(declared);
  });

  it('always has something to discriminate', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = round({ rnd: seeded(seed), difficulty: 'hard' });
      r.advance(waveGapMs(1));
      const tiles = r.wave()!.tiles;
      expect(tiles.some((t) => t.correct)).toBe(true);
      expect(tiles.some((t) => !t.correct)).toBe(true);
    }
  });
});

describe('[Right] hitting a correct tile scores, hitting a wrong one costs', () => {
  function litRound() {
    const r = round({ difficulty: 'hard' });
    r.advance(waveGapMs(1));
    const tiles = r.wave()!.tiles;
    return {
      r,
      right: tiles.find((t) => t.correct)!,
      wrong: tiles.find((t) => !t.correct)!,
    };
  }

  it('scores a correct tile', () => {
    const { r, right } = litRound();
    expect(kinds(r.hit(right.cell))).toContain('hit');
    expect(r.hits()).toBe(1);
    expect(r.errors()).toBe(0);
  });

  it('charges for a wrong tile', () => {
    const { r, wrong } = litRound();
    const events = r.hit(wrong.cell);
    expect(kinds(events)).toContain('mistake');
    expect(events.find((e) => e.kind === 'mistake')).toMatchObject({ reason: 'wrong-tile' });
    expect(r.errors()).toBe(1);
    expect(r.hits()).toBe(0);
  });

  it('ignores a tile that is not lit', () => {
    const { r } = litRound();
    const litCells = new Set(r.wave()!.tiles.map((t) => t.cell));
    const dark = [...Array(20).keys()].find((c) => !litCells.has(c))!;
    expect(kinds(r.hit(dark))).toEqual([]);
    expect(r.errors()).toBe(0);
  });

  it('ignores a second hit on a tile already resolved', () => {
    // Double-tap, a stuck key, an impatient hand. Charging twice for one mistake would punish a
    // motor difficulty rather than a wrong answer.
    const { r, wrong } = litRound();
    r.hit(wrong.cell);
    expect(kinds(r.hit(wrong.cell))).toEqual([]);
    expect(r.errors()).toBe(1);
  });
});

describe('[Right] leaving a wrong tile alone is the RIGHT move', () => {
  it('costs nothing when an incorrect tile expires', () => {
    const r = round({ difficulty: 'hard' });
    r.advance(waveGapMs(1));
    // Clear every correct tile, then let the wave run out with the wrong ones untouched.
    for (const tile of r.wave()!.tiles.filter((t) => t.correct)) r.hit(tile.cell);
    expect(r.errors()).toBe(0);
  });

  it('charges for every CORRECT tile left to expire', () => {
    const r = round({ difficulty: 'hard' });
    r.advance(waveGapMs(1));
    const missed = r.wave()!.tiles.filter((t) => t.correct).length;
    const events = r.advance(waveDeadlineMs(1));
    expect(r.errors()).toBe(missed);
    expect(events.filter((e) => e.kind === 'mistake' && e.reason === 'missed')).toHaveLength(missed);
  });
});

describe('[Right] a wave ends when it is finished OR when it expires', () => {
  it('clears as soon as every tile is resolved, without waiting out the clock', () => {
    // Waiting for the deadline after the last tile is answered would make a fast player wait for
    // a slow clock, which is the opposite of what a difficulty curve is for.
    const r = round({ difficulty: 'easy' });
    r.advance(waveGapMs(1));
    const tiles = [...r.wave()!.tiles];
    let events: RoundEvent[] = [];
    for (const tile of tiles) events = events.concat(r.hit(tile.cell));
    expect(kinds(events)).toContain('wave-cleared');
    expect(r.wave()).toBeNull();
  });

  it('starts the next gap after clearing', () => {
    const r = round({ difficulty: 'easy' });
    r.advance(waveGapMs(1));
    for (const tile of [...r.wave()!.tiles]) r.hit(tile.cell);
    expect(r.wave()).toBeNull();
    r.advance(waveGapMs(r.level()));
    expect(r.wave()).not.toBeNull();
  });

  it('really WAITS that gap, instead of lighting the next wave at once', () => {
    // Asserting that a wave arrives after the gap is not enough: it arrives after the gap even
    // when the gap was never restarted, because it was already there immediately. The pause is
    // what gives a player time to read the mat before the next question, so it has to be checked
    // from the other side.
    const r = round({ difficulty: 'easy' });
    r.advance(waveGapMs(1));
    for (const tile of [...r.wave()!.tiles]) r.hit(tile.cell);
    r.advance(waveGapMs(r.level()) - 1);
    expect(r.wave()).toBeNull();
  });

  it('clears on expiry too', () => {
    const r = round({ difficulty: 'easy' });
    r.advance(waveGapMs(1));
    const events = r.advance(waveDeadlineMs(1));
    expect(kinds(events)).toContain('wave-cleared');
    expect(r.wave()).toBeNull();
  });
});

describe('[Right] the level rises with the clock, not with the score', () => {
  it('announces a level change once', () => {
    const r = round({ defeat: 'endless' });
    const events = r.advance(15_001);
    expect(events.filter((e) => e.kind === 'level-up')).toHaveLength(1);
    expect(r.level()).toBe(2);
  });

  it('gives later waves a shorter deadline', () => {
    const r = round({ defeat: 'endless', difficulty: 'easy' });
    r.advance(waveGapMs(1));
    const first = r.wave()!.deadlineMs;
    r.advance(45_000);   // well past level 4
    r.advance(waveGapMs(r.level()));
    expect(r.wave()!.deadlineMs).toBeLessThan(first);
  });
});

describe('[Boundary] each defeat mode ends the round its own way', () => {
  /**
   * Spends exactly `count` mistakes, and no more.
   *
   * ⚠️ The first version of this let the wave expire after each wrong hit, which quietly added a
   * `missed` error for every correct tile still standing — so "two lives" became four errors and
   * the test failed for a reason that had nothing to do with the defeat mode. Clearing the correct
   * tiles first is what makes the count mean what it says.
   */
  function spendErrors(count: number, defeat: 'sudden-death' | 'lives' | 'endless') {
    const r = round({ defeat, difficulty: 'hard' });
    for (let i = 0; i < count; i++) {
      r.advance(waveGapMs(r.level()));
      const tiles = [...(r.wave()?.tiles ?? [])];
      const wrong = tiles.find((t) => !t.correct);
      if (wrong) r.hit(wrong.cell);
      if (r.outcome() !== 'playing') break;
      for (const tile of tiles) if (tile.correct) r.hit(tile.cell);
    }
    return r;
  }

  it('ends sudden death on the first mistake', () => {
    expect(spendErrors(1, 'sudden-death').outcome()).toBe('lost');
  });

  it('spends every life first', () => {
    expect(spendErrors(LIVES - 1, 'lives').outcome()).toBe('playing');
  });

  it('never loses in endless', () => {
    expect(spendErrors(6, 'endless').outcome()).toBe('playing');
  });

  it('announces the end exactly once when the CLOCK is what ends it', () => {
    // The other path into `over`, and the one that can emit it twice: `advance` consults the
    // outcome inside its loop and again on the way out, so an end reached by missing tiles passes
    // the check twice in a single call. A round that says "you lost" twice in one frame is a
    // screen reader saying it twice.
    const r = round({ defeat: 'sudden-death', difficulty: 'hard' });
    r.advance(waveGapMs(1));
    const events = r.advance(waveDeadlineMs(1));
    expect(events.filter((e) => e.kind === 'over')).toHaveLength(1);
    expect(r.outcome()).toBe('lost');
  });

  it('announces the end exactly once and then goes quiet', () => {
    const r = round({ defeat: 'sudden-death', difficulty: 'hard' });
    r.advance(waveGapMs(1));
    const wrong = r.wave()!.tiles.find((t) => !t.correct)!;
    const ending = r.hit(wrong.cell);
    expect(ending.filter((e) => e.kind === 'over')).toHaveLength(1);
    // Once it is over the clock stops mattering: no new waves, no new events.
    expect(kinds(r.advance(60_000))).toEqual([]);
    expect(r.wave()).toBeNull();
  });
});

describe('[Right] the round can be won', () => {
  it('reaches the goal and says so', () => {
    // MULTIPLE_OF_4 gives a wave with exactly one correct tile more often, which keeps this from
    // depending on the draw; the property under test is the goal, not the category.
    const r = round({ defeat: 'endless', difficulty: 'easy', category: MULTIPLE_OF_4 });
    let events: RoundEvent[] = [];
    for (let i = 0; i < 400 && r.outcome() === 'playing'; i++) {
      r.advance(waveGapMs(r.level()));
      for (const tile of [...(r.wave()?.tiles ?? [])]) {
        if (tile.correct) events = events.concat(r.hit(tile.cell));
      }
      if (r.wave()) r.advance(waveDeadlineMs(r.level()));
    }
    expect(r.hits()).toBeGreaterThanOrEqual(ROUND_GOAL);
    expect(r.outcome()).toBe('won');
    expect(events.filter((e) => e.kind === 'over')).toHaveLength(1);
  });
});

describe('[Interface] the round exposes exactly what the declaration needs', () => {
  it('answers the RoundView shape', () => {
    const r = round();
    r.advance(waveGapMs(1));
    const view = r.view();
    expect(view.category).toBe(EVEN);
    // Identity, not deep equality: the declaration asks three times a frame, so the wave has to
    // be held rather than rebuilt per call, and holding it is also what lets a consumer notice
    // the wave CHANGED without diffing its tiles.
    expect(view.wave).toBe(r.wave());
    expect(view.hits).toBe(r.hits());
    expect(view.focus).toBeNull();
  });

  it('carries the cursor the grid mirror reports', () => {
    const r = round();
    r.setFocus({ x: 2, y: 1 });
    expect(r.view().focus).toEqual({ x: 2, y: 1 });
  });
});

describe('[Simple] time is in milliseconds, and the caller converts', () => {
  it('advances by exactly what it is given', () => {
    const r = round();
    r.advance(1234);
    expect(r.elapsedMs()).toBe(1234);
  });

  it('tolerates a zero-length frame', () => {
    const r = round();
    expect(kinds(r.advance(0))).toEqual([]);
  });

  it('handles one frame longer than a whole wave without losing events', () => {
    // The loop clamps dt at 2 frames, but a hidden tab, a breakpoint or a slow first paint can
    // still hand over a large step. Swallowing the wave that opened and closed inside it would
    // lose the mistakes it contained.
    const r = round({ defeat: 'endless', difficulty: 'easy' });
    const events = r.advance(waveGapMs(1) + waveDeadlineMs(1));
    expect(kinds(events)).toContain('wave-lit');
    expect(kinds(events)).toContain('wave-cleared');
    expect(r.errors()).toBeGreaterThan(0);
  });
});
