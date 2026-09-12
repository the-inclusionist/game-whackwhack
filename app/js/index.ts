// SPDX-License-Identifier: AGPL-3.0-or-later
// The LIB target's entry: everything a shell needs from this game, and nothing else.
//
// ========================= ONE SOURCE, TWO ARTEFACTS =========================
// ADR-0140: a game is a standalone PWA *and* a cartridge, built from the same tree. `app/index.html`
// is the app target and loads `boot/standalone.ts`; this file is the lib target and loads nothing.
// The difference between them is not the game — it is who calls it.
//
// ⚠️ THE STANDALONE PAGE IS A DEVELOPMENT ROUTE, NEVER A DELIVERY ROUTE, and the record is blunt
// about it: the app build is «also the test harness». Nobody ships a child six pages; the platform
// ships one, and this module is how the game gets there.
//
// ========================= WHAT IS EXPORTED, AND WHY NOT MORE =========================
// 📌 THIS IS THE GAME'S HALF OF `CreateGameOptions` (ADR-0139 §1) PLUS THE FACTORY, and every name
// below is one `boot/standalone.ts` already uses. That is the test: if the standalone shell needs
// it, a platform shell needs it, because the two are the same shell around the same function.
//
// ⚠️ WHAT IS DELIBERATELY ABSENT IS `Cartridge`. The record asks for
// `{ slug, declaration, dicts, hooks, create(ctx) }`, and `GameCtx` IS NOT DECIDED — the records say
// in three places «derive it from what `CreateGameOptions` already takes; do not design it fresh».
// A shape invented here would be invented for six repositories (ADR-0068 §5). So this exports the
// PARTS a `Cartridge` will be assembled from, and the assembly waits for the decision.
//
// ========================= WHAT A LIB BUILD MUST NOT CARRY =========================
// ADR-0117: «a cartridge declares no delivery — no font file, no voice, no runtime in a game's own
// package or `dist`». The engine and Zdog are EXTERNAL here, so a platform installs one of each;
// see `vite.config.ts`, where that is the whole difference between the two targets.

export { boot, type BootDeps, type RunningGame } from './boot/main.ts';
export { createWhackDeclaration, type RoundView } from './declaration/whack-declaration.ts';
export { actionPreset } from './input/actions.ts';
export { createFrameTicker } from './render/frame-ticker.ts';
export { CATEGORIES } from './rules/category.ts';
export {
  availableLocales, createI18n, isLocale, preferredLocale, type I18n,
} from './i18n/index.ts';
export { en } from './i18n/en.ts';
export { es } from './i18n/es.ts';
export { pt } from './i18n/pt.ts';
export type { Catalog, LocaleCode } from './i18n/types.ts';

/**
 * THE NAME, AND ALL THREE SPELLINGS OF IT AGREE (ADR-0082 §1).
 *
 * Repository `game-whackwhack`, package `@the-inclusionist/game-whackwhack`, slug below. The
 * record requires the three to match because a manifest picks a cartridge by this string, and a
 * game whose repository and package disagree gives the manifest two names for one thing.
 *
 * ⚠️ EXPORTED RATHER THAN READ FROM `package.json`, because a lib consumer has no reliable way to
 * read the manifest of a dependency at runtime — and a slug the platform has to guess is a slug
 * that will be guessed wrong once.
 */
export const SLUG = 'game-whackwhack';
