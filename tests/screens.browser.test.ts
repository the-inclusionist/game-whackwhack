// SPDX-License-Identifier: AGPL-3.0-or-later
// The title and the result — the two screens whose absence made this a mechanism rather than a
// game. Without them a round in `lives` mode ended after about thirty seconds and the mat sat
// empty forever, with no button on the page and no way back except reloading.
//
// Every module was individually tested when that was true. The hole was BETWEEN them: "is there
// anything to do once the round ends" belongs to no module, so no module's tests asked it. These
// are the tests that ask.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUND_GOAL } from '../app/js/rules/difficulty.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createResultScreen, createTitleScreen } from '../app/js/ui/screens.ts';

const made: { destroy(): void }[] = [];
const i18n = createI18n('pt');

function title(over: Partial<Parameters<typeof createTitleScreen>[0]> = {}) {
  const onStart = vi.fn();
  const screen = createTitleScreen({ doc: document, i18n, onStart, ...over });
  document.body.appendChild(screen.root);
  made.push(screen);
  return { screen, onStart };
}

function result(over: Partial<Parameters<typeof createResultScreen>[0]> = {}) {
  const onAgain = vi.fn();
  const onChange = vi.fn();
  const screen = createResultScreen({
    doc: document, i18n, outcome: 'lost', hits: 7, need: ROUND_GOAL, level: 3,
    onAgain, onChange, ...over,
  });
  document.body.appendChild(screen.root);
  made.push(screen);
  return { screen, onAgain, onChange };
}

const buttons = () => [...document.querySelectorAll('.screen button')] as HTMLButtonElement[];

afterEach(() => {
  for (const s of made) s.destroy();
  made.length = 0;
  document.body.replaceChildren();
});

describe('[Interface] both screens are honest dialogs', () => {
  it.each([['title', title], ['result', result]] as const)('%s is a labelled dialog', (_n, make) => {
    make();
    const root = document.querySelector('.screen')!;
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-labelledby')).toBe('screen-heading');
  });

  it('makes the RESULT modal, because there is a dead board behind it', () => {
    expect(result().screen.modal).toBe(true);
    expect(document.querySelector('.screen')!.getAttribute('aria-modal')).toBe('true');
  });

  it('does NOT make the title modal, because the options live outside it', () => {
    // ⚠️ THE ASSERTION THAT PROTECTS THE OPTION PANEL. `aria-modal="true"` removes everything
    // outside the dialog from the accessibility tree, and everything outside the title dialog
    // includes the three controls the player is there to use. It went back to modal once, and
    // the symptom was a HUD a screen reader could not find while a sighted player could.
    expect(title().screen.modal).toBe(false);
    expect(document.querySelector('.screen')!.hasAttribute('aria-modal')).toBe(false);
  });

  it.each([['title', title], ['result', result]] as const)('%s puts focus on the HEADING', (_n, make) => {
    // ⚠️ Not on the first button. A reader announces what this screen IS before offering what can
    // be done on it; focusing "Play again" first says that to someone never told they had lost.
    make().screen.focus();
    expect(document.activeElement).toBe(document.querySelector('.screen-title'));
    expect(document.activeElement!.tagName).toBe('H1');
  });

  it.each([['title', title], ['result', result]] as const)('%s uses real buttons', (_n, make) => {
    make();
    for (const b of buttons()) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.type).toBe('button');
      expect(b.textContent!.trim()).not.toBe('');
    }
    expect(buttons().length).toBeGreaterThan(0);
  });
});

describe('[Right] the title is the name and the way in, and nothing else', () => {
  it('offers exactly one control: the word that starts the game', () => {
    // ⚠️ The count is the point. Three `<select>`s stood here, then a `<details>` holding the
    // same three, and both were rejected as a form in front of an arcade game. The choices are
    // in the HUD now (tests/options.browser.test.ts), so anything that reappears here is a
    // regression towards the arrangement that was turned down twice.
    title();
    expect(buttons()).toHaveLength(1);
    expect(document.querySelectorAll('.screen select, .screen details, .screen input')).toHaveLength(0);
  });

  it('starts on the word, with no argument to carry a choice', () => {
    const { onStart } = title();
    buttons()[0].click();
    expect(onStart).toHaveBeenCalledWith();
  });

  it('starts on a click of the backdrop, which is what the original does', () => {
    const { onStart } = title();
    (document.querySelector('.screen') as HTMLElement).click();
    expect(onStart).toHaveBeenCalled();
  });

  it('does NOT start on a click inside the card, which would eat every other control', () => {
    const { onStart } = title();
    (document.querySelector('.screen-card') as HTMLElement).click();
    expect(onStart).not.toHaveBeenCalled();
  });
});

describe('[Right] the result says what happened, and offers a way on', () => {
  it('reads differently for a win and a loss', () => {
    result({ outcome: 'won' });
    const won = document.querySelector('.screen-title')!.textContent;
    made.pop()!.destroy();
    document.body.replaceChildren();
    result({ outcome: 'lost' });
    expect(document.querySelector('.screen-title')!.textContent).not.toBe(won);
  });

  it.each(['won', 'lost'] as const)('carries the %s outcome for the stylesheet', (outcome) => {
    // ⚠️ BOTH, and the first version only checked 'won' — so hard-coding the attribute to 'won'
    // passed it. A losing screen styled as a win is the one place this attribute is load-bearing.
    result({ outcome });
    expect((document.querySelector('.screen') as HTMLElement).dataset.outcome).toBe(outcome);
  });

  it('shows the score and the level reached', () => {
    result({ hits: 7, level: 3 });
    const text = document.querySelector('.screen-card')!.textContent!;
    expect(text).toContain('7');
    expect(text).toContain(String(ROUND_GOAL));
    expect(text).toContain('3');
  });

  it('offers BOTH playing again and changing the options', () => {
    // ⚠️ The one that matters. A result screen with no way forward is the bug this file exists
    // for: it looks finished and is a dead end.
    const { onAgain, onChange } = result();
    expect(buttons()).toHaveLength(2);
    buttons()[0].click();
    expect(onAgain).toHaveBeenCalled();
    buttons()[1].click();
    expect(onChange).toHaveBeenCalled();
  });
});

describe('[Zero] a screen cleans up after itself', () => {
  it('leaves nothing in the document', () => {
    const { screen } = title();
    expect(document.querySelector('.screen')).not.toBeNull();
    screen.destroy();
    expect(document.querySelector('.screen')).toBeNull();
  });
});

describe('[Interface] every word on both screens is translated', () => {
  it.each(['pt', 'en', 'es'] as const)('has no raw key anywhere in %s', (locale) => {
    const local = createI18n(locale);
    const t = createTitleScreen({ doc: document, i18n: local, onStart: vi.fn() });
    const r = createResultScreen({
      doc: document, i18n: local, outcome: 'won', hits: 20, need: ROUND_GOAL, level: 4,
      onAgain: vi.fn(), onChange: vi.fn(),
    });
    document.body.append(t.root, r.root);
    made.push(t, r);

    for (const el of document.querySelectorAll('.screen *')) {
      const text = el.textContent ?? '';
      expect(text, locale).not.toMatch(/\b(opt|obj|title|result|game)\.[a-zA-Z]/);
      expect(text, locale).not.toMatch(/\{\w+\}/);
    }
  });
});
