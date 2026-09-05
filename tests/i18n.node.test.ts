// SPDX-License-Identifier: AGPL-3.0-or-later
// The catalogues, held to each other.
//
// Three languages is a FLOOR in this family, not a goal, and the failure mode is never a wrong
// translation — it is a key that exists in pt and quietly does not in es, so one child gets a
// sentence and another gets a raw identifier. That is a set difference, and this file computes it.

import { describe, expect, it } from 'vitest';
import { availableLocales, createI18n, isLocale, preferredLocale } from '../app/js/i18n/index.ts';
import { pt } from '../app/js/i18n/pt.ts';
import { en } from '../app/js/i18n/en.ts';
import { es } from '../app/js/i18n/es.ts';
import type { Catalog, LocaleCode } from '../app/js/i18n/types.ts';
import { CATEGORIES } from '../app/js/rules/category.ts';

const CATALOGS: Readonly<Record<LocaleCode, Catalog>> = { pt, en, es };

describe('[Interface] the floor is three languages', () => {
  it('ships pt, en and es', () => {
    expect([...availableLocales()].sort()).toEqual(['en', 'es', 'pt']);
  });

  it('recognises exactly those', () => {
    expect(isLocale('pt')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });
});

describe('[Right] every catalogue carries every key', () => {
  const ptKeys = Object.keys(pt).sort();

  it.each(['en', 'es'] as const)('%s has the same key set as pt', (code) => {
    expect(Object.keys(CATALOGS[code]).sort()).toEqual(ptKeys);
  });

  it.each(['pt', 'en', 'es'] as const)('%s has no empty string', (code) => {
    // An empty translation is worse than a missing one: the fallback chain cannot see it, so it
    // reaches the screen reader as silence.
    for (const [key, value] of Object.entries(CATALOGS[code])) {
      expect(value.trim(), `${code}.${key}`).not.toBe('');
    }
  });

  it.each(['en', 'es'] as const)('%s uses the same placeholders as pt', (code) => {
    // A phrase that drops `{value}` in one language announces a hit without saying what was hit.
    // Word order may differ freely; the SET of parameters may not.
    const holders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of ptKeys) {
      expect(holders(CATALOGS[code][key]), `${code}.${key}`).toEqual(holders(pt[key]));
    }
  });
});

describe('[Right] every key the code asks for exists', () => {
  it('has a name for every shipped category', () => {
    // The one link between the rules layer and the catalogue, and the one that breaks silently:
    // adding a category is a data change, and forgetting its name shows up as `obj.multiplesOf5`
    // spoken aloud.
    for (const category of CATEGORIES) {
      expect(Object.keys(pt), category.id).toContain(category.nameKey);
    }
  });
});

describe('[Right] lookup falls back rather than failing', () => {
  it('returns the translation for the current locale', () => {
    const i18n = createI18n('en');
    expect(i18n.t('mat.empty')).toBe('empty');
    i18n.setLocale('es');
    expect(i18n.t('mat.empty')).toBe('vacía');
  });

  it('returns the KEY for something that does not exist', () => {
    // Ugly on screen and therefore fixed. Silence would not be.
    expect(createI18n('pt').t('nope.missing')).toBe('nope.missing');
  });

  it('interpolates parameters', () => {
    expect(createI18n('pt').t('hud.of', { have: 3, need: 20 })).toBe('3 de 20');
  });

  it('leaves an unsupplied placeholder standing, so the omission is visible', () => {
    expect(createI18n('pt').t('hud.of', { have: 3 })).toBe('3 de {need}');
  });

  it('does not treat a value containing braces as a template', () => {
    expect(createI18n('pt').t('hud.of', { have: '{need}', need: 7 })).toBe('{need} de 7');
  });
});

describe('[Interface] locale negotiation', () => {
  it.each([
    ['pt-BR', 'pt'],
    ['PT', 'pt'],
    ['en-US', 'en'],
    ['es-419', 'es'],
    ['de-DE', 'pt'],
    [undefined, 'pt'],
  ])('maps %s to %s', (tag, expected) => {
    expect(preferredLocale(tag as string | undefined)).toBe(expected);
  });

  it('gives pt a region and the others none', () => {
    // The voice differs audibly between pt-BR and pt-PT and the content is Brazilian. Nothing
    // here is specific to one country's English or Spanish, so claiming a region would be a
    // promise this catalogue does not keep.
    const i18n = createI18n('pt');
    expect(i18n.bcp47()).toBe('pt-BR');
    i18n.setLocale('en');
    expect(i18n.bcp47()).toBe('en');
    i18n.setLocale('es');
    expect(i18n.bcp47()).toBe('es');
  });
});

describe('[Interface] it is a factory, not a singleton', () => {
  it('lets two instances hold different locales at once', () => {
    // Which is what the completeness test above needs, and what ADR-0038 asks for one level down:
    // shared mutable state between games on one page is the bug it looks like.
    const a = createI18n('pt');
    const b = createI18n('en');
    b.setLocale('es');
    expect(a.getLocale()).toBe('pt');
    expect(b.getLocale()).toBe('es');
  });
});

describe('[Right] mathematics is not a language subject', () => {
  it('translates the objective names in full', () => {
    // The engine's rule, spelled out: `2 + 3` is language-independent, so the words AROUND a
    // number translate entirely. Only the numeral itself crosses untouched, and a numeral is not
    // in this catalogue at all.
    const names = ['obj.evens', 'obj.multiplesOf3', 'obj.multiplesOf4'];
    for (const key of names) {
      expect(pt[key]).not.toBe(en[key]);
    }
  });

  it('spells the same numeral in every language', () => {
    // ⚠️ The first version of this asserted that no digit appears in the catalogue at all, and
    // that was simply wrong: "múltiplos de 3" carries a 3 because the 3 NAMES the concept. The
    // rule is not that numerals are absent, it is that they do not change — the words around a
    // number translate, the number itself does not. "multiples of 3" and "múltiplos de 3" differ
    // in every character except the one that is mathematics.
    const digitsIn = (s: string) => [...s.matchAll(/\d+/g)].map((m) => m[0]).join(',');
    for (const key of Object.keys(pt)) {
      expect(digitsIn(en[key]), key).toBe(digitsIn(pt[key]));
      expect(digitsIn(es[key]), key).toBe(digitsIn(pt[key]));
    }
  });
});
