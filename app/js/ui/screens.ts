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
// type setting, and is invisible to a screen reader. So these are real headings and real
// `<button>`s, which also means Tab, Enter and Space work because the platform makes them work.
//
// ========================= ONE OF THEM IS MODAL, AND ONLY ONE =========================
// The RESULT screen is: `aria-modal`, focus on the heading, `inert` on the region behind. Without
// the last one a reader tabs straight off the dialog into twenty mat buttons that are not
// playable, and the reading order says the game is still there when it is over.
//
// The TITLE screen is not, and `Screen.modal` below says why at length. In short: there is no
// round behind it to be protected from, and treating it as modal is what pushed the round's three
// choices onto the card — which is the arrangement the Dev rejected twice.

import type { I18n } from '../i18n/index.ts';

export interface Screen {
  readonly root: HTMLElement;
  /**
   * Whether the region behind is dead while this is up.
   *
   * ⚠️ THE TITLE IS NOT MODAL AND THE RESULT IS, and that difference is what lets the options
   * live in the HUD. Modality exists to stop a reader wandering into a board that cannot be
   * played; on the RESULT screen there is exactly such a board behind, and on the title there is
   * no round at all — the page is the title plus the choices that will start one. Making the
   * title modal is precisely what forced the choices onto the card, which is the arrangement the
   * Dev rejected. What is inert behind the title is the mat and its mirror, which really are
   * inoperable; the HUD column is not, because it is the control panel.
   */
  readonly modal: boolean;
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

export interface TitleScreenDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  /** No argument: the choices are read from the HUD's own controls, which never left the page. */
  onStart(): void;
}

/**
 * ========================= THE TITLE IS AN INVITATION, NOT A FORM =========================
 * ⚠️ This was a settings dialog with three dropdowns in front of the game, and that was the single
 * change that made this stop feeling like whackwhack. The original opens on its name and the word
 * PLAY, over a mat that is already alive; you click anywhere and you are playing. Putting a form
 * there turns an arcade game into a configurable app, and nobody asked for that — a decision about
 * RULES ("let the player pick the defeat mode") got read as licence over FORM.
 *
 * ⚠️ AND THE SECOND TRY WAS STILL WRONG. Folding the same three dropdowns into a `<details>`
 * moved the form without answering the objection — a menu is still a menu when it is closed. The
 * choices now live in the HUD column (`ui/options`), which is on screen while this is, so this
 * file is down to what the original actually shows: the name, floating, and the word to start.
 */
export function createTitleScreen(deps: TitleScreenDeps): Screen {
  const { doc, i18n } = deps;
  const { root, card, heading } = shell({ doc, i18n, labelKey: 'game.title' });
  root.classList.add('screen--title');
  // ⚠️ NOT `aria-modal`. `shell` sets it because the result screen needs it; the title takes it
  // back off, because `aria-modal="true"` removes everything outside this element from the
  // accessibility tree — and everything outside this element includes the option controls the
  // player is here to use. It stays a `dialog`, which is what it is: a thing on top with a
  // heading and a button.
  root.removeAttribute('aria-modal');
  // The mat behind is the point of the screen, so the veil is thin where the result screen's is
  // nearly opaque.
  root.dataset.veil = 'thin';

  /**
   * ========================= THE NAME IS TWO TYPEFACES =========================
   * "Whack / Whack" in Press Start 2P — the arcade face the original's parody lives in — and
   * "Schoolution" in Playwrite BR, which is the handwriting a Brazilian child is taught to form.
   * The joke of the name is the swap: the same word, moved from the wall to the blackboard.
   *
   * ⚠️ The heading keeps its ACCESSIBLE name from `game.title` on one line. Splitting the visible
   * text into two spans is a typographic decision, and a screen reader should not have to hear it.
   */
  heading.textContent = '';
  heading.setAttribute('aria-label', i18n.t('game.title'));

  const mark = doc.createElement('span');
  mark.className = 'title-mark';
  mark.textContent = i18n.t('title.mark');

  const school = doc.createElement('span');
  school.className = 'title-school';
  school.textContent = i18n.t('title.school');

  heading.append(mark, school);

  /**
   * ⚠️ STILL A BUTTON, and it only stops LOOKING like one.
   *
   * The word "Jogar" is what the original shows, and a `<div>` with a click handler would match it
   * exactly — while losing Enter, Space, the focus ring, the role a screen reader announces and the
   * place it takes in the tab order. Every one of those would then have to be re-implemented here,
   * and the usual outcome is that Enter works and Space does not.
   */
  const play = doc.createElement('button');
  play.type = 'button';
  play.className = 'title-play';
  play.textContent = i18n.t('title.play');
  play.addEventListener('click', () => deps.onStart());

  /**
   * ⚠️ CLICKING ANYWHERE STARTS, which is what the original does — but the button exists and is
   * focusable, because "click the screen" is not reachable by keyboard or by a screen reader. The
   * backdrop is a shortcut ON TOP of a real control, never instead of one.
   */
  root.addEventListener('click', (event) => {
    if (event.target === root) deps.onStart();
  });

  card.appendChild(play);

  return {
    root,
    modal: false,
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
    modal: true,
    focus() { heading.focus(); },
    destroy() { root.remove(); },
  };
}
