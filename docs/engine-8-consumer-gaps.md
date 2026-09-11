# Engine 8.0.0 — two things a consumer cannot supply

**To take to the engine conversation.** Written from `game-whackwhack` on 2026-09-11, measuring
engine `8.0.0` as published on npm. Everything below is read from
`node_modules/@the-inclusionist/engine/dist-pkg/`, not remembered.

This is the same kind of record as [ADR-0083](ADR-0083-conformidade-medida.md): a consumer
reporting what the engine looks like from outside, because that is the one view the engine cannot
take of itself.

---

## The finding in one sentence

**Engine 8 made two surfaces mandatory for every game and gave the consumer no parameter to fill
them.** The pause menu (ADR-0120, ADR-0122) and the accessibility bar (ADR-0106 §4) are now mounted
by `createGame` whether a game asks or not — which is right, and was measured to be necessary. But
the thing each surface needs in order to *work* still arrives through a context that only
`createGame` builds, and `CreateGameOptions` has no field for either.

The result is the same in both cases: the engine's own §5 filter correctly hides a control that
would do nothing, and the child is left without the control at all.

---

## What is NOT the defect

Worth saying first, because both gaps look like missing features and neither is.

`ADR-0106 §5` is right, and `itensQueAccionam` / `iconesQueAccionam` implement it correctly. An item
with no action behind it is worse than no item: *"uma barra que oferece um caminho e depois o recusa
ensina-lhe que o caminho não é para ela"*. Both filters below do exactly what that says. The engine
is also right to withhold rather than to fake.

The defect is one level up: **a consumer has no way to BE the writer**, so the filter's correct
answer is always "no".

---

## Gap 1 — the pause card has no way out

### Measured

`boot/create-game.js` builds the pause card for every game and hangs it in `pauseHost`
(default `#game-region`), with the id `#vp-pause-0` its own menu navigation looks for. It exposes
`engine.pausa.mostrar(i)` / `esconder(i)` so a consumer can reveal it.

`ui/pause-icons.js` dispatches the card's items through `getPauseActs()`, and actions three of them
itself — `ITENS_DA_ENGINE` is `options`, `pmback`, `acessibilidade`. **`resume` is not among them**,
and `initPauseIcons` takes `getPauseActs` from its ctx, which `createGame` does not pass and
`CreateGameOptions` cannot carry.

So `itensQueAccionam` hides `▶ Continuar` every time the card opens — correctly, since nothing
would happen if it were pressed.

### What it costs a child

A keyboard closes the pause with Escape. **A touch screen has nothing.** The child opens the card
on a school tablet, and the only visible item is `♿ Acessibilidade`. There is no exit.

That is worse than the dead button the filter was avoiding: a dead button wastes a press, and this
strands her inside the thing she opened.

### What this game does meanwhile

`boot/main.ts` un-hides the item and supplies the action, after every `mostrar` (the filter re-runs
on each open). It is marked for deletion the day `CreateGameOptions` takes pause actions. The shape
of the workaround is the shape of the fix: reveal the item, give it the function.

---

## Gap 2 — the accessibility bar has no contrast and no colour-vision correction

### Measured

`ui/pause-icons.js` decides which icons exist with

```js
const iconesDoJogo = iconesQueAccionam({
  tema: Boolean(ctx.setTemaDoJogador),
  correcao: Boolean(ctx.setCorrecaoDoJogador),
  seguraTeclas: ctx.seguraTeclas,
});
```

`createGame` passes `seguraTeclas` — it reads it from the contract, which is exactly why that one
works — and passes **neither writer**. `CreateGameOptions` has no field for them.

So no game booted through `createGame` has a `contrast` icon or a `cvd` icon. Measured on this
game's bar before the workaround below: seven icons, and neither of those two.

### What it costs a child

This game's `render/palette.ts` measured every colour in it under protanopia, deuteranopia and
tritanopia — that is where its tile and accent colours come from — and `createGame` mounts the six
SVG colour-vision filters into `#cvd` at boot. All of it worked. **None of it could be switched on
by the child it was measured for.**

