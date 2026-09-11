# Conformance, measured — and where it stops

**Measured on 2026-09-11**, against WCAG 2.1 and the parts of 2.2 that apply. Every number below is
read off the code or off a running browser, never estimated.

---

## What this document is

A list of what this game meets, what it does not, and what no check here can see. It is **not** a
certification and not a VPAT.

⚠️ **AAA is never claimed in bulk.** Two criteria at level AAA are met and are named individually,
with the measurement beside them; one is NOT met and is named just as plainly. A game that claimed
"AAA" as a badge would be claiming forty-odd things it never measured.

⚠️ **And the target is a floor, not a ceiling.** `tick: 'clock'` is the contract field that says this
game is timed, which puts a whole family of criteria in play that a quiz never has to answer. Where
this game goes past AA it is because the failure would land on a specific child, not because the
letter was available.

---

## Met, with the measurement

| Criterion | Level | Measured |
|---|---|---|
| **1.4.1** Use of Colour | A | A lit tile **rises** (`TILE_RISE` in `render/mat`). Height is the non-colour channel; colour is the second one, never the first. |
| **1.4.11** Non-text Contrast | AA | Lit tile vs idle **3.38:1**, idle tile vs ground **3.10:1** — floor 3. Searched, not chosen: see `render/palette`. |
| **1.4.6** Contrast (Enhanced) | **AAA** | The digits, and only the digits: **10.53:1** on a cold tile and **19.37:1** on a hot one, against a target of 7. They are what a child has to read. |
| **2.1.1** Keyboard | A | The whole game. Twenty real `<button role="gridcell">` in `ui/grid-mirror`, a real button on the title, radios and cyclers in the HUD. The canvas is `aria-hidden`. |
| **2.2.1** Timing Adjustable | A | A ring of **×1, ×2, ×5, ×10** on every deadline, chosen before the clock starts, plus an `endless` mode with no defeat. The criterion asks for a range of *at least ten times* the default; `×10` is what makes the claim true, and two tests assert the ratio rather than the numbers. |
| **2.3.1** Three Flashes | A | **Nothing blinks.** The original's `blink-and-fade-out` became a fade: the blink carried only the risk. Its tiles flash; these rise. |
| **2.4.7** Focus Visible | AA | 3 px outlines with offset on every focusable control, in `--tile-lit` against every ground this game has. |
| **2.5.7** Dragging Movements | AA (2.2) | The mat leans by keyboard nudge (Shift+Arrow, Shift+Home to square it) and by pointer. Nothing requires a drag. |
| **2.5.8** Target Size (Minimum) | AA (2.2) | Smallest visible target measured at **34×44 px**, against a minimum of 24. The mat tiles are far larger (~116 px at a 1× scale). |
| **4.1.2** Name, Role, Value | A | axe-core reports zero violations in **both** states — title and running round — and over **both** the module graph (`tests/a11y.browser.test.ts`) and the built bundle (`tests/axe-url.mjs`). |

Beyond the letter: a **colour-vision correction** (protanopia, deuteranopia, tritanopia) is reachable
from the accessibility bar, and the whole palette was searched under those three simulations before
a colour was chosen. WCAG does not ask for this; the children it is for do.

---

## NOT met, and why

### 2.5.5 Target Size — AAA, and this game misses it by 10 px

📏 The eight number buttons in the HUD measure **34 px wide** against the 44 the criterion asks for.
Every other target in the game clears 44, including the accessibility bar, which is held there by a
test.

The fix is one line and it is **not** being taken unilaterally, because it is not free: 44 px across
four columns is 176 px, and the HUD column is already 99 px short of its content at 800×600. Widening
the grid without deciding what yields that height would trade one failure for a worse one. Recorded
here and as item **A1c** in the plan, where the layout decision lives.

### High contrast is not reachable

The engine ships three high-contrast levels and the icon that cycles them, and mounts the icon for
no game that boots through `createGame` — it decides by asking `Boolean(ctx.setTemaDoJogador)`, a
writer it never passes and its options cannot carry. Measured and reported in
[`engine-8-consumer-gaps.md`](engine-8-consumer-gaps.md).

⚠️ **This is not a contrast FAILURE**: the default palette clears every floor above, measured. What is
missing is the *choice*, for a child who needs more than the floor.

📏 **And two of the three levels turn out to be arithmetic rather than taste**, measured 2026-09-11 and
printed by `tests/palette-search.cjs`. The mat is three stacked surfaces, and the two steps —
ground→unlit and unlit→lit — **multiply to the whole climb**, because the middle luminance cancels:
`(Li/Lg) × (Ll/Li) = Ll/Lg`. The climb is capped at 21, white on black. So:

| Level | Both steps need | Climb required | Verdict |
|---|---|---|---|
| `hc3` | 3:1 | 9.00 | **already met** by the shipped palette — 3.34 and 5.82, climb 19.40 |
| `hc45` | 4.5:1 | 20.25 | reachable, and it costs the purple: the best balanced candidate is a **grey** mat at 4.40 / 4.41, holding across all three colour-vision matrices, 0.1 short of the target |
| `hc7` | 7:1 | 49.00 | **impossible for any palette, in any hue** |

That is not a reason to drop `hc7`. It is a measurement saying its distinction must move **off**
luminance — an outline, a fill pattern — because the two steps compete for one fixed budget.

### The HUD column scrolls on a small screen

At 800×600 the column needs 99 px more than it has, so the accessibility bar's last row is cut off
and reachable by scrolling. Nothing is unreachable; it is undiscoverable, which is a different and
smaller failure. At 1280×720 it fits exactly, with nothing to spare. Plan item **A1c**.

---

## What nothing here can see

axe is a static check, and so is every test in this repository. None of them can tell:

- whether a five-second deadline is **survivable** for the child it is aimed at — timing pressure is
  not a property of a DOM;
- whether the announcements arrive in an order that makes sense to somebody who cannot see the mat,
  or arrive twice;
- whether the colour pairs hold up for a real person with a colour-vision difference, as opposed to
  holding up under a simulation matrix;
- whether a child understands what "collect multiples of 3" is asking.

📌 **No screen-reader user has tested this game.** It is written here rather than left out, because a
document that listed only what passed would read as though somebody had.

---

## How to re-measure

```bash
npm test                                   # every gate, including the numbers in this document
npm run test:a11y                          # axe over the module graph
AXE_URL=http://localhost:8199 npm run test:a11y   # and over the built bundle, both states
bash tests/mutation-check.sh               # proves the gates above can fail
```

The contrast figures live in `app/js/render/palette.ts`, which carries the search that produced them.
`tests/docs.node.test.ts` holds this document to those numbers, so a colour that moves takes this
page with it.
