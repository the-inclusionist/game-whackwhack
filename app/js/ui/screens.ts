// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/screens — the title and the result, which are what turn a round into a game.
//
// ========================= WHY THESE EXIST AT ALL =========================
// ⚠️ They were missing, and their absence was not a missing feature — it was a game that stopped
// working after about thirty seconds and said nothing. Three missed waves ends a round in `lives`
// mode; the mat then went empty and stayed empty forever, with no button anywhere on the page and
// no way back except reloading. A blind player at least got the `srAlert`; a sighted one got a
// grey rectangle. Every module was individually tested and the hole was between them, because
// "is there anything to do once the round ends" belongs to no module.
//
// ========================= DOM, LIKE THE HUD AND FOR THE SAME REASONS =========================
// At the size this game rasterises, canvas text is illegible, does not scale with the reader's own
// type setting, and is invisible to a screen reader. So these are real headings, real `<select>`s
// and real `<button>`s, which also means arrow keys, Tab, Enter and Space work because the platform
// makes them work.
//
// ========================= AND THEY ARE MODAL, HONESTLY =========================
// `role="dialog"` with `aria-modal`, focus moved onto the heading when shown, and `inert` on the
// region behind. Without the last one a screen reader user tabs straight off the dialog into
// twenty mat buttons that are not playable — the reading order would say the game is still there
// when it is over.

import type { Category } from '../rules/category.ts';
import type { Difficulty } from '../rules/difficulty.ts';
import type { DefeatMode } from '../rules/defeat.ts';
import type { I18n } from '../i18n/index.ts';

export interface RoundChoice {
  readonly category: Category;
  readonly difficulty: Difficulty;
  readonly defeat: DefeatMode;
}

export interface Screen {
  readonly root: HTMLElement;
  /** Moves focus in. Called after the screen is in the document, never before. */
  focus(): void;
  destroy(): void;
}

interface ShellDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  readonly labelKey: string;
}

/** The common casing: a modal card with a heading that takes focus. */
function shell(deps: ShellDeps): { root: HTMLElement; card: HTMLElement; heading: HTMLElement } {
  const root = deps.doc.createElement('div');
  root.className = 'screen';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');

  const card = deps.doc.createElement('div');
  card.className = 'screen-card';

  const heading = deps.doc.createElement('h1');
  heading.className = 'screen-title';
  heading.textContent = deps.i18n.t(deps.labelKey);
  // ⚠️ Focus lands on the HEADING, not on the first button. A reader then announces what this
  // screen IS before offering what can be done on it; focusing the button first says "Start"
  // to someone who was never told they had lost.
  heading.tabIndex = -1;

  root.setAttribute('aria-labelledby', 'screen-heading');
  heading.id = 'screen-heading';

  card.appendChild(heading);
  root.appendChild(card);
  return { root, card, heading };
}

function labelledSelect(
  doc: Document,
  labelText: string,
  options: readonly { value: string; label: string }[],
  initial: string,
): { row: HTMLElement; select: HTMLSelectElement } {
  const row = doc.createElement('p');
  row.className = 'screen-row';

  const label = doc.createElement('label');
  label.textContent = labelText;

  const select = doc.createElement('select');
  for (const option of options) {
    const el = doc.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    select.appendChild(el);
  }
  select.value = initial;

  // A real <label for> rather than aria-label: it also makes the words a click target, which is
  // a bigger one than the select itself on a touch screen.
  const id = `opt-${labelText.replace(/\W+/g, '-').toLowerCase()}`;
  select.id = id;
  label.htmlFor = id;

  row.append(label, select);
  return { row, select };
}

export interface TitleScreenDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  readonly categories: readonly Category[];
  readonly initial: RoundChoice;
  onStart(choice: RoundChoice): void;
}

export function createTitleScreen(deps: TitleScreenDeps): Screen {
  const { doc, i18n } = deps;
  const { root, card, heading } = shell({ doc, i18n, labelKey: 'game.title' });

  const lead = doc.createElement('p');
  lead.className = 'screen-lead';
  lead.textContent = i18n.t('title.lead');
  card.appendChild(lead);

  const category = labelledSelect(
    doc,
    i18n.t('opt.category'),
    deps.categories.map((c) => ({ value: c.id, label: i18n.t(c.nameKey) })),
    deps.initial.category.id,
  );
  const difficulty = labelledSelect(
    doc,
    i18n.t('opt.difficulty'),
    (['easy', 'medium', 'hard'] as const).map((d) => ({ value: d, label: i18n.t(`opt.${d}`) })),
    deps.initial.difficulty,
  );
  const defeat = labelledSelect(
    doc,
    i18n.t('opt.defeat'),
    [
      { value: 'lives', label: i18n.t('opt.lives') },
      { value: 'sudden-death', label: i18n.t('opt.suddenDeath') },
      { value: 'endless', label: i18n.t('opt.endless') },
    ],
    deps.initial.defeat,
  );
  card.append(category.row, difficulty.row, defeat.row);

  const start = doc.createElement('button');
  start.type = 'button';
  start.className = 'screen-action';
  start.textContent = i18n.t('title.start');
  start.addEventListener('click', () => {
    deps.onStart({
      category: deps.categories.find((c) => c.id === category.select.value) ?? deps.categories[0],
      difficulty: difficulty.select.value as Difficulty,
      defeat: defeat.select.value as DefeatMode,
    });
  });
  card.appendChild(start);

  return {
    root,
    focus() { heading.focus(); },
    destroy() { root.remove(); },
  };
}

export interface ResultScreenDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  readonly outcome: 'won' | 'lost';
  readonly hits: number;
  readonly need: number;
  readonly level: number;
  onAgain(): void;
  onChange(): void;
}

export function createResultScreen(deps: ResultScreenDeps): Screen {
  const { doc, i18n } = deps;
  const { root, card, heading } = shell({
    doc, i18n, labelKey: deps.outcome === 'won' ? 'result.won' : 'result.lost',
  });
  root.dataset.outcome = deps.outcome;

  const score = doc.createElement('p');
  score.className = 'screen-lead';
  score.textContent = i18n.t('result.score', { have: deps.hits, need: deps.need });

  const level = doc.createElement('p');
  level.className = 'screen-sub';
  level.textContent = i18n.t('result.level', { level: deps.level });

  const again = doc.createElement('button');
  again.type = 'button';
  again.className = 'screen-action';
  again.textContent = i18n.t('result.again');
  again.addEventListener('click', () => deps.onAgain());

  const change = doc.createElement('button');
  change.type = 'button';
  change.className = 'screen-secondary';
  change.textContent = i18n.t('result.change');
  change.addEventListener('click', () => deps.onChange());

  card.append(score, level, again, change);

  return {
    root,
    focus() { heading.focus(); },
    destroy() { root.remove(); },
  };
}
