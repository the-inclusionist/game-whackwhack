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

The central change. A tile shows a **number**, and the round names a category — multiples of two
through nine, offered as a row of eight chips in the HUD. The child collects the **correct** ones.
This turns a purely motor task into a discrimination task, which is what earns the game its place in
an educational engine.

Categories are data (`app/js/rules/category.ts`): a predicate and a pool. Adding one is a data
change, and `tests/rules-boundary.node.test.ts` is what keeps that true. The pool grows with the
factor rather than being fixed at 1..20 — multiples of nine inside twenty are 9 and 18, and four
tiles can be up at once with no two carrying the same value.

### Tiles arrive one at a time, as in the original

> ⚠️ **CORRECTED.** This section used to describe a **wave**: N tiles lighting together as a set to
> compare, N being the difficulty. That was an invention of this reimplementation, not a rule of
> the original, and it was wrong. The argument for it was that a child choosing between items needs
> to know which set they are choosing between — which does not survive contact with the task. The
> question is not "which of these three" but "does THIS one belong", asked of each tile as it
> appears. Per-tile discrimination is the same educational content and a simpler question, and it is
> the one the original's own shape already supports.

Tiles light **independently**, each on its own timer, appearing and vanishing at random — the
original's behaviour. Difficulty is a **ceiling on how many are up at once**: 2 easy, 3 medium,
4 hard. Two tiles never share a cell, and never carry the same value at the same time.

| Event | Effect |
|---|---|
| Hit a **correct** tile | +1, tile leaves the mat |
| Hit an **incorrect** tile | error |
| A **correct** tile expires | error |
| An **incorrect** tile expires | the right move — leaves in silence, no penalty |

### A level is a budget of tiles

Level N asks about **N tiles**, with a floor of four for the first four levels, and it ends when all
of them have been judged. `app/js/rules/spawn.ts` composes the whole level up front, guaranteeing at
least one correct and one incorrect value and weighting the correct share between a third and two
thirds — an unweighted coin over twenty tiles produces near-all-wrong levels often enough that a
child would learn the game was broken rather than that they were careful.

### The timing curve is kept, but the level is no longer a clock

`tileDeadlineMs` and `spawnGapMs` in `app/js/rules/difficulty.ts` are the original's own formulas,
and they still take a level and still produce its numbers. A weekend game people actually played is
better evidence of a ramp that feels right than anything derived at a desk.

⚠️ What is **not** kept is `levelAt(elapsedMs)` — the original raised the level every fifteen
seconds. A budget of tiles and a clock cannot both decide when a level ends, and the budget is the
one that can be watched: at level twenty, twenty tiles appear and vanish to be judged. The side
effect is one the original could not offer: a child who works slowly is no longer hurried by a clock
they were never shown. Two other corrections stand: the level starts at 1, so the original's level 0
(which makes the gap infinite) never exists, and the timing lives in exactly one file.

### Each tile carries its own countdown

The colour is the clock: a tile lights white and cools towards pink over **its own** deadline, and
settles as it cools so the fact has a non-colour channel too (WCAG 1.4.1). One countdown per tile
rather than one per set is what the independent model requires — two tiles that arrived seconds
apart do not share a deadline.

### Three defeat modes, and the player picks

`sudden-death` is the original unaltered. `lives` spends three mistakes. `endless` cannot be lost.
Every mode has a goal of 20 correct hits, because the engine's `objectiveOf` owes the HUD and the
sonar a "how many of how many".

⚠️ Difficulty (how many tiles may be up at once) is **orthogonal** to the engine's EASY (how wide
the timing is). One is a curricular dial, the other a motor accommodation. Folding them together would offer
accessibility as though it were a baby mode.

### The lit tile rises

The original signals a lit slab with colour and a blink. Here the primary channel is **height** —
the tile lifts out of the mat. It is the non-colour channel WCAG 1.4.1 asks for, it is the mole
leaving its hole, and it removes the blink, which is a photosensitivity risk under WCAG 2.3.1.
Colour and outline are secondary channels, not the only ones.
