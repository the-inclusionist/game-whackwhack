// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n — this game's own dictionary, as a FACTORY.
//
// ========================= WHY NOT THE ENGINE'S =========================
// The engine ships `core/i18n` with 253 keys for its platformer, and the quiz consumer measured
// what inheriting them costs: a second game uses a handful and carries the rest as dead weight in
// every locale chunk. This catalogue is about thirty keys, so it is its own.
//
// ========================= WHY A FACTORY AND NOT A SINGLETON =========================
// No module-level mutable state: `createI18n()` returns an instance and the composition root owns
// it. The cost is one parameter threaded through; the payoff is that a test can hold three locales
// at once without them fighting over a global, which is exactly what the completeness test does.
// It is also ADR-0038's rule — shared mutable state between games on one page is the bug it looks
// like — applied one level down.
//
// ========================= WHY ALL THREE ARE IMPORTED STATICALLY =========================
// The engine lazy-loads its `en` and `es` as chunks, and is right to at 253 keys each. Three
// objects of a couple of kilobytes do not earn a code split and the loading state that comes with
// it — and a page that renders before its chunk lands shows the fallback language for a frame,
// which is the bug `idiomaPronto()` exists to paper over in the engine. Revisit if this catalogue
// ever grows an order of magnitude.
//
// The fallback chain is locale → pt → the key itself. A missing key surfaces AS THE KEY, which is
// ugly on screen and therefore gets fixed. Silence would not.
//
// ⚠️ The MIDDLE step is unreachable while tests/i18n.node.test.ts holds, because that test proves
// all three catalogues carry the same key set. It stays as developer-facing cover: someone
// hand-editing `es.ts` and reloading the game before running the suite gets Portuguese rather than
// a raw identifier. That is a benefit CI can never observe, so the mutation harness records it as
// an equivalent mutant instead of pretending a gate exists for it.

import type { Catalog, LocaleCode } from './types.ts';
import { en } from './en.ts';
import { es } from './es.ts';
import { pt } from './pt.ts';

const CATALOGS: Readonly<Record<LocaleCode, Catalog>> = { pt, en, es };
const FALLBACK: LocaleCode = 'pt';
const LOCALES: readonly LocaleCode[] = ['pt', 'en', 'es'];

/** BCP 47 tags, for `lang=` and for speech synthesis. */
const BCP47: Readonly<Record<LocaleCode, string>> = {
  // pt carries a REGION because the voice differs audibly and the content is Brazilian; en and es
  // deliberately do not, because nothing here is specific to one country's variety of either.
  pt: 'pt-BR',
  en: 'en',
  es: 'es',
};

export interface I18n {
  t(key: string, params?: Readonly<Record<string, string | number>>): string;
  setLocale(code: LocaleCode): void;
  getLocale(): LocaleCode;
  bcp47(): string;
}

export function isLocale(code: string): code is LocaleCode {
  return (LOCALES as readonly string[]).includes(code);
}

export function availableLocales(): readonly LocaleCode[] {
  return LOCALES;
}

/** Picks the best supported locale for a browser language tag. `pt-BR` → `pt`, `de` → `pt`. */
export function preferredLocale(navigatorLanguage: string | undefined): LocaleCode {
  const base = (navigatorLanguage ?? '').toLowerCase().split('-')[0];
  return isLocale(base) ? base : FALLBACK;
}

function interpolate(
  template: string,
  params?: Readonly<Record<string, string | number>>,
): string {
  if (!params) return template;
  // An unknown placeholder is left standing rather than blanked: `{level}` on screen says which
  // parameter the caller forgot, where an empty gap says only that something is wrong.
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    (Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole));
}

export function createI18n(initial: LocaleCode = FALLBACK): I18n {
  let locale: LocaleCode = initial;

  return {
    t(key, params) {
      const template = CATALOGS[locale][key] ?? CATALOGS[FALLBACK][key] ?? key;
      return interpolate(template, params);
    },
    setLocale(code) { locale = code; },
    getLocale: () => locale,
    bcp47: () => BCP47[locale],
  };
}
