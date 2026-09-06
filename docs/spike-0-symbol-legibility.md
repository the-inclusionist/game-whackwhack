# Spike 0 — symbol legibility on a tile, at 640×360

> ## ⚠️ FIVE OF THIS DOCUMENT'S CONCLUSIONS NO LONGER HOLD
>
> **Read the measurements; do not read the decision table as current.** Everything below was
> measured on 2026-09-05 and every number in it is still an accurate record of what was measured
> that day. What has moved is what the game DOES with those numbers, and a record that keeps
> asserting a dead position argues against the next reader — so the changes are listed here, at the
> top, rather than left to be discovered in the table at the bottom.
>
> | This document says | The game does | Where it was decided |
> |---|---|---|
> | Digit shape: **seven segments** | **Atkinson Hyperlegible** | See "the verdict that was reversed", below |
> | Glyph height **9** world units | **8** | `render/glyph.ts`, and the Dev's "um pouco menores" |
> | Stroke **1.5** for the glyph | not used — text has no stroke | `render/glyph-pass.ts` |
> | Camera zoom **4.4** | **5.0** | `render/zdog-stage.ts`, twice corrected |
> | The glyph is a sprite **in the Pixi pass** | a Canvas2D pass; **PixiJS was removed** | measured at 465 KB raw for one canvas drawn into another |
>
> ### The verdict that was reversed, and why the measurement was not wrong
>
> This spike rejected "a proportional face" and it gave a real reason: at the size a tile affords,
> thin strokes vanish into the antialiasing and a 6 starts to look like a 5. That finding is sound
> and it was never contradicted. What it did not test is the one typeface drawn to answer it.
>
> Atkinson Hyperlegible, by the Braille Institute, exists to disambiguate exactly the characters low
> vision confuses. The spike optimised for CRISPNESS — a segment display's whole virtue, and it wins
> that measurement outright: 10.7% edge smear against the 32.2% the text now measures. It did not
> measure CONFUSABILITY, which is the failure a child actually suffers, and on that axis a segment
> display is silent: every digit is built from the same seven bars.
>
> Crisp-but-confusable is the worse trade for a number that has to be read. The smear cost is
> recorded in `tests/mat.browser.test.ts`, where the threshold moved from 0.12 to 0.40 with the
> reasoning beside it, and the confusability gain is asserted in `tests/glyph.browser.test.ts`,
> which measures that 6/9, 1/7, 0/8 and 3/8 rasterise differently.
>
> ### What still holds, and is load-bearing
>
> · **Candidate (b) itself** — the symbol is stamped at the tile's PROJECTED CENTRE, upright,
>   after the 3D pass. Only the brush changed, from segment bars to `fillText`. The two candidates
>   this spike killed are still dead, and for the reasons it measured: flat on the face renders
>   "12" as "IC", and standing upright is correctly occluded by the row in front, which is exactly
>   the problem.
> · **Zdog does no texture mapping**, which is why there is a stamping pass at all.
> · **The tile rise of 7 world units**, still the primary non-colour channel for "this tile is in
>   play" (WCAG 1.4.1).
> · **The pixel-scan method** — measuring smear as perpendicular distance in RGB to the segment
>   between two colours — which is the technique the palette and the mat-seam tests still use.


**Verdict: (b), the sprite at the projected centre. GO.**

Measured 2026-09-05 with `spike/symbol-legibility.html`, served over HTTP and driven from
`window.__spike_api`. Nothing here was estimated; every number below came out of a pixel scan or a
geometry probe on the same canvas the game will draw into.

## Why this spike had to happen before any render code

**Zdog does no texture mapping.** It draws flat-shaded polygons and nothing else, so "write the
number on the tile face" is not an available move. The number has to be *geometry* or it has to be
*a second pass*, and those are different renderers with different failure modes. Choosing wrong
means rewriting the renderer, which is exactly what a spike is for.

