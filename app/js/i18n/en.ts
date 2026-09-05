// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Catalog } from './types.ts';

export const en: Catalog = {
  'game.title': 'Whack the Pattern',

  'mat.label': 'Game mat',
  'mat.cell': 'column {col}, row {row}, {content}',
  'mat.empty': 'empty',

  'obj.evens': 'even numbers',
  'obj.multiplesOf3': 'multiples of 3',
  'obj.multiplesOf4': 'multiples of 4',

  'hud.score': 'Hits',
  'hud.of': '{have} of {need}',
  'hud.level': 'Level {level}',
  'hud.lives': 'Lives left: {lives}',
  'hud.endless': 'No defeat',
  'hud.suddenDeath': 'Sudden death',
  'hud.collect': 'Collect: {what}',

  'say.waveLit': 'Lit up: {values}. Collect {what}.',
  'say.hit': 'Right, {value}.',
  'say.wrongTile': 'Wrong, {value} is not what was asked.',
  'say.missed': 'Missed: {value}.',
  'say.levelUp': 'Level {level}.',
  'say.won': 'You did it! {have} hits.',
  'say.lost': 'Game over. {have} hits.',
  'say.crashed': 'The game stopped on an error. Reload the page.',

  'opt.difficulty': 'Difficulty',
  'opt.easy': 'Easy',
  'opt.medium': 'Medium',
  'opt.hard': 'Hard',
  'opt.defeat': 'How you lose',
  'opt.category': 'What to collect',
};
