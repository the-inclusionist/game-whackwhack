// SPDX-License-Identifier: AGPL-3.0-or-later
// The HUD, which now has two faces: the choices before a round and the readouts during one.
//
// ========================= WHY THIS FILE APPEARED LATE =========================
// ⚠️ There was no test for the HUD at all. It was four paragraphs of text read off the contract,
// and every fact in it was covered somewhere else — the objective by the declaration's tests, the
// lives by the defeat rules'. What had no owner was the ASSEMBLY, and that is exactly where the
// bug lived when the options moved in: `hidden` on `.hud` did nothing, because the browser's
// `display: none` loses to the author's `.hud { display: flex }`. The bar stayed on screen with
// the attribute set and nothing to show for it.
//
// So the assertions below are deliberately about what is VISIBLE rather than about what attribute
// is set. `el.hidden = true` that leaves the element on screen is the failure this file exists to
// catch, and `expect(el.hidden).toBe(true)` would pass right through it.

import { afterEach, describe, expect, it } from 'vitest';
import type { GameDeclaration } from '@the-inclusionist/engine/core/contract.js';
import { CATEGORIES } from '../app/js/rules/category.ts';
import { ROUND_GOAL } from '../app/js/rules/difficulty.ts';
import { LIVES } from '../app/js/rules/defeat.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createHud } from '../app/js/ui/hud.ts';
import { createOptions } from '../app/js/ui/options.ts';
import '../app/css/style.css';

const i18n = createI18n('pt');
const made: { destroy(): void }[] = [];

/** The one field the HUD reads. Everything else it is handed as a function. */
function declaration(have: number): Pick<GameDeclaration, 'objectiveOf'> {
  return {
    objectiveOf: () => ({
      name: { text: i18n.t(CATEGORIES[0].nameKey), gender: 'm', plural: true },
      have,
      need: ROUND_GOAL,
    }),
  };
}

function hud(over: Partial<Parameters<typeof createHud>[0]> = {}, have = 0) {
  const options = createOptions({
    doc: document, i18n,
    initial: { category: CATEGORIES[0], difficulty: 'easy', defeat: 'lives', pace: 1 },
  });
  const built = createHud({
    doc: document,
    declaration: declaration(have),
    options: options.root,
    // The engine fills this at boot; here it only has to BE an element, because what this
    // suite asserts about it is where the HUD puts it, not what is written inside.
    icons: document.createElement('div'),
    i18n,
    defeat: 'lives',
    livesLeft: () => LIVES,
    level: () => 1,
    best: () => 0,
    ...over,
  });
  // ⚠️ Into the DOCUMENT, not held in a variable. Every assertion here is a rendered measurement,
  // and a detached element has no box to measure.
  document.body.appendChild(built.root);
  made.push(built, options);
  return { hud: built, options };
}

const shown = (el: Element | null): boolean => {
  if (!el) return false;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
};

const optionsPanel = () => document.querySelector('.hud-options');
const readouts = () => document.querySelector('.hud-live');

afterEach(() => {
  for (const m of made) m.destroy();
  made.length = 0;
  document.body.replaceChildren();
});

describe('[Right] the column swaps its contents instead of vanishing', () => {
  it('shows the choices and hides the readouts while choosing', () => {
    // The whole point of the change the Dev asked for: "no próprio HUD antes de começar".
    hud().hud.setPhase('choosing');
    expect(shown(optionsPanel())).toBe(true);
    expect(shown(readouts())).toBe(false);
  });

  it('shows the readouts and hides the choices while playing', () => {
    hud().hud.setPhase('playing');
    expect(shown(readouts())).toBe(true);
    expect(shown(optionsPanel())).toBe(false);
  });

  it('never shows both at once, in either phase', () => {
    // ⚠️ The assertion a one-sided mutation escapes. Setting only `options.hidden` and forgetting
    // `live.hidden` leaves the score sitting under the settings, which reads as a game already
    // in progress on a screen that has not started one.
    const { hud: h } = hud();
    for (const phase of ['choosing', 'playing'] as const) {
      h.setPhase(phase);
      expect(shown(optionsPanel()) && shown(readouts()), phase).toBe(false);
    }
  });

  it('hides the keyboard help while choosing, because there is no mat to hammer', () => {
    const { hud: h } = hud();
    h.setPhase('choosing');
    expect(shown(document.querySelector('.hud-help'))).toBe(false);
    h.setPhase('playing');
    expect(shown(document.querySelector('.hud-help'))).toBe(true);
  });

  it('goes back and forth, which a round that ends and restarts does', () => {
    const { hud: h } = hud();
    h.setPhase('choosing');
    h.setPhase('playing');
    h.setPhase('choosing');
    expect(shown(optionsPanel())).toBe(true);
    expect(shown(readouts())).toBe(false);
  });
});

