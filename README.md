# Whack-whack

> ## ⚠️ ESTE REPOSITÓRIO ESTÁ VAZIO. O JOGO AINDA NÃO FOI CONSTRUÍDO.
>
> Ele existe porque o endereço está **declarado em registro** — e endereço declarado é onde o trabalho pode
> ser arquivado. Ver **ADR-0067 §3**: a regra existe para que vazio não se leia como progresso, e a resposta
> é CONTEÚDO, não ausência.
>
> **Esta advertência sai no commit que a desmentir.** README que mente sobre estar vazio é pior do que
> repositório vazio.

## O que é

Um jogo de acertar-o-alvo sobre a engine do Inclusionist, com renderização em Zdog.

## ⚠️ O nome deste repositório é um problema conhecido

O **ADR-0082** fixou o padrão `game-<slug>`, e este endereço o obedece. Mas o *slug* carrega **`zdog`**, que
é o nome do RENDERIZADOR — e o **ADR-0035** existe precisamente para o renderizador poder mudar. O
argumento está registrado, com estas palavras, no ADR-0073:

> *"O endereço carrega o nome do renderizador, e o ADR-0035 existe precisamente para o renderizador poder
> mudar. No dia em que mudar, o endereço começa a mentir e nada vai fazê-lo parar."*

Trocar agora custa quase nada — o repositório está vazio. Depois de existir código, um rename quebra todo
URL que alguém tiver anotado. **Decisão do Dev**, e ela é mais barata hoje do que em qualquer outro dia.

## Como ele consome a engine

⚠️ **Como PACOTE, nunca por caminho relativo** (ADR-0083). Ver o README do `game-2048` para o comando; a
regra é a mesma para todos os jogos.

## O que precisa existir antes do primeiro commit de produto

- O contrato declarado do ADR-0030, e a decisão de quais das nove ações do ADR-0077 este jogo usa.
- O chamador do `game-ci.yml` (ADR-0068 §4).


## Licença

Código: **AGPL-3.0-or-later** (ADR-0064) — o `LICENSE` desta raiz.
⚠️ **A arte NÃO é AGPL.** Programa é o que a Lei 9.609 define; arte segue a Lei 9.610 e pertence a quem a
fez. O que governa o quê está em `docs/LICENSES.md`, na engine.

⚠️ **A titularidade patrimonial é do MUNICÍPIO** (Lei nº 9.609/1998, art. 4º), não do desenvolvedor. A
publicação do código é objeto de **pedido** no requerimento — ato do Poder Executivo — e por isso este
repositório é **privado** (ADR-0066 §3).

---

Decidido em: **ADR-0068** (um repositório por jogo) · **ADR-0082** (o nome é `game-<slug>`, espelhando o
pacote) · **ADR-0083** (o jogo nasce aqui e consome a engine como PACOTE, nunca por caminho relativo) ·
**ADR-0067** (criação e este aviso).

Os registros vivem na engine, em `docs/2-Architecture/adr/` — **não** há pasta `adr/` aqui, e isso é decisão
(ADR-0068 §5).
