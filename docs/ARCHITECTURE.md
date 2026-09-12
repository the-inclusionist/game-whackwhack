# Architecture

The map. Thirty-five modules, four layers, and one boundary that is worth more than the other
three put together.

⚠️ **This document does not repeat the others.** The rules of the game are in
[`GAME-RULES.md`](GAME-RULES.md); what the game meets and misses is in
[`CONFORMANCE.md`](CONFORMANCE.md); what the engine does not let a consumer supply is in
[`engine-8-consumer-gaps.md`](engine-8-consumer-gaps.md); why the digits are drawn with a font
rather than seven segments is in [`spike-0-symbol-legibility.md`](spike-0-symbol-legibility.md).
Here is only the shape.

---

## The one boundary

```
rules/        pure. No DOM, no canvas, no engine, no browser global.
  ↑
declaration/  answers the engine's contract by READING rules/
render/       zdog, the glyph pass, the camera, the palette
ui/           the DOM: the mirror, the HUD, the screens, the options
  ↑
boot/main.ts  the composition root, and the only place that knows all of them
boot/standalone.ts  the shell: the only thing that CALLS it
js/index.ts   the LIB target's entry: what a platform shell imports, and nothing else
```

⚠️ **`js/index.ts` is not a fifth layer, it is a second front door.** ADR-0140: one tree, two
artefacts — `app/index.html` loads the shell and bundles the engine (`dist/`), and this module is
imported by somebody else's shell with the engine left EXTERNAL (`dist-lib/`). 📏 Measured: 155 kB
for the app build against 42.9 kB for the lib, and the difference is exactly the engine and Zdog.

⚠️ **`boot/main.ts` exports `boot()` and starts nothing on import**, since 2026-09-11. It used to
end with a bare `boot()`, and ADR-0139 §2 forbids that for a cartridge: a module that boots when it
is loaded cannot be one of six on a page — it cannot be instantiated twice, it cannot be torn down,
and whatever it did at import time already happened before anybody decided it should. The shell is
where the call lives, and the platform will be a different shell around the same function.

`rules/` is the part that decides what the game IS — which tiles are correct, how long they last,
when a round is lost — and it is written so that none of that needs a screen to be true. Seven
modules, no imports outside their own siblings.

📏 That is not a style preference; it is what makes the whole of `rules/` testable in **milliseconds**
instead of seconds, and it is what decides whether adding a category is data or surgery. It is
locked by `tests/rules-boundary.node.test.ts`, which reads the imports rather than trusting them —
after the first version of that test anchored its regex to the start of a line and let two
violations walk straight through the thing it forbids.

---

## One canvas, and no PixiJS

```
zdog  →  #board-canvas (640×360)  →  a Canvas2D pass that stamps the digits
                                     on the projected tile centres
```

Zdog cannot map a texture: it draws flat-coloured polygons and nothing else. So the numbers are not
*on* the tiles — they are stamped by a second pass in the same 2D context, at the centres zdog has
already projected (`render/glyph-pass`, using the same projected corners `render/picking` uses to
hit-test without a raycaster).

⚠️ **PixiJS was in the plan and is not in the game.** Measured in the sibling chess repository:
Zdog+Pixi is 601.90 KB raw / 183.55 KB gzipped against Zdog alone at 137.07 KB / 45.61 KB — 465 KB
raw to draw a canvas inside another canvas, in a game that downloads on a school Chromebook. Both
reasons for it had evaporated: the HUD went to the DOM, and colour-vision correction was always a
filter on the region, never a Pixi filter. A whole class of bug went with it, since there is no
second copy of the image to forget to update.

**640×360**, which is the engine's 320 with `SOURCE_MULTIPLE = 2`. The reason is geometric: a
projected 3-D scene has no axis-aligned edge, every line is a diagonal, and a staircase step is one
source pixel — so it *grows* with the upscale. Doubling the source halves the step without touching
a single world unit. `ui/layout` then scales by a whole number of **physical** pixels (ADR-0001), so
the art stays regular at any device pixel ratio.

---

## Two boards, one funnel

The canvas is decoration. It carries `aria-hidden="true"`, and the board a screen reader finds is
`ui/grid-mirror`: twenty real `<button role="gridcell">` inserted **before** the canvas in the DOM,
with a roving tabindex, each named with its position, its content and its state.

Pointer and keyboard both arrive at the same `onActivate(spot)`. There is no second path, which is
what keeps "it works with a mouse" from ever meaning something different from "it works".

📌 A lit tile also **rises** (`TILE_RISE = 7`). Height is the non-colour channel, it is the mole
leaving its hole, and it is what let this game drop the original's flash — which was a
photosensitivity risk.

---

## The declaration is the accessibility layer

