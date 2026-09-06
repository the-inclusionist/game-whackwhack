// SPDX-License-Identifier: AGPL-3.0-or-later
// The three choices, now that they are controls in the HUD instead of a form in front of the game.
//
// ========================= WHAT THESE TESTS ARE GUARDING =========================
// The arrangement was rejected twice — three `<select>`s on the title card, then the same three
// folded into a `<details>` — and the instruction was explicit: "nada de menu desta forma, mas sim
// no próprio HUD antes de começar". So the shape itself is a requirement, and the tests below
// assert the SHAPE (a cycling button, a radio group) as much as the behaviour.
//
// The two failure modes worth naming, because neither is visible from a screenshot:
//
//   1. A cycler that does not wrap. Three values and a `Math.min` instead of a modulo gives a
//      control that reaches "hard" and stops, with nothing on screen to say it is stuck.
//   2. Eight radios that are not ONE control. Drop the shared `name` and they become eight
//      independent checkboxes: all eight can be on at once, arrow keys stop working, and a screen
//      reader stops saying "2 of 8". Everything still looks right.

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CATEGORIES, FACTORS, MULTIPLE_OF_3 } from '../app/js/rules/category.ts';
import { createI18n } from '../app/js/i18n/index.ts';
import { createOptions, type RoundChoice } from '../app/js/ui/options.ts';
import '../app/css/style.css';

const i18n = createI18n('pt');
const INITIAL: RoundChoice = { category: CATEGORIES[0], difficulty: 'easy', defeat: 'sudden-death' };

const made: { destroy(): void }[] = [];

function panel(over: Partial<Parameters<typeof createOptions>[0]> = {}) {
  const onChange = vi.fn();
  const options = createOptions({ doc: document, i18n, initial: INITIAL, onChange, ...over });
  document.body.appendChild(options.root);
  made.push(options);
  return { options, onChange };
}

const cyclers = () => [...document.querySelectorAll('.opt-cycle')] as HTMLButtonElement[];
const difficultyButton = () => cyclers()[0];
const defeatButton = () => cyclers()[1];
const radios = () => [...document.querySelectorAll('.opt-collect input')] as HTMLInputElement[];

beforeAll(async () => {
  // The stylesheet is imported for the target-size measurements at the bottom; without the faces
  // loaded the button heights are measured against a fallback and mean nothing.
  await document.fonts.ready;
});

afterEach(() => {
  for (const o of made) o.destroy();
  made.length = 0;
  document.body.replaceChildren();
});

describe('[Right] difficulty cycles through its three values and wraps', () => {
  it('starts on what it was handed', () => {
    panel();
    expect(difficultyButton().textContent).toContain(i18n.t('opt.easy'));
  });

  it('advances easy to medium to hard', () => {
    const { options } = panel();
    difficultyButton().click();
    expect(options.choice().difficulty).toBe('medium');
    difficultyButton().click();
    expect(options.choice().difficulty).toBe('hard');
  });

  it('WRAPS from hard back to easy', () => {
    // ⚠️ The Dev asked for this in so many words — "voltando ao fácil após clicar em difícil" —
    // and it is the assertion a clamp would fail while all the others passed.
    const { options } = panel({ initial: { ...INITIAL, difficulty: 'hard' } });
    difficultyButton().click();
    expect(options.choice().difficulty).toBe('easy');
  });

  it('returns to where it started after one full lap', () => {
    const { options } = panel();
    for (let i = 0; i < 3; i++) difficultyButton().click();
    expect(options.choice().difficulty).toBe('easy');
  });
});

describe('[Right] the defeat mode cycles the same way', () => {
  it('walks sudden death, hearts, invincible, and wraps', () => {
    const { options } = panel();
    expect(options.choice().defeat).toBe('sudden-death');
    defeatButton().click();
    expect(options.choice().defeat).toBe('lives');
    defeatButton().click();
    expect(options.choice().defeat).toBe('endless');
    defeatButton().click();
    expect(options.choice().defeat).toBe('sudden-death');
  });

  it('does not move the difficulty while it moves itself', () => {
    // Two cyclers built from one factory, and a shared `read`/`write` closure would move both.
    const { options } = panel();
    defeatButton().click();
    expect(options.choice().difficulty).toBe('easy');
  });
});

describe('[Interface] a cycler says what it is, not just what colour it is', () => {
  it('carries the value in its accessible name, where the emoji cannot', () => {
    // "🔴 Difícil" read literally is a coloured circle followed by the answer. The name has to
    // carry the label AND the value, or a reader hears a value with nothing to attach it to.
    panel({ initial: { ...INITIAL, difficulty: 'hard' } });
    const name = difficultyButton().getAttribute('aria-label') ?? '';
    expect(name).toContain(i18n.t('opt.difficulty'));
    expect(name).toContain(i18n.t('opt.hard'));
    expect(name).toContain(i18n.t('opt.cycle'));
  });

  it('updates that name when the value changes, not only the visible text', () => {
    panel();
    difficultyButton().click();
    expect(difficultyButton().getAttribute('aria-label')).toContain(i18n.t('opt.medium'));
    expect(difficultyButton().getAttribute('aria-label')).not.toContain(i18n.t('opt.easy'));
  });

  it('is a real button, so Enter and Space come from the platform', () => {
    panel();
    for (const b of cyclers()) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.type).toBe('button');
    }
  });
});

