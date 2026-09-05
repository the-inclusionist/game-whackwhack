// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Catalog } from './types.ts';

export const es: Catalog = {
  'game.title': 'Martillo Justo',

  'mat.label': 'Tapete del juego',
  'mat.cell': 'columna {col}, fila {row}, {content}',
  'mat.empty': 'vacía',

  'obj.evens': 'números pares',
  'obj.multiplesOf3': 'múltiplos de 3',
  'obj.multiplesOf4': 'múltiplos de 4',

  'hud.score': 'Aciertos',
  'hud.of': '{have} de {need}',
  'hud.level': 'Nivel {level}',
  'hud.lives': 'Vidas restantes: {lives}',
  'hud.endless': 'Sin derrota',
  'hud.suddenDeath': 'Muerte súbita',
  'hud.collect': 'Recoge: {what}', 'hud.help': 'Flechas navegan · Enter martilla · también con clic',

  'say.waveLit': 'Se encendieron: {values}. Recoge {what}.',
  'say.hit': 'Correcto, {value}.',
  'say.wrongTile': 'Incorrecto, {value} no es lo que se pide.',
  'say.missed': 'Se escapó: {value}.',
  'say.levelUp': 'Nivel {level}.',
  'say.won': '¡Lo lograste! {have} aciertos.',
  'say.lost': 'Fin del juego. {have} aciertos.',
  'say.crashed': 'El juego se detuvo por un error. Recarga la página.',

  'opt.difficulty': 'Dificultad',
  'opt.easy': 'Fácil',
  'opt.medium': 'Medio',
  'opt.hard': 'Difícil',
  'opt.defeat': 'Cómo se pierde',
  'opt.category': 'Qué recoger',
};