`declaration/whack-declaration.ts` is one file that answers the engine's contract, and answering it
is what buys the sonar for a blind player, role-based high contrast, the screen reader, Libras and a
translated HUD — none of which is written anywhere in this repository.

The whole trick is one line: **a lit tile carrying a WRONG value is a `hazard`**, in exactly the
sense the engine already means — something that costs you for touching it. From that, the sonar
points at the correct tiles and high contrast blocks out the wrong ones, with no audio and no
palette written here.

It reads `rules/` through a getter the composition root supplies, so it is built once and never goes
stale, and before the first round it answers with an empty mat — which the contract already treats
as "nothing to aim at", making the title and result screens conformant states rather than special
cases.

---

## What comes from the engine

Eleven import paths, and the game is deliberately shy of them:

| Path | For |
|---|---|
| `@the-inclusionist/engine` | `createGame` — the composition entry |
| `core/contract.js` | the contract types |
| `core/a11y-sr.js` | `srSay`, `srAlert` |
| `core/loop.js` | `startLoop` |
| `core/rng.js` | the seeded generator, so a round is reproducible in a test |
| `core/actions.js` | the fourteen positions and their validators |
| `core/constants.js` | `LOGICAL_W`, `TILE` |
| `platform/storage.js` | `KEYS`, so a child's choices carry between sibling games |
| `render/viz-axes.js`, `render/viz-modes.js` | resolving the two visual axes into one CSS filter |
| `render/viz-setters.js` | `lerVisualGuardado` — reading back a correction set in a sibling game |

✅ **It was thirteen, and three went with engine 9.0.0.** `ui/pause-icons.js`,
`ui/visual-axes-panel.js` and `core/i18n.js` were here because `createGame` mounted an accessibility
bar and a pause card for every game and accepted nothing to fill them with — so this game drew the
colour-vision button itself and spoke the engine's own words back to it. 9.0.0 takes `getPauseActs`,
`setTemaDoJogador` and `setCorrecaoDoJogador`; the engine mounts the icon, rings the correction and
says the sentence, and `app/js/ui/vision.ts` was deleted.

⚠️ **The three that remain are state, not markup**, and they live in `boot/standalone.ts` because the
seat belongs to the page rather than to one of six cartridges. A gate that fired the hour 9.0.0 was
installed is what caused the deletion; the record of what was missing stays in
[`engine-8-consumer-gaps.md`](engine-8-consumer-gaps.md), superseded rather than edited.

Plus one that is not JavaScript: `app/css/style.css` opens with
`@import '@the-inclusionist/engine/style.css' layer(engine)`. The engine mounts the pause card and
the bar and ships the CSS for neither in the JS, and seven selectors are written in both sheets.
`layer(engine)` puts all 644 of its lines UNDER this game's unlayered rules — in the cascade an
unlayered declaration beats a layered one whatever its specificity — so an engine `.hud` cannot
arrive as a layout bug from a dependency. ⚠️ A layer protects only the properties this sheet
DECLARES; `flex-wrap` was left unsaid once, and a column that wraps opened a second column outside
the panel.

⚠️ **`startLoop` hands out `deltaTime` in FRAMES, not seconds** — PixiJS's convention, which the
engine inherited, about 1.0 at 60 fps and clamped at 2. Every formula in `rules/` is in
**milliseconds** and converts at the boundary (`FRAME_MS`). Physics copied from a tutorial in
seconds runs wrong here, quietly.

---

## Where state lives

| What | Where | Why there |
|---|---|---|
| The round | `rules/round.ts`, one closure | Nothing else may reach in; events come out as a list |
| The choice (category, difficulty, defeat, pace) | `boot/main.ts`, read from `ui/options` | A round is *started* with it, never asks for it mid-flight |
| The best score | `localStorage`, `incl.whackwhack.highscore` | Read ONCE at boot and held: the HUD refreshes several times a second |
| The colour-vision correction | `KEYS.visualP(0)` — the ENGINE's key | So a child who sets it here finds it set in the next inclusionist game |
| Camera lean | `render/camera.ts` | Decoration. It cannot reach a round, and a test proves it |

---

## How it is checked

Two Vitest projects and a mutation harness:

- **`node`** — `rules/`, the declaration, the palette arithmetic, the documents. No DOM, milliseconds.
- **`browser`** — real Chromium via Playwright: the zdog backing store, the mirror's focus, contrast
  by counting pixels, and the one test that boots the composition root (`tests/a11y.browser.test.ts`).
- **`tests/mutation-check.sh`** — every gate is born red and proven able to fail. It runs the cheap
  project first and only reaches for the browser when `node` did not already catch the mutation.
- **`tests/mutation-anchors.node.test.ts`** — and because an anchor that matches nothing looks
  exactly like coverage, `npm test` checks in a third of a second that all of them still bite
  something, and that none is one the shell would eat before the harness sees it.
