// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/options — the three choices, as controls in the HUD rather than a form in front of the game.
//
// ========================= WHERE THIS CAME FROM =========================
// ⚠️ THE OPTIONS WERE A `<details>` MENU ON THE TITLE CARD, AND THAT WAS WRONG TWICE OVER.
//
// The first time, they were three `<select>`s standing between the player and the game, and the
// Dev's verdict was that the game had stopped being whackwhack. The fix put them behind a
// disclosure triangle — which moved the form without answering the objection, because a menu is
// still a menu when it is folded up. The instruction this file implements is explicit: "nada de
// menu desta forma, mas sim no próprio HUD antes de começar".
//
// So the choices sit in the HUD column, beside the score they will replace, and they are visible
// exactly while the title is up. Nothing is nested, nothing has to be opened, and a teacher
// setting the exercise does it in the same place the child will read their score.
//
// ========================= TAP TO CYCLE, EXCEPT WHERE IT WOULD LIE =========================
// Difficulty and defeat are single buttons that advance through their values and wrap — the Dev's
// shape, and the right one for three values in a narrow column.
//
// The eight factors are NOT a cycler, and the difference is not taste. Cycling eight values means
// up to seven taps to reach one, and it hides the other seven, so a child cannot see that "5" is
// on offer. They are eight real radio buttons in a `<fieldset>`: the platform then supplies arrow
// keys, the grouping a screen reader announces, and the single-selection semantics — none of
// which would come free from eight `<button aria-pressed>`s, and all of which would then have to
// be hand-built and would end up half-built.
//
// ========================= THIS ONE DOES ANNOUNCE, AND THE HUD DOES NOT =========================
// `ui/hud` says in its own header that it never writes to a live region, because a HUD is STATE:
// consulted, not narrated, and a score announced every frame is chatter. That reasoning does not
// reach these, because they are CONTROLS. A cycling button changes its own accessible name under
// the reader's cursor, which is the one case where a name change is a fact the user just caused
// and needs told back. The live region below fires on nothing but a click or a keypress.

import type { Category } from '../rules/category.ts';
import { CATEGORIES, FACTORS } from '../rules/category.ts';
import { PACES, type Difficulty, type Pace } from '../rules/difficulty.ts';
import type { DefeatMode } from '../rules/defeat.ts';
import type { I18n } from '../i18n/index.ts';

/** What a round is started with. Produced here, consumed by the composition root. */
export interface RoundChoice {
  readonly category: Category;
  readonly difficulty: Difficulty;
  readonly defeat: DefeatMode;
  /** How much time every tile gets, as a multiplier. See `rules/difficulty`. */
  readonly pace: Pace;
}

/**
 * ⚠️ THE EMOJI LIVE IN CODE, NOT IN THE CATALOGUES, and that is a translation decision rather
 * than a filing one. A red circle means the same thing in pt, en and es, so putting it in three
 * dictionaries creates three chances for it to differ and none for it to improve. The WORDS beside
 * it are translated, which is the actual division of labour: the frame translates, the symbol
 * crosses — the same rule the numerals on the tiles already follow.
 */
const DIFFICULTY_MARK: Readonly<Record<Difficulty, string>> = {
  easy: '🟢', medium: '🟡', hard: '🔴',
};
const DEFEAT_MARK: Readonly<Record<DefeatMode, string>> = {
  'sudden-death': '💀', lives: '❤️❤️❤️', endless: '⭐',
};
/**
 * 🔴 CLOCK FACES, AND THE HOUR IS THE MULTIPLIER: 🕐 is one, 🕑 two, 🕔 five, 🕙 ten.
 *
 * ⚠️ NOT ANIMALS, and not a tortoise. This ring is an ACCOMMODATION and not a difficulty — the
 * plan says of the engine's own easy mode that mixing the two is «oferecer acessibilidade como se
 * fosse modo bebê». A child who needs twelve seconds instead of five is playing the same game,
 * and a mark that comments on her is the one thing this control must not do. A clock says how
 * much time and says nothing else.
 */
const PACE_MARK: Readonly<Record<Pace, string>> = {
  1: '🕐', 2: '🕑', 5: '🕔', 10: '🕙',
};

/** The order the buttons walk, and they wrap: hard goes back to easy, as the Dev specified. */
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
const DEFEATS: readonly DefeatMode[] = ['sudden-death', 'lives', 'endless'];

const DIFFICULTY_KEY: Readonly<Record<Difficulty, string>> = {
  easy: 'opt.easy', medium: 'opt.medium', hard: 'opt.hard',
};
const DEFEAT_KEY: Readonly<Record<DefeatMode, string>> = {
  'sudden-death': 'opt.suddenDeath', lives: 'opt.lives', endless: 'opt.endless',
};
const PACE_KEY: Readonly<Record<Pace, string>> = {
  1: 'opt.pace1', 2: 'opt.pace2', 5: 'opt.pace5', 10: 'opt.pace10',
};

/** `2️⃣` and friends: the digit, then VARIATION SELECTOR-16, then COMBINING ENCLOSING KEYCAP. */
function keycap(digit: number): string {
  return `${digit}️⃣`;
}

export interface OptionsDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  readonly initial: RoundChoice;
  /** Fired after any change, so the caller can persist or preview it. */
  onChange?(choice: RoundChoice): void;
}

