// SPDX-License-Identifier: AGPL-3.0-or-later
// The title and the result — the two screens whose absence made this a mechanism rather than a
// game. Without them a round in `lives` mode ended after about thirty seconds and the mat sat
// empty forever, with no button on the page and no way back except reloading.
//
// Every module was individually tested when that was true. The hole was BETWEEN them: "is there
// anything to do once the round ends" belongs to no module, so no module's tests asked it. These
// are the tests that ask.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES, EVEN, MULTIPLE_OF_3 } from '../app/js/rules/category.ts';
import { ROUND_GOAL } from '../app/js/rules/difficulty.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createResultScreen, createTitleScreen, type RoundChoice } from '../app/js/ui/screens.ts';

const made: { destroy(): void }[] = [];
const i18n = createI18n('pt');
const INITIAL: RoundChoice = { category: EVEN, difficulty: 'medium', defeat: 'lives' };

function title(over: Partial<Parameters<typeof createTitleScreen>[0]> = {}) {
  const onStart = vi.fn();
  const screen = createTitleScreen({
    doc: document, i18n, categories: CATEGORIES, initial: INITIAL, onStart, ...over,
  });
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

const selects = () => [...document.querySelectorAll('.screen select')] as HTMLSelectElement[];
const buttons = () => [...document.querySelectorAll('.screen button')] as HTMLButtonElement[];

afterEach(() => {
  for (const s of made) s.destroy();
  made.length = 0;
  document.body.replaceChildren();
});

describe('[Interface] both screens are honest dialogs', () => {
  it.each([['title', title], ['result', result]] as const)('%s is a modal dialog', (_name, make) => {
    make();
    const root = document.querySelector('.screen')!;
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('true');
    expect(root.getAttribute('aria-labelledby')).toBe('screen-heading');
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

describe('[Right] the title offers every choice the rules support', () => {
  it('offers all three categories', () => {
    title();
    const options = [...selects()[0].options].map((o) => o.value);
    expect(options).toEqual(CATEGORIES.map((c) => c.id));
  });

  it('offers all three difficulties and all three defeat modes', () => {
    title();
    expect([...selects()[1].options].map((o) => o.value)).toEqual(['easy', 'medium', 'hard']);
    expect([...selects()[2].options].map((o) => o.value).sort())
      .toEqual(['endless', 'lives', 'sudden-death']);
  });

  it('names every option through the catalogue, never as a raw id', () => {
    title();
    for (const select of selects()) {
      for (const option of select.options) {
        expect(option.textContent!.trim()).not.toBe('');
        expect(option.textContent).not.toBe(option.value);
        expect(option.textContent).not.toMatch(/^(opt|obj)\./);
      }
    }
  });

  it('labels each select with a real <label for>', () => {
    // Also makes the words a click target, which is a bigger one than the select on a touchscreen.
    title();
    for (const select of selects()) {
      const label = document.querySelector(`label[for="${select.id}"]`);
      expect(label, select.id).not.toBeNull();
      expect(label!.textContent!.trim()).not.toBe('');
    }
  });

  it('opens on the choice it was handed', () => {
    title({ initial: { category: MULTIPLE_OF_3, difficulty: 'hard', defeat: 'endless' } });
    expect(selects()[0].value).toBe(MULTIPLE_OF_3.id);
    expect(selects()[1].value).toBe('hard');
    expect(selects()[2].value).toBe('endless');
  });
});

describe('[Right] starting hands back exactly what was chosen', () => {
  it('reports the picked category, difficulty and mode', () => {
    const { onStart } = title();
    selects()[0].value = MULTIPLE_OF_3.id;
    selects()[1].value = 'hard';
    selects()[2].value = 'sudden-death';
    buttons()[0].click();
    expect(onStart).toHaveBeenCalledWith({
      category: MULTIPLE_OF_3, difficulty: 'hard', defeat: 'sudden-death',
    });
  });

  it('hands back a real Category object, not its id', () => {
    // The round needs the predicate and the pool; an id would have to be resolved somewhere else,
    // and that somewhere would be a second place that knows the catalogue.
    const { onStart } = title();
    buttons()[0].click();
    const choice = onStart.mock.calls[0][0] as RoundChoice;
    expect(typeof choice.category.isCorrect).toBe('function');
    expect(choice.category.pool.length).toBeGreaterThan(0);
  });

  it('does not start until the button is pressed', () => {
    const { onStart } = title();
    selects()[1].value = 'hard';
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
    const t = createTitleScreen({
      doc: document, i18n: local, categories: CATEGORIES, initial: INITIAL, onStart: vi.fn(),
    });
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
