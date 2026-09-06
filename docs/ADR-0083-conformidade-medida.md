# ADR-0083 — conformidade medida, do lado dos jogos

**Para levar à conversa da engine.** Escrito de `game-whackwhack` em 2026-09-06, medindo o que
existe hoje nas três pastas de jogo e na engine. Tudo abaixo é leitura de arquivo, não impressão.

---

## O achado em uma frase

**A maquinaria que o ADR-0083 pede já existe quase toda na engine. O que não existe é um único jogo
usando-a — e há um bloqueio concreto que impede o §3 de ser cumprido mesmo por quem quiser.**

O próprio ADR já dizia `⚠️ NONE OF THIS PASSES TODAY`. Isto aqui é a medição de *quanto* falta, e de
qual peça está travando as outras.

---

## 1. O que o ADR-0083 exige

> *"`npm pack` produces the tarball through `prepack`, and the game installs it by path. npm resolves
> that install through `exports` and `files` **exactly as it would from the registry**."*

E, explicitamente, o que **não** vale:

> *"⚠️ AND NOT `npm link`. A symlink walks straight past `files`, so it lets a game import what the
> tarball does not carry — which is precisely the defect this record exists to expose. `pack` lies
> less."*

---

## 2. O estado medido dos três jogos

| repositório | pacote | dependência da engine |
|---|---|---|
| `SP-the-inclusionist-whackwhack` | `@the-inclusionist/game-whackwhack` | `file:../SP-the-inclusionist-tracer` |
| `SP-the-inclusionist-2048` | `@the-inclusionist/game-2048` | `file:../SP-the-inclusionist-tracer` |
| `SP-the-inclusionist-chess` | `@the-inclusionist/game-hartwig-chess` | `file:../SP-the-inclusionist-tracer` |

**Os três, a mesma linha.** E o efeito é exatamente o que o ADR nomeia: verificado em disco,
`node_modules/@the-inclusionist/engine` é um **SYMLINK** para a árvore-fonte da engine.

⚠️ **`file:<diretório>` é `npm link` com outra grafia.** O ADR recusa o `npm link` pelo mecanismo —
"um symlink passa direto por `files`" — e `file:` apontando para um diretório produz o mesmo symlink.
A recusa alcança a prática atual mesmo sem nomeá-la, o que vale dizer em voz alta porque a linha
`file:../…` *parece* uma instalação por caminho, que é o que o ADR aprova. A diferença é apontar para
um **tarball**, não para um diretório.

Consequência prática, hoje: um jogo pode importar qualquer arquivo da árvore da engine, inclusive o
que `files` não empacota, e nada avisa. É a mesma cegueira do import relativo, uma camada para fora.

## 3. O que a engine JÁ tem — e é mais do que parece

| peça | estado |
|---|---|
| `prepack` | ✅ `npm run build:pkg` |
| `files` | ✅ `dist-pkg`, `app/css/style.css`, `app/public/vendor`, `LICENSE`, `README.md`, `docs/LICENSES.md`, `docs/CREDITS.md` |
| teste de contrato do pacote | ✅ `tests/engine-package.node.test.js` — existe e é bom |
| workflow compartilhado | ✅ `.github/workflows/game-ci.yml`, chamável por `uses:` |

Ou seja: **`npm pack` funciona hoje**, sem registro e sem tocar o ADR-0066 §3. O caminho de
conformidade está a um comando de distância de cada jogo.

## 4. ⚠️ O bloqueio: o teste de contrato NÃO É EMBARCADO

O ADR-0083 §3 diz:

> *"**THE PACKAGE SURFACE** — gated by a contract test the engine SHIPS and every game runs in its own
> CI."*

Mas `files` **não inclui `tests/`**. O `engine-package.node.test.js` fica no repositório da engine e
**não entra no tarball**. Então um jogo que instale o pacote corretamente ainda **não tem como rodar
o teste que o ADR manda ele rodar**.

Isto é o item que trava os outros: dá para consertar a dependência dos três jogos hoje, e mesmo assim
o §3 continua descumprido até a engine decidir *como* embarca esse teste.

**Três saídas, e a escolha é da conversa da engine:**

1. **Acrescentar `tests/engine-package.node.test.js` a `files`.** Uma linha. Faz o tarball carregar
   um teste, o que é incomum mas é literalmente o que o ADR pede.
2. **Um export dedicado**, por exemplo `"./contract-test"` apontando para um arquivo em `dist-pkg/`
   compilado a partir do teste. Mais limpo de consumir, mais trabalho para montar.
3. **Um pacote irmão** `@the-inclusionist/engine-contract-test`. Mais cerimônia do que o problema
   pede, e cria um segundo artefato para versionar junto.

## 5. O `game-ci.yml` está sendo chamado por um só jogo

| repositório | `.github/workflows/` |
|---|---|
| `game-2048` | ✅ `ci.yml` chama `the-inclusionist/the-inclusionist-engine/.github/workflows/game-ci.yml@main` |
| `game-whackwhack` | ❌ não existe |
| `game-hartwig-chess` | ❌ não existe |

O ADR-0068 §4 é cumprido por um de três. E o `game-ci.yml` **não menciona** o teste de contrato do
pacote — coerente com o §4 acima: ele não tem como rodar um teste que o tarball não carrega.

## 6. Duas coisas que este relatório NÃO afirma

- **Não afirmo que o `consumer-quiz` ou o `app/js/game/` devam sair agora.** O ADR-0083 §5 já trata
  disso e diz que a ordem do ADR-0036 continua valendo. Aqui só se mediu o lado dos jogos.
- **Não afirmo que a linha `file:../` tenha sido um erro de quem a escreveu.** O ADR-0083 tem data de
  **2026-09-06** e o `chess` a usa desde antes; o `game-whackwhack` a copiou do `chess` sem saber que
  havia um registro depois. É dívida de sincronização, não descuido.

---

## O que este jogo faz enquanto isso

`game-whackwhack` continua em `file:../SP-the-inclusionist-tracer`, **com o descumprimento declarado
no seu próprio README**, na seção "Como ele consome a engine". A mudança para tarball é barata do lado
do jogo e não depende de decisão nenhuma — mas mudar só a dependência entregaria metade da
conformidade e esconderia a outra metade, que é o §3. Prefiro o descumprimento visível ao parcial
invisível, e troco assim que a conversa da engine decidir o item 4.
