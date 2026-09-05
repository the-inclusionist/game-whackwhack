// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/announce — what the round says out loud, as data.
//
// ========================= WHY THIS IS NOT IN THE COMPOSITION ROOT =========================
// It was, and being there made it untestable. This mapping is the most accessibility-critical
// decision in the game — it is the entire experience for a player who cannot see the mat — and it
// was buried in a switch inside `boot/main`, reachable only by driving a real browser and reading
// an aria-live region. Which does not work: `srSay` clears the region and writes on the next
// `requestAnimationFrame`, so a hidden pane produces an empty region rather than a stale one, and
// the assertion is unreliable for a reason that has nothing to do with the mapping.
//
// Pulled out, it is a pure function from an event to a sentence, and the node project checks it in
// milliseconds. `boot/main` keeps only the part that is genuinely about wiring: sending `urgent`
// to `srAlert` and everything else to `srSay`.
//
// ========================= EVENT VERSUS STATE =========================
// The engine contract names this distinction and it is the one that decides `urgent`. A state is
// true until it changes and is CONSULTED — the score, the level, what to collect; that is the HUD,
// and none of it belongs here. An event happened and must be said ONCE. Confusing the two produces
// both classic defects: a state announced every frame is chatter, and an event only consultable is
// never noticed.
//
// ⚠️ ONLY THE END OF A ROUND IS ASSERTIVE. Everything else is polite so a reader can finish the
// sentence it is on. Interrupting a child mid-word to say their score went up is worse than
// telling them a beat later — and a game that interrupts constantly trains them to tune it out,
// which costs them the one announcement that mattered.

import type { RoundEvent } from '../rules/round.ts';
import type { I18n } from '../i18n/index.ts';

export interface Announcement {
  readonly text: string;
  /** Assertive: interrupts. Reserved for the end of a round. */
  readonly urgent: boolean;
}

export interface AnnounceContext {
  readonly i18n: I18n;
  /** What the round is asking for, already translated. */
  readonly collecting: string;
  /** Correct hits so far, for the closing line. */
  readonly hits: number;
}

/**
 * The sentence for one event, or `null` when there is nothing to say.
 *
 * `wave-cleared` returns null on purpose: it is bookkeeping, and announcing it would put a word
 * between the child answering a wave and the next one arriving, which is the moment they most
 * need quiet.
 */
export function announcementFor(
  event: RoundEvent,
  context: AnnounceContext,
): Announcement | null {
  const { i18n } = context;
  switch (event.kind) {
    case 'wave-lit':
      // Every value, correct and incorrect alike, in the order they sit in the wave. Naming only
      // the correct ones would hand a blind player the answer and dissolve the task.
      return {
        text: i18n.t('say.waveLit', {
          values: event.wave.tiles.map((t) => t.value).join(', '),
          what: context.collecting,
        }),
        urgent: false,
      };
    case 'hit':
      return { text: i18n.t('say.hit', { value: event.value }), urgent: false };
    case 'mistake':
      return {
        text: i18n.t(event.reason === 'missed' ? 'say.missed' : 'say.wrongTile', {
          value: event.value,
        }),
        urgent: false,
      };
    case 'level-up':
      return { text: i18n.t('say.levelUp', { level: event.level }), urgent: false };
    case 'over':
      return {
        text: i18n.t(event.outcome === 'won' ? 'say.won' : 'say.lost', { have: context.hits }),
        urgent: true,
      };
    default:
      return null;
  }
}
