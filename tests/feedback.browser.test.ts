// SPDX-License-Identifier: AGPL-3.0-or-later
// The footer that says "+1", and the leak it is careful not to have.
//
// ⚠️ THE ORIGINAL LEAKS, and reproducing that faithfully would have been the wrong kind of
// fidelity. `AppFooter.vue` does `events.push(ev)` and there is no line anywhere that pops: a long
// round leaves hundreds of invisible `<li>`s behind, one per hit, each still carrying a finished
// animation. The tests below are mostly about the three independent ways an item leaves.

import { afterEach, describe, expect, it } from 'vitest';
import { MAX_ITEMS, createFeedback } from '../app/js/ui/feedback.ts';
import '../app/css/style.css';

const made: { destroy(): void }[] = [];

function feedback(lifetimeMs = 20) {
  const f = createFeedback({ doc: document, lifetimeMs });
  document.body.appendChild(f.root);
  made.push(f);
  return f;
}

const items = () => document.querySelectorAll('.feedback-item');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  for (const f of made) f.destroy();
  made.length = 0;
  document.body.replaceChildren();
});

describe('[Right] it shows what it is given', () => {
  it('puts the text on screen', () => {
    feedback().push('+1');
    expect(items()).toHaveLength(1);
    expect(items()[0].textContent).toBe('+1');
  });

  it('stacks several, in the order they arrived', () => {
    const f = feedback();
    f.push('+1');
    f.push('Combo!');
    expect([...items()].map((i) => i.textContent)).toEqual(['+1', 'Combo!']);
  });

  it('counts what is on screen', () => {
    const f = feedback();
    f.push('+1');
    f.push('+1');
    expect(f.count()).toBe(2);
  });
});

describe('[Right] an item leaves, three different ways', () => {
  it('leaves when its timer runs out', async () => {
    const f = feedback(20);
    f.push('+1');
    expect(f.count()).toBe(1);
    await wait(400);
    expect(f.count()).toBe(0);
  });

  it('leaves when the animation ends, without waiting for the timer', () => {
    // The fast path. In a real browser the animation finishes first; the timer is the backstop
    // for a browser that refuses to run it, where `animationend` never fires at all.
    const f = feedback(60_000);
    const item = f.push('+1');
    item.dispatchEvent(new AnimationEvent('animationend'));
    expect(f.count()).toBe(0);
  });

  it('leaves when it is pushed off the end by a twelfth arrival', async () => {
    // ⚠️ THE CEILING IS INDEPENDENT OF BOTH TIMERS, and it has to be: at the hardest setting a
    // fast player lands four hits a second, and every other route out of this list is
    // asynchronous — an `animationend` that may not fire, a `setTimeout` a background tab may
    // throttle. Neither can be allowed to grow the DOM without bound.
    const f = feedback(60_000);
    for (let i = 0; i < MAX_ITEMS + 5; i++) f.push(`+${i}`);
    expect(f.count()).toBe(MAX_ITEMS);
    // And it is the OLDEST that goes.
    expect(items()[0].textContent).toBe('+5');
  });
});

describe('[Zero] a new round starts on a clean footer', () => {
  it('clears everything', () => {
    const f = feedback(60_000);
    f.push('+1');
    f.push('Combo!');
    f.clear();
    expect(f.count()).toBe(0);
  });

  it('cancels the timers it cleared, so nothing fires into the next round', async () => {
    // A `clear` that emptied the list but left the timers running would have them wake later and
    // remove items belonging to the round after — one per hit of the round before, at random.
    const f = feedback(20);
    f.push('+1');
    f.clear();
    f.push('Combo!');
    await wait(5);
    expect(f.count()).toBe(1);
  });
});

describe('[Interface] it is decoration, and says so', () => {
  it('is hidden from a screen reader', () => {
    // ⚠️ Every hit is ALREADY announced by `ui/announce` through `srSay`, with the value that was
    // collected — more informative than "+1" and arriving on the same event. A live region here
    // would say the same thing twice, and the second copy would be the less useful one.
    expect(feedback().root.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not take the pointer, so it cannot eat a click meant for the mat', async () => {
    // Without `pointer-events: none` the footer sits between the player and the board and
    // swallows exactly the hits it exists to celebrate.
    await document.fonts.ready;
    expect(getComputedStyle(feedback().root).pointerEvents).toBe('none');
  });

  it('does not blink, which is what the original does', () => {
    // `@keyframes blink-and-fade-out` in si-em/whackwhack. Blinking is a photosensitivity risk
    // under WCAG 2.3.1 — the same reason this game's tiles rise where the original's flash — and
    // the fade carries the whole message anyway.
    const f = feedback(60_000);
    const name = getComputedStyle(f.push('+1')).animationName;
    expect(name).toBe('feedback-fade');
    expect(name).not.toContain('blink');
  });
});

describe('[Zero] destroy leaves nothing behind', () => {
  it('takes the root out of the document', () => {
    const f = feedback(60_000);
    f.push('+1');
    f.destroy();
    expect(document.querySelector('.feedback')).toBeNull();
  });
});