export interface Options {
  readonly root: HTMLElement;
  choice(): RoundChoice;
  destroy(): void;
}

export function createOptions(deps: OptionsDeps): Options {
  const { doc, i18n } = deps;

  let difficulty = deps.initial.difficulty;
  let defeat = deps.initial.defeat;
  let category = deps.initial.category;
  let pace = deps.initial.pace;

  const root = doc.createElement('section');
  root.className = 'hud-options';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', i18n.t('opt.group'));

  /**
   * ⚠️ IN THE DOM FROM THE START, and empty. A live region added to the document at the same
   * moment its text is set is not announced by most screen readers — the region has to be there
   * to be watched. This is the single most common way an `aria-live` that "does not work" fails.
   */
  const said = doc.createElement('p');
  said.className = 'sr-only';
  said.setAttribute('role', 'status');
  said.setAttribute('aria-live', 'polite');

  function announce(labelKey: string, value: string): void {
    said.textContent = i18n.t('opt.now', { label: i18n.t(labelKey), value });
  }

  function changed(): void {
    deps.onChange?.(current());
  }

  /**
   * A button that walks a list and wraps. It carries the value in its VISIBLE text and again in
   * its accessible name, because the visible text is a mark plus a word and the mark has no
   * reading — "🔴 Difícil" announced literally is a coloured circle followed by the answer.
   */
  function cycler<T>(
    labelKey: string,
    values: readonly T[],
    markOf: (value: T) => string,
    keyOf: (value: T) => string,
    read: () => T,
    write: (value: T) => void,
  ): HTMLButtonElement {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'opt-cycle';

    function paint(): void {
      const value = read();
      const word = i18n.t(keyOf(value));
      button.textContent = `${markOf(value)} ${word}`;
      // "Dificuldade: Difícil, toque para mudar" — what it is, what it says, and what a tap does.
      button.setAttribute('aria-label', `${i18n.t('opt.now', {
        label: i18n.t(labelKey), value: word,
      })}, ${i18n.t('opt.cycle')}`);
    }

    button.addEventListener('click', () => {
      const next = values[(values.indexOf(read()) + 1) % values.length];
      write(next);
      paint();
      announce(labelKey, i18n.t(keyOf(next)));
      changed();
    });

    paint();
    return button;
  }

  const difficultyButton = cycler(
    'opt.difficulty', DIFFICULTIES,
    (d) => DIFFICULTY_MARK[d], (d) => DIFFICULTY_KEY[d],
    () => difficulty, (d) => { difficulty = d; },
  );

  const defeatButton = cycler(
    'opt.defeat', DEFEATS,
    (m) => DEFEAT_MARK[m], (m) => DEFEAT_KEY[m],
    () => defeat, (m) => { defeat = m; },
  );

  // ⚠️ The WCAG 2.2.1 control, and it is a cycler like the other two because it is a choice a
  // child makes BEFORE the clock starts — which is the form the criterion asks for: adjustable
  // "before encountering" the limit, not rescued after it.
  const paceButton = cycler(
    'opt.pace', PACES,
    (v) => PACE_MARK[v], (v) => PACE_KEY[v],
    () => pace, (v) => { pace = v; },
  );

  // ========================= THE EIGHT FACTORS =========================
  const collect = doc.createElement('fieldset');
  collect.className = 'opt-collect';
  const legend = doc.createElement('legend');
  legend.textContent = i18n.t('opt.collect');
  collect.appendChild(legend);

  const radios: HTMLInputElement[] = [];
  CATEGORIES.forEach((option, index) => {
    const factor = FACTORS[index];
    const label = doc.createElement('label');
    label.className = 'opt-factor';

    const input = doc.createElement('input');
    input.type = 'radio';
    // One name for the group. It is what makes the eight a single control to the platform, and
    // therefore what makes arrow keys move between them instead of tabbing through all eight.
    input.name = 'opt-collect';
    input.value = option.id;
    input.className = 'sr-only';
    input.checked = option.id === category.id;
    // ⚠️ The visible glyph is a keycap emoji, which a screen reader reads as a keycap. The name
    // it is given here is the objective in words, which is also what the HUD will show once the
    // round starts — the same fact, said the same way, in both places.
    input.setAttribute('aria-label', i18n.t('opt.collectOne', { n: factor }));
    // ⚠️ NO `announce()` HERE, deliberately. A radio announces its own name and checked state
    // when it is selected — that is what makes it worth being a radio — so writing the same fact
    // into the live region says it twice. It did, and the second copy read
    // "Toque para coletar múltiplos de:: múltiplos de 5", colon and all, because the legend
    // already ends in one. The cyclers below keep their announcement because a `<button>` whose
    // NAME changes under the cursor has no such guarantee.
    input.addEventListener('change', () => {
      if (!input.checked) return;
      category = option;
      changed();
    });

    const face = doc.createElement('span');
    face.className = 'opt-factor-face';
    face.textContent = keycap(factor);
    face.setAttribute('aria-hidden', 'true');

    label.append(input, face);
    collect.appendChild(label);
    radios.push(input);
  });

  root.append(difficultyButton, defeatButton, paceButton, collect, said);

  function current(): RoundChoice {
    return { category, difficulty, defeat, pace };
  }

  return {
    root,
    choice: current,
    destroy() {
      root.remove();
      radios.length = 0;
    },
  };
}