describe('[Right] the eight factors are ONE control, not eight', () => {
  it('offers a chip for every shipped category, in factor order', () => {
    panel();
    expect(radios().map((r) => r.value)).toEqual(CATEGORIES.map((c) => c.id));
    expect(radios()).toHaveLength(FACTORS.length);
  });

  it('shows the factor on each chip', () => {
    panel();
    const faces = [...document.querySelectorAll('.opt-factor-face')].map((e) => e.textContent ?? '');
    FACTORS.forEach((factor, i) => expect(faces[i]).toContain(String(factor)));
  });

  it('shares ONE name, which is what makes them a single control', () => {
    // ⚠️ Drop this and they are eight checkboxes: all eight can be on at once, the arrow keys
    // stop moving between them, and a reader stops saying "2 of 8". Nothing looks different.
    panel();
    expect(new Set(radios().map((r) => r.name)).size).toBe(1);
    expect(radios().every((r) => r.type === 'radio')).toBe(true);
  });

  it('has exactly one checked, and it is the one it was handed', () => {
    panel({ initial: { ...INITIAL, category: MULTIPLE_OF_3 } });
    expect(radios().filter((r) => r.checked).map((r) => r.value)).toEqual([MULTIPLE_OF_3.id]);
  });

  it('changes the choice when another is picked', () => {
    const { options } = panel();
    radios()[4].click();
    expect(options.choice().category).toBe(CATEGORIES[4]);
  });

  it('hands back the CATEGORY, not its id', () => {
    // The round needs the predicate and the pool. An id would have to be resolved somewhere else,
    // and that somewhere would be a second place that knows the catalogue.
    const { options } = panel();
    radios()[3].click();
    const picked = options.choice().category;
    expect(typeof picked.isCorrect).toBe('function');
    expect(picked.pool.length).toBeGreaterThan(0);
    expect(picked.isCorrect(FACTORS[3])).toBe(true);
  });

  it('names each chip in words, because a keycap emoji reads as a keycap', () => {
    panel();
    radios().forEach((r, i) => {
      expect(r.getAttribute('aria-label')).toBe(i18n.t('opt.collectOne', { n: FACTORS[i] }));
    });
  });

  it('keeps the input focusable, so the chip is reachable without a mouse', () => {
    // `.sr-only` is the clip-path recipe on purpose: `display: none` and `visibility: hidden`
    // would both take the radio out of the tab order and out of the accessibility tree, which
    // is the entire reason for it being a radio.
    panel();
    radios()[2].focus();
    expect(document.activeElement).toBe(radios()[2]);
  });
});

describe('[Right] the panel reports every change to its owner', () => {
  it('fires on a cycle and on a pick', () => {
    const { onChange } = panel();
    difficultyButton().click();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ difficulty: 'medium' }));
    radios()[2].click();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ category: CATEGORIES[2] }));
  });

  it('does not fire before anything is touched', () => {
    const { onChange } = panel();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('[Right] a cycle is announced, and a pick is left to the platform', () => {
  const status = () => document.querySelector('.hud-options [role="status"]') as HTMLElement;

  it('has the live region in the document from the start, and empty', () => {
    // ⚠️ A live region inserted at the same moment its text is set is not announced by most
    // screen readers — it has to be there to be watched. This is the commonest way an
    // `aria-live` that "does not work" fails.
    panel();
    expect(status()).not.toBeNull();
    expect(status().getAttribute('aria-live')).toBe('polite');
    expect(status().textContent).toBe('');
  });

  it('says the new value after a cycle', () => {
    panel();
    defeatButton().click();
    expect(status().textContent).toContain(i18n.t('opt.lives'));
  });

  it('stays SILENT when a radio is picked, because the radio announces itself', () => {
    // Saying it here as well read "Toque para coletar múltiplos de:: múltiplos de 5" aloud,
    // colon and all, on top of what the platform had already said.
    panel();
    radios()[3].click();
    expect(status().textContent).toBe('');
  });
});

describe('[Interface] every word in the panel is translated', () => {
  it.each(['pt', 'en', 'es'] as const)('has no raw key and no unfilled placeholder in %s', (code) => {
    const local = createI18n(code);
    panel({ i18n: local });
    const scope = document.querySelector('.hud-options') as HTMLElement;
    for (const el of [scope, ...scope.querySelectorAll('*')]) {
      const text = el.textContent ?? '';
      expect(text, code).not.toMatch(/\b(opt|obj)\.[a-zA-Z]/);
      expect(text, code).not.toMatch(/\{\w+\}/);
    }
    for (const el of scope.querySelectorAll('[aria-label]')) {
      const name = el.getAttribute('aria-label') ?? '';
      expect(name, code).not.toMatch(/\b(opt|obj)\.[a-zA-Z]/);
      expect(name, code).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('[Boundary] the targets are big enough to hit', () => {
  it('gives every control at least 44 CSS pixels of height', () => {
    // WCAG 2.5.5. These sit OUTSIDE #game-region, where `--tap` is defined, so they carry the
    // floor in the stylesheet themselves — which means only a rendered measurement can check it.
    panel();
    const targets = [...cyclers(), ...document.querySelectorAll('.opt-factor-face')];
    for (const el of targets) {
      expect(el.getBoundingClientRect().height, el.className).toBeGreaterThanOrEqual(44);
    }
  });
});