describe('[Right] the readouts come from the contract, not from the round', () => {
  it('reads the objective, the score and the goal', () => {
    hud({}, 7).hud.setPhase('playing');
    const text = readouts()!.textContent ?? '';
    expect(text).toContain(i18n.t(CATEGORIES[0].nameKey));
    expect(text).toContain('7');
    expect(text).toContain(String(ROUND_GOAL));
  });

  it('follows the score when it moves', () => {
    let have = 0;
    const { hud: h } = hud({
      declaration: { objectiveOf: () => declaration(have).objectiveOf(0) },
    });
    h.setPhase('playing');
    have = 12;
    h.refresh();
    expect(readouts()!.textContent).toContain('12');
  });
});

describe('[Right] the lives line reads for the mode it is in', () => {
  it('counts lives in the lives mode', () => {
    hud({ defeat: 'lives', livesLeft: () => 2 }).hud.setPhase('playing');
    expect(readouts()!.textContent).toContain(i18n.t('hud.lives', { lives: 2 }));
  });

  it('names the mode where there is no count to give', () => {
    // ⚠️ Showing "0" or an empty slot would both read as a STATE. An absence has to look like one.
    const { hud: h } = hud({ defeat: 'endless', livesLeft: () => null });
    h.setPhase('playing');
    expect(readouts()!.textContent).toContain(i18n.t('hud.endless'));

    h.setDefeat('sudden-death');
    expect(readouts()!.textContent).toContain(i18n.t('hud.suddenDeath'));
    expect(readouts()!.textContent).not.toContain(i18n.t('hud.endless'));
  });
});

describe('[Right] the high score is shown only when there is one', () => {
  it('says nothing at all on a first visit', () => {
    // ⚠️ "Recorde: 0" is not information, it is a reproach -- and the original shows its high
    // score only when there is a high score. `hidden` rather than an empty string, so the line
    // takes no space and a reader does not stop on it.
    const { hud: h } = hud({ best: () => 0 });
    h.setPhase('playing');
    expect(shown(document.querySelector('.hud-best'))).toBe(false);
  });

  it('shows the number once there is one to beat', () => {
    const { hud: h } = hud({ best: () => 14 });
    h.setPhase('playing');
    expect(shown(document.querySelector('.hud-best'))).toBe(true);
    expect(document.querySelector('.hud-best')!.textContent).toContain('14');
  });

  it('follows the record when a round beats it, without being rebuilt', () => {
    // It is read through a FUNCTION for exactly this: the round that beats the record is the same
    // round the HUD is already showing, and a number captured at boot would be one behind.
    let best = 0;
    const { hud: h } = hud({ best: () => best });
    h.setPhase('playing');
    expect(shown(document.querySelector('.hud-best'))).toBe(false);
    best = 8;
    h.refresh();
    expect(document.querySelector('.hud-best')!.textContent).toContain('8');
  });
});

describe('[Interface] the HUD is state, and does not announce itself', () => {
  it('is a group, never a live region', () => {
    // A HUD that announced itself would talk over every event the round already reports. The one
    // live region in this column belongs to the OPTION controls, which fire only on a user action.
    const root = hud().hud.root;
    expect(root.getAttribute('role')).toBe('group');
    expect(root.hasAttribute('aria-live')).toBe(false);
    expect(root.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(root.querySelector('[aria-live]')!.closest('.hud-options')).not.toBeNull();
  });
});