A second correction to the framing, made while building the page: **Zdog projects orthographically**,
so a distant tile is not smaller — every tile projects the same parallelogram. The risk was never
distance. It is the **foreshortening** of a glyph lying on a tilted face, which costs `cos(pitch)`
of its height. That is what split candidate (a) into two.

## The three candidates

| | What it is | Where it lives |
|---|---|---|
| **a1** | Glyph as Zdog stroke geometry, lying flat on the tile face | one canvas |
| **a2** | Same, standing upright and counter-rotated to face the camera | one canvas |
| **b** | Axis-aligned pixel-art glyph drawn at the tile's projected centre | a Pixi pass over the Zdog texture |

Candidate (b) is cheap to place because the projected corners are already there: after
`updateGraph()` every `Zdog.Rect` carries its four corners as `pathCommands[i].endRenderPoint` — the
same points the renderer is about to draw. That is how the chess game does picking without a
raycaster, and reading them again for the centre costs nothing.

## Method

The scan classifies every pixel in the measured tile's projected box as ink, tile, **blend**, or
off-axis. A Canvas2D edge is a linear mix of the two colours, so a blend lands *on the line segment*
between them in RGB; the metric is the perpendicular distance to that segment. Smear is reported as
`blend / (ink + blend)` — what fraction of the glyph's own pixels are a half-tone rather than ink.

⚠️ **Three wrong versions of this measurement preceded the one above, and all three inflated the
number.** They are recorded because each was plausible:

1. *"Anything that is neither ink nor tile is partial"* → 79–88%. It swept in the background and the
   neighbouring tiles. That is scenery, not antialiasing.
2. *"Each channel lies between ink and tile"* → 66–88%. That is a bounding **box** in RGB, and the
   unlit tile `#2E3B4E` sits inside it on all three channels, so unlit neighbours counted as smear.
3. The segment test, but with **candidate (b) drawn using `ctx.stroke()`** → (b) scored 16–39%. A
   pixel-art sprite has no antialiasing at all; stroking a path blurs both edges of every segment.
   Measuring (b) that way compared Zdog against a straw man.

A fourth unfairness ran the other way and had to be fixed too: (b) was using its own stroke weight
(`pxHeight / 5`, about 8 px) where the Zdog candidates draw 6.6 px. Fat strokes close the counters
of 6, 8 and 9, so (b) *looked* mangled for a reason that had nothing to do with the approach.

## Measured

Ink height in pixels / smear percentage. Stroke 1.5, zoom 4.4, pitch −0.9, tile 16 units → 70 px
projected. `18` and `20` are ordinary two-digit cases; `12` is the narrowest; `7` is the worst case
for every candidate, having the fewest segments and so the highest edge-to-ink ratio.

| glyph H | value | a1 lying | a2 standing | **b sprite** |
|---|---|---|---|---|
| 8 | 12 | 20 / 28.9% | 41 / 21.9% | **42 / 5.5%** |
| 8 | 7  | 20 / 47.4% | 41 / 24.2% | **35 / 11.9%** |
| 8 | 18 | 20 / 26.6% | 41 / 20.4% | **42 / 4.6%** |
| 9 | 12 | 22 / 27.2% | 46 / 20.2% | **47 / 4.0%** |
| 9 | 7  | 22 / 49.8% | 46 / 24.9% | **40 / 10.7%** |
| 9 | 20 | 22 / 23.3% | 46 / 16.9% | **47 / 2.6%** |
| 10 | 18 | 23 / 26.2% | 60 / 19.6% | **51 / 3.0%** |

**a1 is not a close third, it is disqualified.** At pitch −0.9 the theoretical foreshortening is
0.622, and the observed ink height confirms it: 22 px against 46. But the fatal part is not the
measurement, it is what the screen shows — **"12" renders as "IC"**. A misread digit is a curriculum
error, not an aesthetic one, and no stroke weight fixes a glyph the projection has flattened.

## The thing the numbers did not say

