// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/feedback — the footer that says "+1", and every fifth time says something louder.
//
// ========================= WHAT THE ORIGINAL DOES =========================
// A `<footer>` fixed to the bottom right, `pointer-events: none`, holding a `<ul>` that grows by
// one `<li>` per hit. Each item's text runs `blink-and-fade-out 5s ease both` and then sits there,
// invisible, forever: `events.push(ev)` with nothing that ever pops. A long round leaves hundreds
// of dead nodes behind, which is a leak rather than a design.
//
// ========================= TWO THINGS DONE DIFFERENTLY, AND WHY =========================
// 1. ⚠️ IT DOES NOT BLINK. The original's keyframe is called `blink-and-fade-out`, and blinking is
//    a photosensitivity risk under WCAG 2.3.1 — the same reason this game's tiles RISE where the
//    original's flash. A fade carries the whole message; the blink only carried the risk. Under
//    `prefers-reduced-motion` the stylesheet collapses even the fade, and the item still leaves,
//    because its removal is driven by the animation ENDING rather than by the animation looking
//    like anything.
//
// 2. ⚠️ ITEMS ARE REMOVED. On `animationend`, with a timer as a backstop — `animationend` does not
//    fire if the browser refuses to run the animation at all, and a footer that silently stops
//    clearing itself is exactly the original's bug wearing a fix. `MAX_ITEMS` is a second bound
//    under both, so a player hammering a full mat cannot outrun the removal.
//
// ========================= IT IS INVISIBLE TO A SCREEN READER, ON PURPOSE =========================
// `aria-hidden="true"`. Every hit is ALREADY announced through `ui/announce` and `srSay`, with the
// value that was collected — which is more informative than "+1" and arrives on the same event.
// Adding a live region here would say the same thing twice in a row, and the second copy would be
// the less useful one. Decoration for the eye, over an announcement that already exists.

export interface FeedbackDeps {
  readonly doc: Document;
  /**
   * How long an item stays before it is taken out, in milliseconds. The original's five seconds.
   * Injected so a test does not have to wait five seconds to watch one leave.
   */
  readonly lifetimeMs?: number;
}

export interface Feedback {
  readonly root: HTMLElement;
  /** Adds one line. Returns the element, so a caller can assert on it. */
  push(text: string): HTMLElement;
  /** Empties it. A new round starts with a clean footer, not the last one's tail. */
  clear(): void;
  /** How many lines are on screen right now. */
  count(): number;
  destroy(): void;
}

/** The original's own five seconds. */
export const LIFETIME_MS = 5_000;

/**
 * ⚠️ A HARD CEILING ON LIVE NODES, independent of the timers.
 *
 * At the hardest setting a fast player can land four hits inside a second, and every route out of
 * this list is asynchronous — an `animationend` that may not fire, a `setTimeout` a background tab
 * may throttle. None of that can be allowed to grow the DOM without bound, so the oldest item
 * leaves the moment a new one would make it the twelfth. Twelve is comfortably more than fit on
 * screen at the smallest supported size.
 */
export const MAX_ITEMS = 12;

export function createFeedback(deps: FeedbackDeps): Feedback {
  const { doc } = deps;
  const lifetimeMs = deps.lifetimeMs ?? LIFETIME_MS;

  const root = doc.createElement('div');
  root.className = 'feedback';
  // See the header: the event behind every one of these lines is already spoken by `srSay`.
  root.setAttribute('aria-hidden', 'true');

  const list = doc.createElement('ul');
  list.className = 'feedback-list';
  root.appendChild(list);

  /** Timers keyed by their item, so `clear` and the ceiling can cancel them. */
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  function remove(item: HTMLElement): void {
    const timer = timers.get(item);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(item);
    item.remove();
  }

  return {
    root,

    push(text: string): HTMLElement {
      const item = doc.createElement('li');
      item.className = 'feedback-item';
      item.textContent = text;

      // Whichever arrives first wins; `remove` is idempotent because a removed node has no parent
      // and its timer is already gone from the map.
      item.addEventListener('animationend', () => remove(item), { once: true });
      timers.set(item, setTimeout(() => remove(item), lifetimeMs + 250));

      list.appendChild(item);
      while (list.children.length > MAX_ITEMS) {
        remove(list.children[0] as HTMLElement);
      }
      return item;
    },

    clear(): void {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      list.replaceChildren();
    },

    count(): number {
      return list.children.length;
    },

    destroy(): void {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      root.remove();
    },
  };
}
