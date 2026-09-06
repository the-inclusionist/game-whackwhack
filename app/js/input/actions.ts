// SPDX-License-Identifier: AGPL-3.0-or-later
// input/actions — which of the engine's positions this game uses, and the word each one carries.
//
// ========================= THE ENGINE OWNS POSITIONS, THE GAME OWNS WORDS =========================
// ADR-0074 gave the engine fourteen positions with no meaning in any of them, and ADR-0077 finished
// the job by renaming the last one that still carried a story: `action1-mod` became `action4`,
// because "modifier" describes a platformer and this engine has three hundred games to carry.
//
// The consequence for a game is this file. `action1` says nothing to anybody — the ADR calls an
// abstract name reaching a child a defect in so many words — so the game supplies the word. Here
// the word is "Martelar", because that is what the button does on a mat of tiles. A quiz calls the
// same position "Confirmar" and neither of us is wrong.
//
// ========================= WHY SO FEW OF THEM =========================
// ⚠️ A PRESET IS PARTIAL ON PURPOSE. Declaring all fourteen would force this game to invent a name
// for a trigger it does not have, and an invented name ends up on a remapping screen in front of a
// child. Whack-a-mole is four directions and one verb; that is the whole vocabulary, and the four
// diamond positions it does NOT use stay unnamed rather than being padded out.
//
// ⚠️ AND `start` IS ABSENT DELIBERATELY. It is the system position that pauses, and this game
// declares `semMenuDePausa` to the engine: the title and result screens are the only two places it
// stops, and both are reachable without one. Naming a pause here would promise a screen that does
// not exist.
//
// ========================= WHAT IS NOT WIRED YET, AND WHY IT IS STILL HERE =========================
// ⚠️ `createGame` DOES NOT ACCEPT A PRESET. The engine ships `core/actions` with `ActionPreset`,
// `labellerFrom` and two validators, and `boot/create-game`'s options do not yet include a place to
// put one — measured, not assumed. So this preset is declared, validated against the engine's own
// `presetProblems` in tests/actions.node.test.ts, and consumed by `ui/grid-mirror` for the part
// that works today: a remapped hammer key. The day the engine takes a preset, this is the argument.
//
// Writing it before it can be handed over is the same call ADR-0068 §4 made for the CI caller: a
// declaration that says what this game uses is worth having even while one of its two consumers is
// still missing.

import type { Action, ActionPreset } from '@the-inclusionist/engine/core/actions.js';

/** Translate a key. The composition root passes `i18n.t`; a test passes an echo. */
export type Translate = (key: string) => string;

/**
 * The positions this game uses, in the engine's canonical order.
 *
 * Four directions and one verb. `actionSetProblems` refuses an empty set — a game with no action
 * cannot be played — but it deliberately does NOT require the four directions, because a quiz
 * navigates with two and a one-button game with none.
 */
export const USED: readonly Action[] = ['up', 'down', 'left', 'right', 'action1'];

/** The single verb. Named once here so `ui/grid-mirror` cannot drift from the preset. */
export const HAMMER: Action = 'action1';

/**
 * ⚠️ THE WORDS COME FROM THE CATALOGUE, so the preset is built rather than declared as a literal.
 * A remapping screen is a screen: its labels are read by a child in her own language, and a
 * hardcoded "Martelar" would be the one string in this game that pt, en and es share.
 */
export function actionPreset(t: Translate): ActionPreset {
  return {
    up: { label: t('act.up'), short: t('act.up.short') },
    down: { label: t('act.down'), short: t('act.down.short') },
    left: { label: t('act.left'), short: t('act.left.short') },
    right: { label: t('act.right'), short: t('act.right.short') },
    // `hint` only on the verb: the four directions explain themselves on a grid, and a hint that
    // restates its own label is noise on the screen that most needs to be short.
    action1: { label: t('act.hammer'), short: t('act.hammer.short'), hint: t('act.hammer.hint') },
  };
}