(a2) reads correctly, but a standing glyph necessarily occupies screen space belonging to the row
behind it. Two lit tiles in adjacent rows therefore clip each other's numbers — and Zdog sorts that
*correctly*, which is the problem: a correctly occluded number is still a half-hidden number. The
glyph also floats visibly above its tile rather than sitting on it.

(b) has the opposite property, and the one objection to it is that a sprite composited over the
whole Zdog texture **cannot be occluded by geometry in front of it**. That objection was tested
rather than argued:

| lit tiles | far tile [2,1] spans | near tile [2,2] top | overlap |
|---|---|---|---|
| none | y 127.4 – 177.4 | 182.6 | none |
| all, rise 7 | y 108.3 – 158.3 | 163.4 | none |
| only the far one, rise 7 | y 108.3 – 158.3 | 182.6 | none |
| only the near one, rise 7 | y 127.4 – 177.4 | 163.4 | 14 px — but the far tile is unlit, so no glyph |

Across every rise from 0 to 10, a near tile covered the far tile's projected centre in **0 of 15**
pairs. The reason is structural rather than lucky: **only a lit tile has a glyph, and only a lit
tile rises**, so anything that could cover a glyph is either lit too — raised by the same amount,
leaving the relative geometry unchanged — or unlit, and therefore lower. The probe does respond to
geometry: a rise of 7 units lifts a tile 19.1 px, which is `7 · cos(0.9) · 4.4`.

So (b)'s limitation is real in principle and unreachable in this game's geometry.

## Contrast, including colour-vision simulation

Computed over the colours rather than sampled from pixels: the sRGB ratio is defined on colours, and
sampling would only add antialiasing noise.

| mode | glyph / lit tile | lit / unlit tile | unlit tile / background |
|---|---|---|---|
| normal | 12.77 | 7.81 | **1.58** |
| protanopia | 12.19 | 7.19 | **1.60** |
| deuteranopia | 13.14 | 8.24 | **1.56** |
| tritanopia | 12.22 | 7.41 | **1.59** |

The glyph clears AAA (7:1) with room to spare in every mode, and so does lit-against-unlit. The
palette was chosen on **luminance** distance, which is why the colour-vision matrices barely move it.

⚠️ **One failure, and it is a real one: the unlit tile does not read against the background at
1.58:1**, well under the 3:1 floor of WCAG 1.4.11 for non-text. On screen the mat dissolves into the
ground and the player cannot see where the unplayed tiles are. This is a provisional spike palette,
but the defect carries forward as a requirement for `render/palette.ts`: **the unlit tile must reach
3:1 against the background**, and that has to be measured there rather than assumed from here.

## Locked

> ⚠️ **AS DECIDED ON 2026-09-05.** Five of these rows have since changed; the table at the top
> of this file says which, and where the current value lives. Left unedited on purpose: this is
> the record of what was decided that day, and rewriting it would destroy the only copy of that.

| Decision (2026-09-05) | Value as decided then |
|---|---|
| Symbol | **(b)** — axis-aligned pixel glyph at the projected centre, in the Pixi pass |
| Glyph height | 9 world units on a 16-unit tile |
| Stroke | 1.5 world units, matching the chess game's measured knee |
| Camera | pitch −0.9, zoom 4.4, yaw 0 |
| Tile rise when lit | 7 world units — 19.1 px on screen |
| Digit shape | seven segments, so no digit is ambiguous at this size |

Two consequences for the renderer. The glyph layer is a Pixi container above the board sprite, which
the existing `pixi-surface` shape already accommodates — no new architecture. And the glyph stays
upright while the camera nudges, which is a feature rather than a compromise: a number should not
rotate away from the reader because they squared up the board.

## Open, and deliberately not decided here

Whether a **picture** category (recyclables) can use the same pass. A pixel-art bottle is a sprite
like any other, so the mechanism carries; whether the artwork reads at 47 px is a separate
measurement, and it is not needed until a picture category exists. The shipped categories are
numeric.
