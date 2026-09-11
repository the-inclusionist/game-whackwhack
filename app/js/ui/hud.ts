// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud — score, level and what to collect, in the DOM over the canvas.
//
// ========================= WHY NOT IN THE CANVAS =========================
// Three reasons, all of them the chess game's and all of them still true here. At the size this
// game rasterises, canvas text is a handful of pixels tall and illegible. It does not scale with
// the reader's own type setting, so a child who has enlarged their system font gets nothing. And a
// screen reader cannot see it at all — the canvas is `aria-hidden`, deliberately.
//
// ========================= IT READS THE CONTRACT, NOT THE ROUND =========================
// `objectiveOf` already answers "how many of how many, of what" for the sonar and for the engine's
// own HUD. Reading the same field here means the number a sighted player sees and the number a
// blind player hears cannot drift, and it is why this file never imports rules/round.
//
// ========================= IT DOES NOT ANNOUNCE =========================
// Nothing here writes to a live region. The HUD is STATE — true until it changes, and consulted
// rather than narrated. Events are the composition root's business, through `srSay` and `srAlert`.
// Mixing the two produces both classic defects at once: a score announced every frame is
// chatter, and an end-of-round that is only readable on demand is never noticed.

import type { GameDeclaration } from '@the-inclusionist/engine/core/contract.js';
import type { DefeatMode } from '../rules/defeat.ts';
import type { I18n } from '../i18n/index.ts';

/** What the HUD needs of the declaration: the objective, and nothing else. */
export type HudDeclaration = Pick<GameDeclaration, 'objectiveOf'>;

export interface HudDeps {
  readonly doc: Document;
  readonly declaration: HudDeclaration;
  readonly i18n: I18n;
  readonly defeat: DefeatMode;
  /**
   * The option controls, built by `ui/options` and OWNED by the caller.
   *
   * ⚠️ Passed in rather than built here, and the reason is the same one that keeps this file from
   * importing rules/round: the HUD does not get to know what a round is configured with. It is a
   * host for the controls and a reader of the contract, and those two jobs do not meet.
   */
  readonly options: HTMLElement;
  /**
   * The engine's accessibility bar — blind mode, TTS, contrast, CVD, Libras.
   *
   * ⚠️ OWNED BY THE CALLER FOR A SHARPER REASON THAN `options` IS: this element's contents are
   * written by `createGame`, at boot, before the HUD exists. The HUD is given the element and
   * places it; what is inside it is not this file's business and never becomes it.
   */
  readonly icons: HTMLElement;
  /** Lives left, or `null` where the mode has none. */
  livesLeft(): number | null;
  level(): number;
  /**
   * The best score on this machine, or 0 for none yet.
   *
   * A function rather than a number because it changes WHILE the HUD is alive: a round that beats
   * it writes the new one, and the next round has to show that rather than the value that was
   * true at boot.
   */
  best(): number;
}

/**
 * Which half of the HUD is showing.
 *
 * ⚠️ THE HUD IS NO LONGER HIDDEN BEHIND THE TITLE. It used to be, and the reasoning was sound
 * while it held nothing but a score: a score behind the title reads as a game already going. Now
 * it also holds the three choices, which are to be made BEFORE starting — "no próprio HUD antes
 * de começar" — so the column stays up and swaps its contents instead of vanishing.
 */
export type HudPhase = 'choosing' | 'playing';

export interface Hud {
  readonly root: HTMLElement;
  /** Re-reads everything. Cheap, and called when something changed rather than every frame. */
  refresh(): void;
  /** The mode can change between rounds, and the lives line reads differently for each. */
  setDefeat(mode: DefeatMode): void;
  /** Swaps the options for the readouts, or back. */
  setPhase(phase: HudPhase): void;
  destroy(): void;
}

