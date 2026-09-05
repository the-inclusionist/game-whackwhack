# Game rules

Two things live here: what the original does, and where this game departs from it. The first half
is also the **clean-room record** — the rules were described here from observation, and the code was
written from this description rather than from the original's source. See `docs/LICENSES.md` §4 for
why that distinction is load-bearing.

## 1. What si-em/whackwhack does

Observed 2026-09-05 from the public repository and the live build at `whackwhack.netlify.app`.
Title: *Whack Whack — Revolution!* — a Dance Dance Revolution parody. There is no mole: what is
struck is a **slab of the mat that lights up**, like a DDR arrow.

- **Mat** — 20 slabs, 4×5 on narrow screens and 5×4 above the `medium` breakpoint, drawn in CSS 3D
  with `perspective` and `rotateX(15deg)`. The mat also tilts with the mouse position.
- **Goal** — click the lit slab before its timer runs out. Each hit is one point.
- **Defeat** — **sudden death**. No lives, no round clock: if *any* lit slab expires, the game ends
  immediately.
- **Level** — `Math.ceil(timeLapsed / 15)`, rising every 15 seconds. ⚠️ The comment in the source
  says "every 20 seconds" and disagrees with the code; the code wins.
- **Spawn interval** — `Math.round(1000 * (3 / level))` ms: 3000, 1500, 1000, 750…
- **Time to hit** — `Math.max(0, 9000 - 9000 * 0.22 * level) + 5000` ms: 12020, 10040, 8060, 6080,
  then a floor of 5000.
- **Feedback** — a "+1" in the footer, and every fifth point one of `Awesome! / Good! / Savage! /
  On fire! / Combo!`.
- **Persistence** — high score in `localStorage`. No backend.
- **Audio** — none at all, despite the rhythm-game framing.

### Defects observed, and not reproduced

| In the original | Why not carried over |
|---|---|
| `getRandomSlab()` can pick a slab that is already lit | Orphans the previous timer: a slab that can neither be hit nor expire |
| `Slab.vue` adds a `$root.$on('stop-slab-timers')` listener on every light-up, never removed | Listeners accumulate for the whole session |
| Durations stated twice — computed in `Slab.vue`, and again as CSS animation lengths in `_gamepad.scss` — and the two disagree | Two sources of truth for the same number |
| `level` is 0 on the first frame, making `1000 * (3 / level)` infinite | Survives only because a counter happens to tick first |
| `Score.vue` is an empty component, never imported | Dead code |

### Accessibility of the original

Slabs are real `<button>`s inside a list, so they are reachable by Tab — that part is good. The rest
is not: `outline: none` with no replacement (WCAG 2.4.7), the lit state signalled by colour and
transform alone with no `aria-pressed` or label (1.4.1, 4.1.2), no `aria-live` on the score, no
`prefers-reduced-motion` on animations that **blink** (2.3.1), and a mouse-only tilt. The `<h1>` is
the score rather than the game.

## 2. What this game does differently

### The tiles carry content

The central change. A tile shows a **number**, and the round names a category — evens, multiples of
three, multiples of four. The child collects the **correct** ones. This turns a purely motor task
into a discrimination task, which is what earns the game its place in an educational engine.

Categories are data (`app/js/rules/category.ts`): a predicate and a pool. Adding one is a data
change, and `tests/rules-boundary.node.test.ts` is what keeps that true.

### The wave replaces the loose tile

In the original, tiles light independently and the count on screen drifts. That is right for "hit
what is lit" and wrong for "hit the correct one among what is lit": the child must know **which set**
they are choosing between, and two overlapping sets are ambiguous rather than hard.

So the unit is the **wave** — N tiles light together, resolve together, and always contain at least
one correct and at least one incorrect value. N is the difficulty: 2 easy, 3 medium, 4 hard.

| Event | Effect |
|---|---|
| Hit a **correct** tile | +1, tile goes dark |
| Hit an **incorrect** tile | error |
| A **correct** tile expires | error |
| An **incorrect** tile expires | the right move — goes dark, no penalty |

### The timing curve is kept

`levelAt`, `waveDeadlineMs` and `waveGapMs` in `app/js/rules/difficulty.ts` are the original's own
formulas. A weekend game people actually played is better evidence of a ramp that feels right than
anything derived at a desk. Two corrections: the level is clamped to 1 (the original's level 0 makes
the gap infinite), and the timing now lives in exactly one file.

### Three defeat modes, and the player picks

`sudden-death` is the original unaltered. `lives` spends three mistakes. `endless` cannot be lost.
Every mode has a goal of 20 correct hits, because the engine's `objectiveOf` owes the HUD and the
sonar a "how many of how many".

⚠️ Difficulty (how many tiles light) is **orthogonal** to the engine's EASY (how wide the timing
is). One is a curricular dial, the other a motor accommodation. Folding them together would offer
accessibility as though it were a baby mode.

### The lit tile rises

The original signals a lit slab with colour and a blink. Here the primary channel is **height** —
the tile lifts out of the mat. It is the non-colour channel WCAG 1.4.1 asks for, it is the mole
leaving its hole, and it removes the blink, which is a photosensitivity risk under WCAG 2.3.1.
Colour and outline are secondary channels, not the only ones.
