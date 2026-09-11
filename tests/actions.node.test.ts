// SPDX-License-Identifier: AGPL-3.0-or-later
// Which of the engine's positions this game uses, and the word each one carries.
//
// ========================= VALIDATED BY THE ENGINE'S OWN CHECKERS =========================
// `presetProblems` and `actionSetProblems` come from `core/actions`, and using them rather than
// re-deriving the rules here is the same move the declaration makes with `conformanceProblems`:
// the engine decides what well-formed means, and a game that disagrees finds out from the engine
// rather than from a second opinion written next to the thing being judged.
//
// ⚠️ WHAT THEY CATCH IS THE EMPTY LABEL, and it is the same silent defect `speakableProblems`
// chases in the contract: a blank `label` breaks nothing, warns nobody, and leaves the remapping
// screen with a mute row — which for a child using a screen reader is a button that exists and has
// no name.

import { describe, expect, it } from 'vitest';
import {
  ACTIONS, actionSetProblems, labellerFrom, presetActions, presetProblems, shortLabellerFrom,
} from '@the-inclusionist/engine/core/actions.js';
import { HAMMER, USED, actionPreset } from '../app/js/input/actions.ts';
import { createI18n } from '../app/js/i18n/index.ts';

const i18n = createI18n('pt');
const preset = () => actionPreset((key) => i18n.t(key));

/** Echoes the key, so a test can tell a real lookup from a hardcoded string. */
const echo = (key: string): string => `<${key}>`;

describe('[Interface] the preset is well formed by the engine\'s own rules', () => {
  it('has no problems', () => {
    expect(presetProblems(preset())).toEqual([]);
  });

  it('names a non-empty set of actions', () => {
    expect(actionSetProblems(USED)).toEqual([]);
  });

  it('names only positions the engine knows', () => {
    // A typo — `actoin1` — would type-check nowhere and still be worth pinning: `USED` is data
    // that reaches a transport, and an unknown position binds to nothing in silence.
    for (const action of USED) expect(ACTIONS).toContain(action);
  });

  it('declares the same set the preset names', () => {
    // ⚠️ TWO LISTS THAT MUST AGREE. `USED` is what a transport binds; the preset is what a
    // remapping screen reads. One position in one and not the other is either a button that
    // cannot be remapped or a row on the screen that binds to nothing.
    expect(presetActions(preset())).toEqual([...USED]);
  });
});

describe('[Right] this game is four directions, one verb and the pause', () => {
  it('uses the four directions, because the mat is a grid', () => {
    for (const direction of ['up', 'down', 'left', 'right']) {
      expect(USED).toContain(direction);
    }
  });

  it('uses exactly ONE verb, and it is action1', () => {
    const verbs = USED.filter((a) => a.startsWith('action'));
    expect(verbs).toEqual(['action1']);
    expect(HAMMER).toBe('action1');
  });

  it('leaves the positions it does not use UNNAMED', () => {
    // ⚠️ A preset is partial on purpose. Declaring all fourteen would force this game to invent a
    // name for a trigger it does not have, and an invented name ends up on a remapping screen in
    // front of a child.
    const named = new Set(presetActions(preset()));
    for (const unused of ['action2', 'action3', 'action4', 'leftTrigger', 'rightShoulder']) {
      expect(named.has(unused as never), unused).toBe(false);
    }
  });

  it('names `start`, because engine 8.0.0 gave this game a pause screen', () => {
    // ⚠️ THIS TEST USED TO ASSERT THE OPPOSITE, and it was right until 2026-09-11: the game
    // declared `semMenuDePausa`, so naming a pause here "would promise a screen that does not
    // exist". ADR-0120 removed the decline — five of the six games in the catalogue had taken it,
    // and a child who needs blind mode or contrast opened those five and found nowhere to turn
    // them on. The screen exists now, and the promise is kept in `boot/main`'s `setPaused`.
    expect(USED).toContain('start');
    expect(labellerFrom(preset())('start')).toBe(i18n.t('act.pause'));
  });

});

describe('[Right] every word comes from the catalogue, never from the code', () => {
  it('looks up each label rather than spelling it', () => {
    // A remapping screen is a screen: a hardcoded "Martelar" would be the one string in this game
    // that pt, en and es share.
    const echoed = actionPreset(echo);
    for (const action of presetActions(echoed)) {
      expect(echoed[action]?.label, action).toMatch(/^<act\./);
    }
  });

  it('gives the verb and the pause a hint, and the directions none', () => {
    // The four directions explain themselves on a grid, and a hint that restates its own label is
    // noise on the screen that most needs to be short. The pause earns one for the opposite
    // reason: its label does NOT say what it opens, and blind mode, TTS, contrast and Libras all
    // live behind it.
    const p = preset();
    expect(p.action1?.hint).toBeTruthy();
    expect(p.start?.hint).toBe(i18n.t('act.pause.hint'));
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      expect(p[direction]?.hint, direction).toBeUndefined();
    }
  });

  it('gives every position a SHORT word that fits under a glyph', () => {
    const short = shortLabellerFrom(preset());
    for (const action of USED) {
      const word = short(action);
      expect(word, action).toBeTruthy();
      // The title legend puts the word under an icon in a row of four. Measured in the engine's
      // own note on `ActionWord.short`: "Correr / interagir" is what did not fit there.
      expect(word!.length, `${action}: ${word}`).toBeLessThanOrEqual(12);
    }
  });

  it('translates in all three languages, with no raw key surviving', () => {
    for (const code of ['pt', 'en', 'es'] as const) {
      const local = createI18n(code);
      const p = actionPreset((key) => local.t(key));
      for (const action of presetActions(p)) {
        expect(p[action]?.label, `${code}.${action}`).not.toMatch(/^act\./);
        expect(p[action]?.short, `${code}.${action}`).not.toMatch(/^act\./);
      }
    }
  });

  it('never puts an abstract position in front of a person', () => {
    // ⚠️ ADR-0074 calls this a defect in so many words: `action1` says nothing to anybody.
    const label = labellerFrom(preset());
    for (const action of USED) {
      expect(label(action), action).not.toMatch(/^action\d$/);
    }
  });
});