export function createHud(deps: HudDeps): Hud {
  const { doc, i18n } = deps;
  // Held rather than read from `deps` each time: the mode changes between rounds, and the HUD
  // outlives a round.
  let defeat = deps.defeat;

  const root = doc.createElement('div');
  root.className = 'hud';
  // ⚠️ NOT a live region. See the note above: this is state, and the engine's `srSay` carries
  // the events. A HUD that announced itself would talk over every wave.
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', i18n.t('game.title').replace(/\s+/g, ' '));

  const collect = doc.createElement('p');
  collect.className = 'hud-collect';

  const score = doc.createElement('p');
  score.className = 'hud-score';

  const level = doc.createElement('p');
  level.className = 'hud-level';

  const lives = doc.createElement('p');
  lives.className = 'hud-lives';

  const best = doc.createElement('p');
  best.className = 'hud-best';

  /**
   * Keyboard help, inside the HUD rather than under the stage.
   *
   * ⚠️ It used to be a paragraph below #stage-wrap, and that cost a whole step of the integer
   * upscale: 34 px of height turned 686/350 = 1.96 into a scale of 1 where 2 would otherwise fit.
   * The HUD already overlays the canvas, so putting it here is free.
   */
  const help = doc.createElement('p');
  help.className = 'hud-help';
  help.textContent = i18n.t('hud.help');

  /**
   * The readouts, boxed so the phase switch has ONE element to toggle rather than four.
   *
   * ⚠️ `hidden` needs a partner rule in the stylesheet wherever an author rule sets `display`.
   * `.hud { display: flex }` beat the browser's `display: none` once already and left the bar on
   * screen with the attribute set and nothing to show for it; `.hud-live[hidden]` is that lesson
   * applied before it can happen again.
   */
  const live = doc.createElement('div');
  live.className = 'hud-live';
  live.append(collect, score, level, lives, best);

  // ⚠️ THE BAR IS LAST IN THE COLUMN AND FIRST IN NOTHING. It is built and filled by the engine
  // (`boot/main` hands it over as `host.a11yBarHost`); the HUD only owns WHERE it sits, which is
  // the split the engine asks for — it can offer the icons and cannot guess a stranger's layout.
  root.append(deps.options, live, help, deps.icons);

  function refresh(): void {
    const objective = deps.declaration.objectiveOf(0);
    collect.textContent = i18n.t('hud.collect', { what: objective.name.text });
    score.textContent = `${i18n.t('hud.score')}: ${i18n.t('hud.of', {
      have: objective.have,
      need: objective.need,
    })}`;
    level.textContent = i18n.t('hud.level', { level: deps.level() });

    const left = deps.livesLeft();
    if (left === null) {
      // `endless` and `sudden-death` have no life count to show, and showing "0" or an empty
      // slot would both read as a state rather than as an absence. The mode's own name does.
      lives.textContent = i18n.t(
        defeat === 'endless' ? 'hud.endless' : 'hud.suddenDeath',
      );
    } else {
      lives.textContent = i18n.t('hud.lives', { lives: left });
    }

    /**
     * ⚠️ HIDDEN UNTIL THERE IS ONE. "Recorde: 0" on a first visit is not information, it is a
     * reproach — and the original shows its high score only when there is a high score. `hidden`
     * rather than an empty string, so the line takes no space AND a reader does not stop on it.
     *
     * ⚠️ AND THE TEXT IS WRITTEN UNCONDITIONALLY, which looks like the redundant half and is the
     * opposite. It was `record > 0 ? … : ''` as well, and the two guards MASKED EACH OTHER: with
     * both in place, breaking either one alone changed nothing observable, so both mutations
     * escaped and the whole behaviour was ungated while looking doubly protected. Belt and braces
     * is a fine instinct for a bridge and a bad one for a gate.
     */
    const record = deps.best();
    best.textContent = i18n.t('hud.best', { best: record });
    best.hidden = record <= 0;
  }

  refresh();

  return {
    root,
    refresh,
    setDefeat(mode) { defeat = mode; refresh(); },
    setPhase(phase) {
      const choosing = phase === 'choosing';
      deps.options.hidden = !choosing;
      live.hidden = choosing;
      // The keyboard help describes playing the mat, which is not what is on offer while the
      // choices are up — and a line about hammering under a row of settings is an instruction
      // for a control that is not there.
      help.hidden = choosing;
    },
    destroy() { root.remove(); },
  };
}
