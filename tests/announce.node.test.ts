// SPDX-License-Identifier: AGPL-3.0-or-later
// What the round says out loud. For a player who cannot see the mat, this IS the game.
//
// It is tested here rather than through a live region on purpose. `srSay` clears the region and
// writes on the next `requestAnimationFrame`, so a hidden pane leaves it EMPTY rather than stale —
// an assertion against it fails for reasons that have nothing to do with the sentence. Pulled out
// of the composition root, the mapping is a pure function and this runs in milliseconds.

import { describe, expect, it } from 'vitest';
import { announcementFor, type AnnounceContext } from '../app/js/ui/announce.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import type { RoundEvent } from '../app/js/rules/round.ts';

function context(over: Partial<AnnounceContext> = {}): AnnounceContext {
  return { i18n: createI18n('pt'), collecting: 'números pares', hits: 5, ...over };
}

const say = (event: RoundEvent, ctx = context()) => announcementFor(event, ctx);

describe('[Right] every tile that lights is named, one at a time', () => {
  // ⚠️ It was one sentence per WAVE, listing three or four values at once. That was quieter, and
  // it only worked because the tiles arrived together; they arrive singly now. Announcing some of
  // them and not others would leave a blind player charged for missing a tile they were never
  // told about, so every arrival gets its own sentence and `srSay` queues them politely.
  const said = say({ kind: 'tile-lit', cell: 0, value: 4 })!;

  it('says the number that lit', () => {
    expect(said.text).toContain('4');
  });

  it('says a WRONG value exactly as readily as a right one', () => {
    // ⚠️ THE PROPERTY THE WHOLE GAME RESTS ON. Announcing only the correct values — or marking
    // them apart — would hand a blind player the answer: they would hear a number and hit it
    // without comparing anything. The task is discrimination, and naming only the goals deletes
    // the task while looking like a kindness. The event carries no `correct` field AT ALL, which
    // is the strongest possible form of this guarantee: the sentence cannot depend on something
    // it is never given.
    const wrong = say({ kind: 'tile-lit', cell: 7, value: 7 })!;
    const right = say({ kind: 'tile-lit', cell: 0, value: 4 })!;
    expect(wrong.text.replace('7', 'N')).toBe(right.text.replace('4', 'N'));
  });

  it('says what to collect, so the question is complete', () => {
    // Repeated with every tile, because it IS the question — and a player who has just been read
    // four numbers in a row needs it again to know what they were for.
    expect(said.text).toContain('números pares');
  });

  it('is polite, not assertive', () => {
    expect(said.urgent).toBe(false);
  });
});

describe('[Right] each outcome gets its own sentence', () => {
  it('confirms a hit with the value', () => {
    // "Right" alone is useless when several tiles were live: which one?
    expect(say({ kind: 'hit', cell: 0, value: 4 })!.text).toContain('4');
  });

  it('distinguishes hitting the wrong tile from letting one expire', () => {
    // ⚠️ THE SAME VALUE ON BOTH. The first version of this compared a wrong-tile on 7 against a
    // missed 4, so the two sentences differed because the NUMBERS differed — and a mutation that
    // collapsed both reasons onto one phrase sailed through it. Holding the value fixed is what
    // makes the reason the only thing under test.
    const wrong = say({ kind: 'mistake', cell: 7, value: 7, reason: 'wrong-tile' })!;
    const missed = say({ kind: 'mistake', cell: 7, value: 7, reason: 'missed' })!;
    // Two different errors, and a child has to tell them apart to correct either: one is "you
    // chose badly", the other is "you were too slow". They call for opposite adjustments.
    expect(wrong.text).not.toBe(missed.text);
    expect(wrong.text).toContain('7');
    expect(missed.text).toContain('7');
  });

  it('announces a level change with the number', () => {
    expect(say({ kind: 'level-up', level: 3 })!.text).toContain('3');
  });
});

describe('[Right] only the end of the round interrupts', () => {
  it('is assertive when the round is won', () => {
    expect(say({ kind: 'over', outcome: 'won' })!.urgent).toBe(true);
  });

  it('is assertive when the round is lost', () => {
    expect(say({ kind: 'over', outcome: 'lost' })!.urgent).toBe(true);
  });

  it('carries the score, so the round closes with a result', () => {
    expect(say({ kind: 'over', outcome: 'won' }, context({ hits: 20 }))!.text).toContain('20');
  });

  it.each([
    { kind: 'tile-lit', cell: 0, value: 4 },
    { kind: 'hit', cell: 0, value: 4 },
    { kind: 'mistake', cell: 7, value: 7, reason: 'wrong-tile' },
    { kind: 'level-up', level: 2 },
  ] as RoundEvent[])('leaves %o polite', (event) => {
    // A game that interrupts constantly trains a child to tune it out, which costs them the one
    // announcement that mattered.
    expect(say(event)!.urgent).toBe(false);
  });

  it('says a won round differently from a lost one', () => {
    expect(say({ kind: 'over', outcome: 'won' })!.text)
      .not.toBe(say({ kind: 'over', outcome: 'lost' })!.text);
  });
});

describe('[Zero] silence is a legitimate answer', () => {
  it('says nothing for an event it does not know', () => {
    // ⚠️ `wave-cleared` used to be here, and it is gone with the wave — but the DEFAULT arm that
    // handled it has to stay covered, or a future event added to `RoundEvent` would fall through
    // it and be silently swallowed rather than fail a test. Cast because the whole point is to
    // pass something the union does not contain.
    expect(say({ kind: 'not-a-real-event' } as unknown as RoundEvent)).toBeNull();
  });
});

describe('[Interface] every sentence is translated, none is built by hand', () => {
  const events: RoundEvent[] = [
    { kind: 'tile-lit', cell: 0, value: 4 },
    { kind: 'hit', cell: 0, value: 4 },
    { kind: 'mistake', cell: 7, value: 7, reason: 'wrong-tile' },
    { kind: 'mistake', cell: 0, value: 4, reason: 'missed' },
    { kind: 'level-up', level: 2 },
    { kind: 'over', outcome: 'won' },
    { kind: 'over', outcome: 'lost' },
  ];

  it.each(['pt', 'en', 'es'] as const)('produces a sentence in %s for every event', (locale) => {
    for (const event of events) {
      const said = announcementFor(event, context({ i18n: createI18n(locale) }))!;
      expect(said, event.kind).not.toBeNull();
      expect(said.text.trim(), event.kind).not.toBe('');
      // A raw key reaching a screen reader is the failure the fallback chain makes visible.
      expect(said.text, event.kind).not.toMatch(/^say\./);
      // An unfilled placeholder means the caller and the catalogue disagree about parameters.
      expect(said.text, event.kind).not.toMatch(/\{\w+\}/);
    }
  });

  it('says different words in different languages', () => {
    const pt = announcementFor({ kind: 'hit', cell: 0, value: 4 }, context())!;
    const en = announcementFor(
      { kind: 'hit', cell: 0, value: 4 },
      context({ i18n: createI18n('en') }),
    )!;
    expect(pt.text).not.toBe(en.text);
    // …but the NUMBER is the same, because mathematics is not a language subject.
    expect(pt.text).toContain('4');
    expect(en.text).toContain('4');
  });
});