The asymmetry is worth naming: the engine ships the filters, ships the axes (`render/viz-axes`),
ships the CSS table (`render/viz-modes`), ships `engine.aplicarFiltroDeVisao`, and ships the icon —
and the one link missing is a place to keep four bytes of state.

### What this game does meanwhile

`app/js/ui/vision.ts` holds the `VisualState` and `boot/main.ts` appends the `cvd` icon to the bar.
The cycle is `proximaCorrecao`, the resolution is `aplicacao` (both axes together, per issue #104),
the CSS is `VIZ_FILTER`, the sentence is `sr.icon.cvd`, and the key is `KEYS.visualP(0)` so the
choice carries to the next game on the same origin. Nothing of the logic is this game's.

⚠️ **Only the correction, not the contrast.** High contrast means *repainting* from the declared
roles rather than filtering, and `render/high-contrast` cannot be borrowed by a consumer that is not
the platformer: its `PaintableRole` is `'hazard' | 'climb' | 'water'`, and its surface is sprite and
world texture caches. A Zdog game draws shapes. So that icon stays unmounted here, deliberately —
mounting it empty would be the §5 defect this whole report is about.

Two things had to be worked around while wiring it, and both are worth knowing even if the gap is
closed upstream:

- The bar's click handler ends with `reflectIconsIn(host, i)`, which rewrites the `aria-label` of
  every `.pi-btn` under the host from state the engine holds. An icon driven by state the engine was
  never given gets relabelled wrongly — silently, and only for the child reading by ear. This game
  gives the engine an element of its own inside the row.
- The engine's own `#title-icons` rule positions that id absolutely at the top-centre of the stage.
  A consumer that takes the fallback id inherits a layout written for another game.

---

## Why these are one defect and not two

Both follow from the same move: **ADR-0120 and ADR-0106 §4 made the engine the OWNER of a surface
that a game used to build.** That was the right call and the measurement behind it was solid — five
of six games in the catalogue had no accessibility bar and no pause.

What did not move with the ownership is the *input*. While each game mounted its own bar, it also
passed its own writers to `initPauseIcons`; now the engine mounts, and nothing passes writers at
all. The parameter did not follow the responsibility.

That predicts more of the same: any future icon whose ctx entry is a game-supplied writer will be
withheld from every `createGame` consumer on the day it ships.

---

## A shape, not a prescription

Two fields on `CreateGameOptions` would close both:

```ts
readonly pauseActs?: () => Record<string, (() => void) | undefined>;
readonly visualWriters?: {
  readonly setTema?: (i: number, tema: Tema) => void;
  readonly setCorrecao?: (i: number, correcao: Correcao) => void;
};
```

Both optional, and optional is the right default here — unlike `seguraTeclas`, the silence has a
safe side: a game that declares neither gets exactly today's behaviour, which is the filter doing
its job. Nothing regresses for a consumer that ignores them.

📌 There may be a better shape. A consumer that passes writers is really answering *"can this game
repaint itself?"*, which is closer to a contract question than to a boot parameter — and the
contract is where `seguraTeclas` went for the same reason. This report is not the place to choose.

---

## One observation, which is a decision and not a defect

`baixarPesados` defaults to **true**, and fetches the MediaPipe vision runtime and its three models,
WebGazer, the piper runtime with onnxruntime, and four neural voices — roughly 241 MB, in the
background, on first load.

`platform/pesados-catalogo.js` says of the vision half, in its own words: *"⬜ O que continua por
fazer é a FIAÇÃO (issue #11): estes bytes descem e ainda ninguém os lê."*

For a game that has no camera input, no gaze input and no neural voice, that is 241 MB of a school's
bandwidth for bytes nothing can read yet. This game sets it to `false` and says so in
`boot/main.ts`, to be reverted when either half changes. Raising it here only because a default is a
decision made for everyone who does not think about it, and a metered connection is the case this
project targets.
