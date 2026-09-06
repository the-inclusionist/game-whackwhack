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
  /** Lives left, or `null` where the mode has none. */
  livesLeft(): number | null;
  level(): number;
}

export interface Hud {
  readonly root: HTMLElement;
  /** Re-reads everything. Cheap, and called when something changed rather than every frame. */
  refresh(): void;
  /** The mode can change between rounds, and the lives line reads differently for each. */
  setDefeat(mode: DefeatMode): void;
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
  root.setAttribute('aria-label', i18n.t('game.title'));

  const collect = doc.createElement('p');
  collect.className = 'hud-collect';

  const score = doc.createElement('p');
  score.className = 'hud-score';

  const level = doc.createElement('p');
  level.className = 'hud-level';

  const lives = doc.createElement('p');
  lives.className = 'hud-lives';

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

  root.append(collect, score, level, lives, help);

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
  }

  refresh();

  return {
    root,
    refresh,
    setDefeat(mode) { defeat = mode; refresh(); },
    destroy() { root.remove(); },
  };
}
