// SPDX-License-Identifier: AGPL-3.0-or-later
// pt-BR — the base catalogue. Every other locale is checked against this one's key set.
//
// ⚠️ THE FRAME TRANSLATES, THE CONTENT CROSSES. The engine's rule: a phrase lives in the key and
// the curriculum content passes through as `{param}`. Here the content is a NUMBER, and the
// engine's own note is explicit that mathematics is not a language subject — `12` is `12` in every
// locale, so the numerals cross untouched while everything around them translates.

import type { Catalog } from './types.ts';

export const pt: Catalog = {
  'game.title': 'WhackWhack Schoolution', 'title.mark': 'Whack\nWhack', 'title.school': 'Schoolution',

  'mat.label': 'Tapete do jogo',
  'mat.cell': 'coluna {col}, linha {row}, {content}',
  'mat.empty': 'vazia',

  'obj.evens': 'números pares',
  'obj.multiplesOf3': 'múltiplos de 3',
  'obj.multiplesOf4': 'múltiplos de 4',

  'hud.score': 'Acertos',
  'hud.of': '{have} de {need}',
  'hud.level': 'Nível {level}',
  'hud.lives': 'Vidas restantes: {lives}',
  'hud.endless': 'Sem derrota',
  'hud.suddenDeath': 'Morte súbita',
  'hud.collect': 'Colete: {what}', 'hud.help': 'Setas navegam · Enter martela · Shift+setas inclinam o tapete',

  'say.waveLit': 'Acenderam: {values}. Colete {what}.',
  'say.hit': 'Certo, {value}.',
  'say.wrongTile': 'Errado, {value} não é o que se pede.',
  'say.missed': 'Passou: {value}.',
  'say.levelUp': 'Nível {level}.',
  'say.won': 'Você conseguiu! {have} acertos.',
  'say.lost': 'Fim de jogo. {have} acertos.',
  'say.crashed': 'O jogo parou por um erro. Recarregue a página.',

  'title.play': 'Jogar', 'title.options': 'Opções',
  'title.lead': 'Martele só o que a rodada pede.',

  'result.won': 'Você conseguiu!',
  'result.lost': 'Fim de jogo',
  'result.score': 'Acertos: {have} de {need}',
  'result.level': 'Chegou ao nível {level}',
  'result.again': 'Jogar de novo',
  'result.change': 'Mudar opções',

  'opt.suddenDeath': 'Morte súbita — um erro encerra',
  'opt.lives': 'Vidas — três erros encerram',
  'opt.endless': 'Sem derrota — só termina ao vencer',

  'opt.difficulty': 'Dificuldade',
  'opt.easy': 'Fácil',
  'opt.medium': 'Médio',
  'opt.hard': 'Difícil',
  'opt.defeat': 'Como se perde',
  'opt.category': 'O que coletar',
};
