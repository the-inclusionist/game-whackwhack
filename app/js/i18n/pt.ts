// SPDX-License-Identifier: AGPL-3.0-or-later
// pt-BR — the base catalogue. Every other locale is checked against this one's key set.
//
// ⚠️ THE FRAME TRANSLATES, THE CONTENT CROSSES. The engine's rule: a phrase lives in the key and
// the curriculum content passes through as `{param}`. Here the content is a NUMBER, and the
// engine's own note is explicit that mathematics is not a language subject — `12` is `12` in every
// locale, so the numerals cross untouched while everything around them translates.

import type { Catalog } from './types.ts';

export const pt: Catalog = {
  'game.title': 'WhackWhack Schoolution', 'title.mark': 'WHACK\nWHACK', 'title.school': 'Schoolution',

  'mat.label': 'Tapete do jogo',
  'mat.cell': 'coluna {col}, linha {row}, {content}',
  'mat.empty': 'vazia',

  'obj.multiplesOf2': 'números pares',
  'obj.multiplesOf3': 'múltiplos de 3',
  'obj.multiplesOf4': 'múltiplos de 4',
  'obj.multiplesOf5': 'múltiplos de 5',
  'obj.multiplesOf6': 'múltiplos de 6',
  'obj.multiplesOf7': 'múltiplos de 7',
  'obj.multiplesOf8': 'múltiplos de 8',
  'obj.multiplesOf9': 'múltiplos de 9',

  'hud.score': 'Acertos',
  'hud.of': '{have} de {need}',
  'hud.level': 'Nível {level}',
  'hud.lives': 'Vidas restantes: {lives}',
  'hud.endless': 'Sem derrota',
  'hud.suddenDeath': 'Morte súbita',
  'hud.best': 'Recorde: {best}',
  'hud.collect': 'Colete: {what}', 'hud.help': 'Setas navegam · Enter martela · Shift+setas inclinam o tapete',

  'act.up': 'Mover para cima',
  'act.up.short': 'Cima',
  'act.down': 'Mover para baixo',
  'act.down.short': 'Baixo',
  'act.left': 'Mover para a esquerda',
  'act.left.short': 'Esquerda',
  'act.right': 'Mover para a direita',
  'act.right.short': 'Direita',
  'act.hammer': 'Martelar',
  'act.hammer.short': 'Martelar',
  'act.hammer.hint': 'Martela o azulejo onde o cursor está.',

  'combo.awesome': 'Awesome!',
  'combo.good': 'Good!',
  'combo.savage': 'Savage!',
  'combo.onFire': 'On fire!',
  'combo.combo': 'Combo!',
  'feedback.point': '+1',

  'say.tileLit': 'Acendeu {value}. Colete {what}.',
  'say.hit': 'Certo, {value}.',
  'say.wrongTile': 'Errado, {value} não é o que se pede.',
  'say.missed': 'Passou: {value}.',
  'say.levelUp': 'Nível {level}.',
  'say.won': 'Você conseguiu! {have} acertos.',
  'say.lost': 'Fim de jogo. {have} acertos.',
  'say.crashed': 'O jogo parou por um erro. Recarregue a página.',

  'title.play': 'Jogar',
  'title.by': 'by Prof. José Rocha',
  'title.lead': 'Martele só o que a rodada pede.',

  'result.won': 'Você conseguiu!',
  'result.lost': 'Fim de jogo',
  'result.score': 'Acertos: {have} de {need}',
  'result.level': 'Chegou ao nível {level}',
  'result.record': 'Novo recorde!',
  'result.again': 'Jogar de novo',
  'result.change': 'Mudar opções',

  'opt.group': 'Opções da rodada',
  'opt.collect': 'Toque para coletar múltiplos de:',
  'opt.collectOne': 'múltiplos de {n}',
  'opt.difficulty': 'Dificuldade',
  'opt.easy': 'Fácil',
  'opt.medium': 'Médio',
  'opt.hard': 'Difícil',
  'opt.defeat': 'Como perder',
  'opt.suddenDeath': 'Morte súbita',
  'opt.lives': 'Corações',
  'opt.endless': 'Invencível',
  'opt.cycle': 'toque para mudar',
  'opt.now': '{label}: {value}',
};
