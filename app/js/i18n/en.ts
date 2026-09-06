// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Catalog } from './types.ts';

export const en: Catalog = {
  'game.title': 'WhackWhack\nSchoolution',

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
  'hud.collect': 'Collect: {what}', 'hud.help': 'Arrows move · Enter whacks · Shift+arrows lean the mat',

  'say.waveLit': 'Lit up: {values}. Collect {what}.',
  'say.hit': 'Right, {value}.',
  'say.wrongTile': 'Wrong, {value} is not what was asked.',
  'say.missed': 'Missed: {value}.',
  'say.levelUp': 'Level {level}.',
  'say.won': 'You did it! {have} hits.',
  'say.lost': 'Game over. {have} hits.',
  'say.crashed': 'The game stopped on an error. Reload the page.',

  'title.play': 'Play', 'title.options': 'Options',
  'title.lead': 'Whack only what the round asks for.',

  'result.won': 'You did it!',
  'result.lost': 'Game over',
  'result.score': 'Hits: {have} of {need}',
  'result.level': 'Reached level {level}',
  'result.again': 'Play again',
  'result.change': 'Change options',

  'opt.suddenDeath': 'Sudden death — one mistake ends it',
  'opt.lives': 'Lives — three mistakes end it',
  'opt.endless': 'No defeat — ends only on a win',

  'opt.difficulty': 'Difficulty',
  'opt.easy': 'Easy',
  'opt.medium': 'Medium',
  'opt.hard': 'Hard',
  'opt.defeat': 'How you lose',
  'opt.category': 'What to collect',
};
