# WhackWhack Schoolution

Um jogo de martelar sobre a engine do Inclusionist, com renderização em Zdog. As lajes carregam
**números**, e a criança coleta só os que a rodada pede — pares, múltiplos de 3, múltiplos de 4.
Duas a quatro lajes acendem juntas e **pelo menos uma está errada**, então a pergunta nunca é só
"você consegue acertar".

Reimplementado a partir das regras de [si-em/whackwhack](https://github.com/si-em/whackwhack). O que
foi mantido e o que mudou está em `docs/GAME-RULES.md`; por que é reimplementação e não port está em
`docs/LICENSES.md` §4 — o original **não tem licença nenhuma**, o que juridicamente é *todos os
direitos reservados*.

## ✔️ O nome deste repositório era um problema conhecido, e foi resolvido

O **ADR-0082** fixa o padrão `game-<slug>`. O endereço anterior era `game-zdog-whackwhack`, e o slug
carregava **`zdog`** — o nome do RENDERIZADOR — quando o **ADR-0035** existe precisamente para o
renderizador poder mudar. O argumento ficou registrado no **ADR-0073**:

> *"O endereço carrega o nome do renderizador, e o ADR-0035 existe precisamente para o renderizador
> poder mudar. No dia em que mudar, o endereço começa a mentir e nada vai fazê-lo parar."*

Renomeado para **`game-whackwhack`** por decisão do Dev, enquanto ainda era barato. O aviso fica no
lugar do apagamento: quem encontrar o endereço antigo numa anotação precisa saber para onde ele foi.

## ⚠️ Como ele consome a engine — e por que isso descumpre o ADR-0083

```json
"@the-inclusionist/engine": "file:../SP-the-inclusionist-tracer"
```

O **ADR-0083** manda consumir a engine **como PACOTE** (`npm pack` + instalação do tarball), e recusa
o symlink pelo mecanismo: *"um symlink passa direto por `files`"*. `file:` apontando para um
**diretório** produz exatamente esse symlink — verificado em disco.

Isto não é particularidade deste jogo: `game-2048` e `game-hartwig-chess` têm a mesma linha. E há um
bloqueio a montante — o teste de contrato que o ADR §3 manda cada jogo rodar **não entra no tarball**,
porque `tests/` não está em `files`.

A medição completa, para levar à conversa da engine, está em
**`docs/ADR-0083-conformidade-medida.md`**. O descumprimento fica declarado aqui em vez de corrigido
pela metade: trocar só a dependência entregaria metade da conformidade e esconderia a outra.

## Estado

**Jogável de ponta a ponta**, em pt/en/es, por teclado ou por ponteiro.

- Tela de título, rodada, tela de resultado, recomeçar.
- Três categorias, três dificuldades, três modos de derrota — todos com teste.
- Os sete campos do contrato (**ADR-0030**), incluindo o **primeiro consumidor de `tick: 'clock'`**
  em toda a engine.
- Espelho DOM da grade: uma partida inteira sem ponteiro e sem canvas.

Ainda **não** existe: o chamador do `game-ci.yml` (**ADR-0068 §4**) e a decisão de quais das nove
ações do **ADR-0077** este jogo usa.

## Rodando

```bash
NODE_OPTIONS=--use-system-ca npm install
npm run validate                 # typecheck + testes + build
npm run test:node                # as regras puras, em milissegundos
bash tests/mutation-check.sh     # prova que cada gate consegue falhar
```

⚠️ `npm run dev` não funciona no sandbox — o pré-bundle do Vite nunca fica pronto e o grafo de
módulos morre. Builde e sirva o `dist/`.

⚠️ `NODE_OPTIONS=--use-system-ca` não é opcional nesta máquina: o antivírus reassina o TLS, o Node
rejeita a cadeia, e o `npm install` **parece travar** em vez de falhar com mensagem útil.

## Medições que travaram decisões

Nada de estética aqui foi escolhido no olho.

- `docs/spike-0-symbol-legibility.md` — como o número chega na laje. Três candidatos medidos; o
  glifo deitado foi **desclassificado** porque "12" se lê "IC".
- `app/js/render/palette.ts` — a paleta DDR, e o que ela custa. Duas cores do original não sobrevivem
  à medição: o `#0000ff` dá **1,27:1** contra o fundo, e o magenta assinatura não deixa faixa para a
  laje apagada existir.

## Licença

Código: **AGPL-3.0-or-later** (**ADR-0064**) — o `LICENSE` desta raiz.

⚠️ **A arte NÃO é AGPL.** Programa é o que a Lei 9.609 define; arte segue a Lei 9.610 e pertence a
quem a fez. O que governa o quê está em `docs/LICENSES.md`, na engine.

⚠️ **A titularidade patrimonial é do MUNICÍPIO** (Lei nº 9.609/1998, art. 4º), não do desenvolvedor.
A publicação do código é objeto de **pedido** no requerimento — ato do Poder Executivo — e por isso
este repositório é **privado** (**ADR-0066 §3**).

---

Decidido em: **ADR-0068** (um repositório por jogo) · **ADR-0082** (o nome é `game-<slug>`,
espelhando o pacote) · **ADR-0083** (o jogo nasce aqui e consome a engine como PACOTE) ·
**ADR-0067** (criação) · **ADR-0073** (o slug não deve carregar o renderizador).

Os registros vivem em [`the-inclusionist-docs`](https://github.com/the-inclusionist/the-inclusionist-docs),
em `docs/2-Architecture/adr/` — **não** há pasta `adr/` aqui, e isso é decisão (**ADR-0068 §5**).

⚠️ **A frase dizia «na engine», e deixou de ser verdade em 2026-09-09** (**ADR-0123**): a árvore inteira mudou
de casa para um repositório só dela, uma para o projecto todo. 📌 A metade do §5 que governa ESTE repositório
está intacta — um jogo não tem pasta `adr/` e nunca terá; o que mudou foi onde fica a que ele herda.
