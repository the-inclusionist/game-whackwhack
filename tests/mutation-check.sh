#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Proves each gate can actually fail. Green that could never have been red proves nothing.
# Applies one mutation at a time, runs BOTH projects, and expects a FAILURE. Always restores.
#
# ⚠️ The substitution runs through tests/mutate.cjs rather than `node -e`, which in this sandbox
# writes nothing, prints nothing and exits 0 — turning every mutation into a false "escaped".
set -u
cd "$(dirname "$0")/.."

# Every source root, declared together. They used to be introduced one at a time next to the block
# that first needed them, and a block inserted above its own declaration failed with `unbound
# variable` — under `set -u`, which is the only reason it failed loudly rather than mutating the
# file at path "/announce.ts" and reporting a skip.
RULES=app/js/rules
DECL=app/js/declaration
RENDER=app/js/render
UI=app/js/ui
I18N=app/js/i18n
INPUT=app/js/input
BOOT=app/js/boot
STORE=app/js/store
# The stylesheet is source too: tests/feedback.browser.test.ts asserts on a computed animation
# name, and nothing else in this file could break that assertion.
CSS=app/css
# The documents are source too: tests/docs.node.test.ts holds the numbers they state to the
# numbers the code uses, which is the half of prose that can be checked at all.
DOCS=docs
# The repository's own config, for the comments in it that make checkable claims.
CFG=.
# The test scripts are source too: tests/axe-url.mjs is the only audit of the BUILT bundle.
TESTS=tests
# The shipped page. tests/a11y.browser.test.ts reads it with `?raw` rather than imitating it, so
# the markup createGame requires is gated where it actually lives.
APP=app

NAMES=(); FILES=(); FROMS=(); TOS=()
add() { NAMES+=("$1"); FILES+=("$2"); FROMS+=("$3"); TOS+=("$4"); }

add "outcomeOf lets a win beat a loss" \
    "$RULES/defeat.ts" \
    "  if (tally.errors > errorBudget(mode)) return 'lost';" \
    "  if (tally.hits >= ROUND_GOAL) return 'won';"

add "sudden death tolerates one mistake" \
    "$RULES/defeat.ts" \
    "  if (mode === 'sudden-death') return 0;" \
    "  if (mode === 'sudden-death') return 1;"

add "endless becomes losable" \
    "$RULES/defeat.ts" \
    "  return Infinity;" \
    "  return 10;"

add "multipleOf stops guarding its pool" \
    "$RULES/category.ts" \
    "  if (right < MIN_PER_SIDE || wrong < MIN_PER_SIDE) {" \
    "  if (false) {"

add "the pool grows past two digits" \
    "$RULES/category.ts" \
    "export const POOL_MAX = 20;" \
    "export const POOL_MAX = 200;"

add "a rules module names a browser global" \
    "$RULES/defeat.ts" \
    "  if (mode === 'sudden-death') return 0;" \
    "  if (mode === 'sudden-death') return document ? 0 : 0;"

DECL=app/js/declaration

add "a wrong tile becomes a goal, so the sonar aims at mistakes" \
    "$DECL/whack-declaration.ts" \
    "      return tile.correct ? 'goal' : 'hazard';" \
    "      return 'goal';"

add "a wrong tile stops being a hazard" \
    "$DECL/whack-declaration.ts" \
    "      return tile.correct ? 'goal' : 'hazard';" \
    "      return tile.correct ? 'goal' : 'free';"

add "the wrong tile falls silent for a screen reader" \
    "$DECL/whack-declaration.ts" \
    "      if (!tile) return null;" \
    "      if (!tile || !tile.correct) return null;"

add "the world is declared as the canvas, leaving the mirror and the HUD outside it" \
    "$DECL/whack-declaration.ts" \
    "const WORLD: WorldScope = { kind: 'element', selector: '#game-region' };" \
    "const WORLD: WorldScope = { kind: 'element', selector: '#board-canvas' };"

add "the game declares it has no world at all" \
    "$DECL/whack-declaration.ts" \
    "const WORLD: WorldScope = { kind: 'element', selector: '#game-region' };" \
    "const WORLD: WorldScope = { kind: 'none' };"

add "the topology is answered once and cached, so a resize would go stale" \
    "$DECL/whack-declaration.ts" \
    "    topology(): Topology { return TOPOLOGY; }," \
    "    topology(): Topology { return { kind: 'grid', cols: 1, rows: 1 }; },"

# The two fields the published contract added to a grid, and neither is bookkeeping.
add "the mat claims a diagonal it cannot move along" \
    "$DECL/whack-declaration.ts" \
    "  move: 'orthogonal'," \
    "  move: 'diagonal',"

add "directions are spoken in clock positions, on a board seen from above" \
    "$DECL/whack-declaration.ts" \
    "  frame: 'compass'," \
    "  frame: 'clock',"

add "the mat declares its size the wrong way round" \
    "$DECL/whack-declaration.ts" \
    "  size: [MAT_COLS, MAT_ROWS]," \
    "  size: [MAT_ROWS, MAT_COLS],"

# ========================= WHAT ENGINE 8 ADDED TO THE CONTRACT =========================
# `holdsAtOnce` is REQUIRED, and the engine validates its SHAPE — a function returning an integer
# of at least one. What it cannot validate is the NUMBER, which is this game's own claim, so the
# first two mutations below are the only thing standing between "1" and a figure nobody checked.
add "the game claims a child must hold three positions at once" \
    "$DECL/whack-declaration.ts" \
    "    holdsAtOnce(): number { return 1; }," \
    "    holdsAtOnce(): number { return 3; },"

add "the game claims it holds nothing, which cannot be played" \
    "$DECL/whack-declaration.ts" \
    "    holdsAtOnce(): number { return 1; }," \
    "    holdsAtOnce(): number { return 0; },"

# ⚠️ Declaring a pointer REQUIRED would refuse the game to a child navigating by keyboard, which
# is the one input path every screen here was built around.
add "the game declares it cannot be played without a pointer" \
    "$DECL/whack-declaration.ts" \
    "    holdsAtOnce(): number { return 1; }," \
    "    holdsAtOnce(): number { return 1; }, needsPointer(): boolean { return true; },"

# ⚠️ `seguraTeclas` IS THE OTHER HALF, and the engine can validate that it is a boolean and never
# WHICH boolean. `true` mounts a latching control on the accessibility bar of a game where nothing
# is held — the dead button of ADR-0106 §5, in front of the one child who went looking for it.
add "the game claims a key is held, and gains a latch that latches nothing" \
    "$DECL/whack-declaration.ts" \
    "    seguraTeclas(): boolean { return false; }," \
    "    seguraTeclas(): boolean { return true; },"

# ⚠️ AND THE KEYBOARD MAP, where the failure is one key doing two jobs. The engine's factory binds
# `start` to KeyH AND Enter; Enter also activates the twenty gridcell buttons natively, so leaving
# the factory alone makes a single press whack a tile and open the pause over it.
add "Enter goes back to pausing, so one press both whacks and pauses" \
    "$DECL/whack-declaration.ts" \
    "  start: Object.freeze(['KeyH', 'Escape'])," \
    "  start: Object.freeze(['KeyH', 'Enter']),"

add "the map answers a different table per seat, in a game that seats one child" \
    "$DECL/whack-declaration.ts" \
    "    mapeamentoDoTeclado(): Partial<Record<Action, readonly string[] | null>> {" \
    "    mapeamentoDoTeclado(j: number): Partial<Record<Action, readonly string[] | null>> { if (j > 1) return {};"

# ⚠️ AN UNWRITTEN "no" AND A FORGOTTEN FIELD LOOK IDENTICAL IN A DIFF. The pad keeps the engine
# factory because there is no collision there — `start` is button 9 and the hammer is a face button
# — and that decision lives in a comment beside the keyboard map. Losing the comment loses the
# decision and leaves an absence nobody can tell from an oversight.
add "the pad decision stops being written where an editor of the declaration meets it" \
    "$DECL/whack-declaration.ts" \
    "     * ⚠️ \`mapeamentoDoPad\` IS ABSENT, AND THE ABSENCE IS THE ANSWER" \
    "     * The pad is left alone"

add "the tick goes back to the player" \
    "$DECL/whack-declaration.ts" \
    "    tick: 'clock'," \
    "    tick: 'player',"

add "targetsOf hands back the wrong tiles too" \
    "$DECL/whack-declaration.ts" \
    "        .filter((t) => t.correct)" \
    "        .filter(() => true)"

add "the cursor claims a heading it cannot act on" \
    "$DECL/whack-declaration.ts" \
    "      return { id: 'cursor', at, heading: 'none' };" \
    "      return { id: 'cursor', at, heading: 'n' };"

add "the objective name stops going through the dictionary" \
    "$DECL/whack-declaration.ts" \
    "          text: deps.t(view.category.nameKey)," \
    "          text: view.category.id,"

add "the objective loses its denominator" \
    "$DECL/whack-declaration.ts" \
    "        need: ROUND_GOAL," \
    "        need: 0,"

add "targetsOf reads the grid column-major" \
    "$DECL/whack-declaration.ts" \
    "        .map((t) => ({ x: t.cell % MAT_COLS, y: Math.floor(t.cell / MAT_COLS) }));" \
    "        .map((t) => ({ x: Math.floor(t.cell / MAT_COLS), y: t.cell % MAT_COLS }));"

add "the grid loses its bounds check" \
    "$RULES/grid.ts" \
    "  return inBounds(at) ? at.y * MAT_COLS + at.x : -1;" \
    "  return at.y * MAT_COLS + at.x;"

add "the grid turns column-major" \
    "$RULES/grid.ts" \
    "  return { x: cell % MAT_COLS, y: Math.floor(cell / MAT_COLS) };" \
    "  return { x: Math.floor(cell / MAT_COLS), y: cell % MAT_COLS };"

add "the mat changes shape" \
    "$RULES/grid.ts" \
    "export const MAT_COLS = 4;" \
    "export const MAT_COLS = 5;"

RENDER=app/js/render

add "the unlit tile stops separating from the ground" \
    "$RENDER/palette.ts" \
    "export const TILE_IDLE = '#8A4AA6';" \
    "export const TILE_IDLE = '#3A1438';"

add "the lit tile stops separating from the unlit one" \
    "$RENDER/palette.ts" \
    "export const TILE_LIT = '#FFFFFF';" \
    "export const TILE_LIT = '#C98FD8';"

add "the ink stops being readable on its tile" \
    "$RENDER/palette.ts" \
    "export const INK = '#1C041B';" \
    "export const INK = '#8A6A88';"

# ⚠️ THE ONE MUTATION HERE THAT PASSES PLAIN sRGB CONTRAST, and the only one that can prove the
# colour-vision loop in tests/palette.node.test.ts is load-bearing rather than decorative. Every
# other palette mutation fails in normal vision too, so all of them would still be caught even if
# `ratioIn` ignored its `mode` argument entirely.
#
# A cyan lit tile against the purple unlit one measures, on the Machado (2009) matrices:
#
#     normal 4.37   protan 4.66   deuter 2.91   tritan 5.21
#
# It clears the 3:1 floor for a typical viewer and collapses for a deuteranope -- a separation
# carried by HUE where this palette's rule is that it must be carried by LUMINANCE. Every other
# assertion in the file still passes in every mode (ink/lit is 9.51 at its worst), so that one
# deuter cell is the single thing that fails.
#
# ⚠️ The first attempt was a green, #38784A on TILE_IDLE, and it ESCAPED: at luminance 0.148
# against a ground of 0.004 it separates by luminance after all. Against a near-black ground a
# hue-only failure is not constructible at all, which is why this moved to the lit/unlit pair,
# where both colours are light. Written down because the escape was the useful part.
add "the palette separates by hue instead of luminance" \
    "$RENDER/palette.ts" \
    "export const TILE_LIT = '#FFFFFF';" \
    "export const TILE_LIT = '#00F8F8';"

add "the source resolution drops back to the engine's" \
    "$RENDER/resolution.ts" \
    "export const SOURCE_MULTIPLE = 2;" \
    "export const SOURCE_MULTIPLE = 1;"

add "the UI is measured against the doubled width" \
    "$RENDER/resolution.ts" \
    "export const UI_BASE_W = ENGINE_W;" \
    "export const UI_BASE_W = ENGINE_W * SOURCE_MULTIPLE;"

add "the aspect ratio stops being 16:9" \
    "$RENDER/resolution.ts" \
    "export const LOGICAL_H = ((ENGINE_W * 9) / 16) * SOURCE_MULTIPLE; // 360" \
    "export const LOGICAL_H = ((ENGINE_W * 3) / 4) * SOURCE_MULTIPLE; // 360"

add "the pixelRatio correction is dropped" \
    "$RENDER/zdog-stage.ts" \
    "  illo.pixelRatio = 1;" \
    "  illo.pixelRatio = window.devicePixelRatio || 1;"

add "the up-rezzed backing store is left in place" \
    "$RENDER/zdog-stage.ts" \
    "  canvas.width = illo.canvasWidth;" \
    "  void 0;"

# Removed: "the chess game's backwards order is restored". It prepended a useless assignment and
# left the correction block below it intact, so it restored nothing and escaped for that reason
# rather than for a gap in the suite. Restoring the real backwards order means deleting a
# multi-line block, and the two halves of that are already covered by "the pixelRatio correction
# is dropped" and "the up-rezzed backing store is left in place".

add "canvasWidth is left disagreeing with the element" \
    "$RENDER/zdog-stage.ts" \
    "  illo.canvasWidth = width;" \
    "  illo.canvasWidth = width * (window.devicePixelRatio || 1);"

add "a lit tile stops rising" \
    "$RENDER/zdog-stage.ts" \
    "export const TILE_RISE = 7;" \
    "export const TILE_RISE = 0;"

add "a lit tile rises by a hairline" \
    "$RENDER/zdog-stage.ts" \
    "export const TILE_RISE = 7;" \
    "export const TILE_RISE = 0.4;"

# ========================= THE FRAMING =========================
# The two failures the Dev reported by eye, now reachable by a mutation: a mat that floats in an
# empty field (spike 0's zoom of 4.4) and a mat whose near row runs off the bottom (5.4 once the
# board turned four wide and five deep).
add "the mat floats in an empty field again" \
    "$RENDER/zdog-stage.ts" \
    "  zoom: 5.0," \
    "  zoom: 3.6,"

add "the near row runs off the bottom of the frame" \
    "$RENDER/zdog-stage.ts" \
    "  zoom: 5.0," \
    "  zoom: 6.2,"

add "the mat slides back under the HUD column" \
    "$RENDER/zdog-stage.ts" \
    "  offsetX: -17," \
    "  offsetX: 0,"

add "the mat is lifted off centre for a HUD that is no longer at the bottom" \
    "$RENDER/zdog-stage.ts" \
    "  offsetY: 0," \
    "  offsetY: -6,"

add "the camera pitch flattens the mat" \
    "$RENDER/zdog-stage.ts" \
    "  pitch: -0.9," \
    "  pitch: -0.05,"

add "a lit tile stops changing colour" \
    "$RENDER/mat.ts" \
    "        faces[cell].color = on ? TILE_LIT : TILE_IDLE;" \
    "        faces[cell].color = TILE_IDLE;"

# ⚠️ THE ANCHOR MOVED WHEN THE BUG WAS FIXED. It named `const GUTTER = 1.5;`, which is now
# derived (`TILE_GAP + STROKE`) -- and a SKIP is what a moved anchor looks like. Mutating
# TILE_GAP to zero restores the exact defect that shipped: a path gap of one stroke width,
# which the stroke then fills in, so the quads are apart and the pixels are not.
add "the gutter between tiles disappears" \
    "$RENDER/mat.ts" \
    "export const TILE_GAP = 1.5;" \
    "export const TILE_GAP = 0;"

add "the projected centre is read without the zoom" \
    "$RENDER/picking.ts" \
    "    x: point.x * viewport.zoom + viewport.width / 2," \
    "    x: point.x + viewport.width / 2,"

add "the result screen loses its way forward" \
    "$UI/screens.ts" \
    "  card.append(score, level, record, again, change);" \
    "  card.append(score, level);"

add "the result screen offers only replaying, never changing options" \
    "$UI/screens.ts" \
    "  card.append(score, level, record, again, change);" \
    "  card.append(score, level, again);"

add "winning and losing show the same heading" \
    "$UI/screens.ts" \
    "    doc, i18n, labelKey: deps.outcome === 'won' ? 'result.won' : 'result.lost'," \
    "    doc, i18n, labelKey: 'result.lost',"

add "focus lands on a button instead of the heading" \
    "$UI/screens.ts" \
    "  heading.tabIndex = -1;" \
    "  heading.tabIndex = -1; heading.focus = () => {};"

add "the dialog stops being modal" \
    "$UI/screens.ts" \
    "  root.setAttribute('aria-modal', 'true');" \
    "  root.setAttribute('aria-modal', 'false');"

add "the outcome stops reaching the stylesheet" \
    "$UI/screens.ts" \
    "  root.dataset.outcome = deps.outcome;" \
    "  root.dataset.outcome = 'won';"

add "the pitch clamp that keeps the mat clickable is removed" \
    "$RENDER/camera.ts" \
    "  return Math.min(PITCH_SHALLOWEST, Math.max(PITCH_STEEPEST, pitch));" \
    "  return pitch;"

add "the mat may be tilted flat, where every tile projects to a line" \
    "$RENDER/camera.ts" \
    "export const PITCH_SHALLOWEST = -0.42;" \
    "export const PITCH_SHALLOWEST = 0;"

add "the lean becomes a full orbit" \
    "$RENDER/camera.ts" \
    "  return Math.min(YAW_LIMIT, Math.max(-YAW_LIMIT, yaw));" \
    "  return yaw;"

add "the lean limit passes the angle where a row reads as a column" \
    "$RENDER/camera.ts" \
    "export const YAW_LIMIT = NUDGE_YAW * 3;" \
    "export const YAW_LIMIT = NUDGE_YAW * 9;"

add "a nudge stops dividing a quarter turn" \
    "$RENDER/camera.ts" \
    "export const NUDGE_YAW = Math.PI / 24;" \
    "export const NUDGE_YAW = Math.PI / 25;"

add "left and right lean the same way" \
    "$RENDER/camera.ts" \
    "      else if (direction === 'right') yaw = clampYaw(yaw - NUDGE_YAW);" \
    "      else if (direction === 'right') yaw = clampYaw(yaw + NUDGE_YAW);"

add "up and down tip the same way" \
    "$RENDER/camera.ts" \
    "      else if (direction === 'up') pitch = clampPitch(pitch + NUDGE_PITCH);" \
    "      else if (direction === 'up') pitch = clampPitch(pitch - NUDGE_PITCH);"

add "reset leaves the lean where it was" \
    "$RENDER/camera.ts" \
    "      yaw = 0;" \
    "      yaw = yaw;"

add "the camera starts at a framing the stage does not use" \
    "$RENDER/camera.ts" \
    "export const PITCH_DEFAULT = -0.9;" \
    "export const PITCH_DEFAULT = -1.2;"

add "a bad starting state is trusted instead of clamped" \
    "$RENDER/camera.ts" \
    "  let pitch = clampPitch(initial.pitch);" \
    "  let pitch = initial.pitch;"

add "a hit is announced without saying which tile" \
    "$UI/announce.ts" \
    "      return { text: i18n.t('say.hit', { value: event.value }), urgent: false };" \
    "      return { text: i18n.t('say.hit', { value: '' }), urgent: false };"

add "a wrong tile and a missed one read the same" \
    "$UI/announce.ts" \
    "        text: i18n.t(event.reason === 'missed' ? 'say.missed' : 'say.wrongTile', {" \
    "        text: i18n.t('say.wrongTile', {"

add "the end of the round stops interrupting" \
    "$UI/announce.ts" \
    "        urgent: true," \
    "        urgent: false,"

add "every announcement interrupts" \
    "$UI/announce.ts" \
    "      return { text: i18n.t('say.hit', { value: event.value }), urgent: false };" \
    "      return { text: i18n.t('say.hit', { value: event.value }), urgent: true };"

add "winning and losing read the same" \
    "$UI/announce.ts" \
    "        text: i18n.t(event.outcome === 'won' ? 'say.won' : 'say.lost', { have: context.hits })," \
    "        text: i18n.t('say.won', { have: context.hits }),"

I18N=app/js/i18n

add "a key goes missing from one language" \
    "$I18N/es.ts" \
    "  'mat.empty': 'vacía'," \
    ""

add "a translation is emptied, which the fallback cannot see" \
    "$I18N/en.ts" \
    "  'mat.empty': 'empty'," \
    "  'mat.empty': '',"

add "a phrase drops a placeholder in one language" \
    "$I18N/es.ts" \
    "  'say.hit': 'Correcto, {value}.'," \
    "  'say.hit': 'Correcto.',"

add "a numeral is translated along with the words around it" \
    "$I18N/en.ts" \
    "  'obj.multiplesOf3': 'multiples of 3'," \
    "  'obj.multiplesOf3': 'multiples of three',"

add "a missing key becomes silence instead of the key" \
    "$I18N/index.ts" \
    "      const template = CATALOGS[locale][key] ?? CATALOGS[FALLBACK][key] ?? key;" \
    "      const template = CATALOGS[locale][key] ?? CATALOGS[FALLBACK][key] ?? '';"

# Removed: "the fallback chain is removed" (locale -> pt -> key, dropping the middle term). It is
# an EQUIVALENT MUTANT under this suite and saying so is more honest than inventing a test for it:
# the completeness gate above proves all three catalogues carry the same key set, so the pt step
# is unreachable while that gate holds. It stays in the code as developer-facing cover — someone
# hand-editing es.ts and reloading the game before running the suite gets Portuguese rather than a
# raw identifier — and that is a benefit CI can never observe.

add "an unsupplied placeholder is blanked instead of left standing" \
    "$I18N/index.ts" \
    "    (Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole));" \
    "    (Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : ''));"

add "an unknown browser language falls back to English" \
    "$I18N/index.ts" \
    "const FALLBACK: LocaleCode = 'pt';" \
    "const FALLBACK: LocaleCode = 'en';"

add "pt loses the region its voice depends on" \
    "$I18N/index.ts" \
    "  pt: 'pt-BR'," \
    "  pt: 'pt',"

# ⚠️ A BACKTICK OR A `$` IN AN ANCHOR HAS TO BE BACKSLASH-ESCAPED. These strings sit inside
# DOUBLE quotes, so the shell runs a backtick as command substitution and expands ${…} as a
# parameter before mutate.cjs ever sees them. This anchor arrived as "  nameKey: ," and
# skipped in silence -- which a SKIP does report, but only if anyone reads the line.
#
# The three hand-written categories became a generated family of eight, so the anchor moved
# from a constant to the expression that builds every name. Off by one on the factor: the
# first seven keys still exist, and only `obj.multiplesOf10` does not -- which is the shape a
# real mistake here would have.
add "a category name stops matching its catalogue key" \
    "$RULES/category.ts" \
    "  nameKey: \`obj.multiplesOf\${factor}\`," \
    "  nameKey: \`obj.multiplesOf\${factor + 1}\`,"

UI=app/js/ui

add "the arrows wrap around the mat instead of clamping" \
    "$UI/grid-mirror.ts" \
    "  x = Math.min(MAT_COLS - 1, Math.max(0, x));" \
    "  x = (x + MAT_COLS) % MAT_COLS;"

add "moving down off the last row wraps to the first" \
    "$UI/grid-mirror.ts" \
    "  y = Math.min(MAT_ROWS - 1, Math.max(0, y));" \
    "  y = (y + MAT_ROWS) % MAT_ROWS;"

add "every cell is put in the tab order" \
    "$UI/grid-mirror.ts" \
    "      button.tabIndex = cell === cursorCell ? 0 : -1;" \
    "      button.tabIndex = 0;"

add "the roving tabindex stops roving" \
    "$UI/grid-mirror.ts" \
    "    cells[cursorCell].tabIndex = -1;" \
    "    void 0;"

add "a click leaves the cursor where it was" \
    "$UI/grid-mirror.ts" \
    "        moveCursor(cell, { focus: false });" \
    "        void cell;"

add "the label stops asking the declaration" \
    "$UI/grid-mirror.ts" \
    "      content: name ? name.text : t('mat.empty')," \
    "      content: t('mat.empty'),"

add "the empty cell is named in one hardcoded language" \
    "$UI/grid-mirror.ts" \
    "      content: name ? name.text : t('mat.empty')," \
    "      content: name ? name.text : 'vazia',"

add "the dimmed state is inverted" \
    "$UI/grid-mirror.ts" \
    "      button.setAttribute('aria-disabled', role === 'free' ? 'true' : 'false');" \
    "      button.setAttribute('aria-disabled', role === 'free' ? 'false' : 'true');"

add "an unlit tile stops being focusable" \
    "$UI/grid-mirror.ts" \
    "      button.dataset.role = role;" \
    "      button.dataset.role = role; button.disabled = role === 'free';"

add "the role stops reaching the stylesheet" \
    "$UI/grid-mirror.ts" \
    "      button.dataset.role = role;" \
    "      button.dataset.role = 'free';"

add "the grid uses divs instead of buttons" \
    "$UI/grid-mirror.ts" \
    "      const button = doc.createElement('button');" \
    "      const button = doc.createElement('div') as unknown as HTMLButtonElement;"

add "a remapped key stops being honoured" \
    "$UI/grid-mirror.ts" \
    "    const mapped = deps.resolveAction?.(event.code);" \
    "    const mapped = null;"

add "every intent steers the cursor, including a platformer's jump" \
    "$UI/grid-mirror.ts" \
    "    if (!intent || !MOVES.has(intent)) return;" \
    "    if (!intent) return;"

# ========================= THE OPTION PANEL, THE HUD PHASE, AND THE FAMILY OF EIGHT =========
# ⚠️ NOT LISTED HERE: the vendored typefaces. tests/fonts.browser.test.ts is gated on the CONTENT
# of a woff2, and a text substitution cannot reach inside one. It was proven able to fail by hand
# instead: putting the cyrillic-ext subset back -- the file that actually shipped -- breaks three
# of its four assertions and names the characters, while `document.fonts.check` still answers true.

add "the difficulty cycler clamps instead of wrapping" \
    "$UI/options.ts" \
    "      const next = values[(values.indexOf(read()) + 1) % values.length];" \
    "      const next = values[Math.min(values.indexOf(read()) + 1, values.length - 1)];"

add "a cycler shows its mark without the word" \
    "$UI/options.ts" \
    "      button.textContent = \`\${markOf(value)} \${word}\`;" \
    "      button.textContent = markOf(value);"

add "the eight factors stop being one control" \
    "$UI/options.ts" \
    "    input.name = 'opt-collect';" \
    "    input.name = \`opt-collect-\${factor}\`;"

add "the panel opens on no category at all" \
    "$UI/options.ts" \
    "    input.checked = option.id === category.id;" \
    "    input.checked = false;"

add "a chip is named by its keycap instead of in words" \
    "$UI/options.ts" \
    "    input.setAttribute('aria-label', i18n.t('opt.collectOne', { n: factor }));" \
    "    input.setAttribute('aria-label', keycap(factor));"

add "picking a factor is announced on top of what the radio already says" \
    "$UI/options.ts" \
    "      category = option;" \
    "      category = option; announce('opt.collect', i18n.t(option.nameKey));"

add "the panel stops telling its owner anything changed" \
    "$UI/options.ts" \
    "    deps.onChange?.(current());" \
    "    void deps.onChange;"

add "the family of factors shrinks back to three" \
    "$RULES/category.ts" \
    "export const FACTORS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9];" \
    "export const FACTORS: readonly number[] = [2, 3, 4];"

add "the pool stops growing with the factor" \
    "$RULES/category.ts" \
    "  const pool = options.pool ?? range(1, poolMaxFor(factor));" \
    "  const pool = options.pool ?? range(1, POOL_MAX);"

# ⚠️ FOUR MUTATIONS WERE RETIRED HERE, not lost. They guarded the three `<select>`s that used
# to stand on the title card -- that a category was resolved back to a real object, that the
# chosen difficulty was honoured, that each select had a real `<label for>`, that an option
# was named through the catalogue rather than by its raw id. The controls moved into the HUD
# and every one of those facts is now guarded on the radio group and the cyclers, above.
#
# They had been reporting SKIP since the move -- which is an escape, and does fail the run,
# but only says so to someone reading the line.
add "the title goes back to being modal, hiding the options from a reader" \
    "$UI/screens.ts" \
    "  root.removeAttribute('aria-modal');" \
    "  root.setAttribute('aria-modal', 'true');"

add "the title claims to be modal, so the composition root deadens the whole region" \
    "$UI/screens.ts" \
    "    modal: false," \
    "    modal: true,"

add "the options stay up once the round starts" \
    "$UI/hud.ts" \
    "      deps.options.hidden = !choosing;" \
    "      deps.options.hidden = false;"

add "the score sits under the settings, showing both halves at once" \
    "$UI/hud.ts" \
    "      live.hidden = choosing;" \
    "      live.hidden = false;"

add "the keyboard help offers the mat while there is no mat" \
    "$UI/hud.ts" \
    "      help.hidden = choosing;" \
    "      help.hidden = false;"

# ========================= THE INDEPENDENT SPAWN =========================
# ⚠️ 34 mutations were retired with the wave model, and they are not a loss to mourn: every one of
# them proved a gate on a mechanic that was mine rather than the game's. What replaces them is
# below, and it is a larger set, because a level that is a budget of tiles has invariants a
# simultaneous set never had -- a ceiling on how many are up, distinct values ACROSS that ceiling,
# and a level that ends by being played rather than by the clock running out.

add "the tile deadline loses its five-second floor" \
    "$RULES/difficulty.ts" \
    "  return (Math.max(0, 9000 - 9000 * 0.22 * level) + 5000) * pace;" \
    "  return (9000 - 9000 * 0.22 * level + 5000) * pace;"

add "the decay factor shifts off the original curve" \
    "$RULES/difficulty.ts" \
    "  return (Math.max(0, 9000 - 9000 * 0.22 * level) + 5000) * pace;" \
    "  return (Math.max(0, 9000 - 9000 * 0.2 * level) + 5000) * pace;"

add "a rounding call is put back to absorb drift" \
    "$RULES/difficulty.ts" \
    "  return (Math.max(0, 9000 - 9000 * 0.22 * level) + 5000) * pace;" \
    "  return Math.round((Math.max(0, 9000 - 9000 * 0.219 * level) + 5000) * pace);"

add "the hardest setting allows only one tile on the mat" \
    "$RULES/difficulty.ts" \
    "  hard: 4," \
    "  hard: 1,"

add "the spawn gap loses the floor that keeps the frame loop moving" \
    "$RULES/difficulty.ts" \
    "  return Math.max(1, Math.round((1000 * 3) / level));" \
    "  return Math.round((1000 * 3) / level);"

add "a level stops being four tiles at the bottom" \
    "$RULES/spawn.ts" \
    "  return Math.max(MIN_TILES_PER_LEVEL, Math.floor(level));" \
    "  return Math.floor(level);"

add "every level is the floor, so level twenty is still four tiles" \
    "$RULES/spawn.ts" \
    "  return Math.max(MIN_TILES_PER_LEVEL, Math.floor(level));" \
    "  return MIN_TILES_PER_LEVEL;"

add "the correct share loses its lower bound" \
    "$RULES/spawn.ts" \
    "  const minRight = Math.max(1, Math.floor(count / 3));" \
    "  const minRight = 1;"

add "the correct share loses its upper bound, so a level can be all right" \
    "$RULES/spawn.ts" \
    "  const maxRight = Math.min(count - 1, Math.ceil((count * 2) / 3));" \
    "  const maxRight = count;"

add "a level stops being shuffled, so position teaches the answer" \
    "$RULES/spawn.ts" \
    "  return shuffled(out, rnd);" \
    "  return out;"

add "take draws with replacement, so a value can repeat" \
    "$RULES/spawn.ts" \
    "    const j = i + Math.floor(rnd() * (pool.length - i));" \
    "    const j = Math.floor(rnd() * pool.length);"

add "a level of one tile is accepted" \
    "$RULES/spawn.ts" \
    "  if (!Number.isInteger(count) || count < 2) {" \
    "  if (!Number.isInteger(count) || count < 1) {"

add "a value lies about being correct" \
    "$RULES/spawn.ts" \
    "    out.push({ value: right[Math.floor(rnd() * right.length)], correct: true });" \
    "    out.push({ value: right[Math.floor(rnd() * right.length)], correct: false });"

add "a category that cannot discriminate is composed anyway" \
    "$RULES/spawn.ts" \
    "  if (right.length === 0 || wrong.length === 0) {" \
    "  if (false) {"

add "a rules module reaches for the renderer" \
    "$RULES/spawn.ts" \
    "import type { Category } from './category.ts';" \
    "import type { Category } from './category.ts'; import { TILE } from '../render/resolution.ts';"

add "letting a WRONG tile expire becomes a mistake" \
    "$RULES/round.ts" \
    "          if (tile.correct) {" \
    "          if (!tile.correct) {"

add "an expiring tile costs nothing at all" \
    "$RULES/round.ts" \
    "            errors += 1;" \
    "            errors += 0;"

add "the mat may hold more tiles than the difficulty allows" \
    "$RULES/round.ts" \
    "    if (live.length >= atOnce || live.length >= cellCount) return -1;" \
    "    if (live.length >= cellCount) return -1;"

add "two tiles may show the same value at once" \
    "$RULES/round.ts" \
    "    return queue.findIndex((v) => !onMat.has(v.value));" \
    "    return queue.length > 0 ? 0 : -1;"

add "two tiles may land on the same cell" \
    "$RULES/round.ts" \
    "    const taken = new Set(live.map((t) => t.cell));" \
    "    const taken = new Set<number>();"

# ⚠️ THE ANCHOR IS THE ASSIGNMENT IN `startLevel`, NOT THE DECLARATION. Mutating
# `let spawnLeft = 0;` escaped, and correctly: `startLevel()` runs in the constructor and
# overwrites it, so the initialiser is dead code and its mutation is equivalent.
add "the first tile waits a full gap after Play is pressed" \
    "$RULES/round.ts" \
    "    spawnLeft = 0;" \
    "    spawnLeft = 3000;"

add "the level never advances, so the budget means nothing" \
    "$RULES/round.ts" \
    "    level += 1;" \
    "    level += 0;"

add "the level stops being announced" \
    "$RULES/round.ts" \
    "    out.push({ kind: 'level-up', level });" \
    "    void level;"

add "a long frame swallows everything that happened inside it" \
    "$RULES/round.ts" \
    "      while (remaining > 0 && !ended) {" \
    "      if (remaining > 0 && !ended) {"

add "the round keeps running after it is over" \
    "$RULES/round.ts" \
    "      if (ended || dtMs <= 0) return out;" \
    "      if (dtMs <= 0) return out;"

add "a judged tile stays on the mat, so it can be hit twice" \
    "$RULES/round.ts" \
    "      const [tile] = live.splice(index, 1);" \
    "      const tile = live[index];"

add "hitting a dark tile becomes a mistake" \
    "$RULES/round.ts" \
    "      if (index < 0) return out;   // dark, or already taken. Neither is a mistake." \
    "      if (index < 0) { errors += 1; return out; }"

add "the end of the round is announced on every later frame" \
    "$RULES/round.ts" \
    "    if (ended) return true;" \
    "    if (false) return true;"

add "every tile reports full heat, so the countdown is invisible" \
    "$RULES/round.ts" \
    "      heat: t.deadlineMs > 0 ? Math.min(1, Math.max(0, t.leftMs / t.deadlineMs)) : 0," \
    "      heat: 1,"

add "the level is checked only when the frame has time left over" \
    "$RULES/round.ts" \
    "        if (live.length === 0 && queue.length === 0) {" \
    "        if (live.length === 0 && queue.length === 0 && remaining < 0) {"

add "a lit tile is announced without saying which number" \
    "$UI/announce.ts" \
    "          value: event.value," \
    "          value: 0,"

add "the announcement drops what to collect" \
    "$UI/announce.ts" \
    "          what: context.collecting," \
    "          what: ''," \

add "a rules module reaches for the engine" \
    "$RULES/category.ts" \
    "import { LIT_AT_ONCE } from './difficulty.ts';" \
    "import { LIT_AT_ONCE } from './difficulty.ts'; import { TILE } from '@the-inclusionist/engine/core/constants.js';"

add "setLit stops clearing the tiles that were up before" \
    "$RENDER/mat.ts" \
    "        anchors[cell].translate.y = on ? -TILE_RISE : 0;" \
    "        if (on) anchors[cell].translate.y = -TILE_RISE;"

# ========================= THE FOOTER, THE WORDS AND THE REMEMBERED SCORE =========================

add "a word arrives on every point instead of every fifth" \
    "$RULES/combo.ts" \
    "  if (hits % COMBO_EVERY !== 0) return null;" \
    "  if (hits % 1 !== 0) return null;"

add "the interval moves off the original's five" \
    "$RULES/combo.ts" \
    "export const COMBO_EVERY = 5;" \
    "export const COMBO_EVERY = 3;"

add "the guard on zero is dropped, so the footer shouts before the first hit" \
    "$RULES/combo.ts" \
    "  if (!Number.isInteger(hits) || hits <= 0) return null;" \
    "  if (!Number.isInteger(hits)) return null;"

add "the word stops being random" \
    "$RULES/combo.ts" \
    "  const index = Math.min(COMBO_KEYS.length - 1, Math.floor(rnd() * COMBO_KEYS.length));" \
    "  const index = 0;"

add "the draw runs off the end of the word list" \
    "$RULES/combo.ts" \
    "  const index = Math.min(COMBO_KEYS.length - 1, Math.floor(rnd() * COMBO_KEYS.length));" \
    "  const index = Math.floor(rnd() * COMBO_KEYS.length);"

add "matching the record counts as beating it" \
    "$STORE/high-score.ts" \
    "  if (Math.floor(hits) <= best) return false;" \
    "  if (Math.floor(hits) < best) return false;"

add "the saved key loses its namespace and collides with the sibling games" \
    "$STORE/high-score.ts" \
    "export const HIGH_SCORE_KEY = 'incl.whackwhack.highscore';" \
    "export const HIGH_SCORE_KEY = 'highscore';"

add "a refused write is reported to the child as a new record" \
    "$STORE/high-score.ts" \
    "  return set(HIGH_SCORE_KEY, Math.floor(hits));" \
    "  set(HIGH_SCORE_KEY, Math.floor(hits)); return true;"

add "a corrupted stored score reaches the screen" \
    "$STORE/high-score.ts" \
    "  if (!Number.isFinite(stored) || stored < 0) return 0;" \
    "  if (!Number.isFinite(stored)) return 0;"

add "a fractional stored score is shown as it is" \
    "$STORE/high-score.ts" \
    "  return Math.floor(stored);" \
    "  return stored;"

add "the footer grows without bound, as the original's does" \
    "$UI/feedback.ts" \
    "      while (list.children.length > MAX_ITEMS) {" \
    "      while (false) {"

add "the ceiling drops the NEWEST item instead of the oldest" \
    "$UI/feedback.ts" \
    "        remove(list.children[0] as HTMLElement);" \
    "        remove(list.children[list.children.length - 1] as HTMLElement);"

add "an item never leaves on its own once the animation is refused" \
    "$UI/feedback.ts" \
    "      timers.set(item, setTimeout(() => remove(item), lifetimeMs + 250));" \
    "      void lifetimeMs;"

add "the animation ending stops taking the item out" \
    "$UI/feedback.ts" \
    "      item.addEventListener('animationend', () => remove(item), { once: true });" \
    "      void item;"

add "the footer is read out, on top of the announcement that already exists" \
    "$UI/feedback.ts" \
    "  root.setAttribute('aria-hidden', 'true');" \
    "  root.setAttribute('aria-hidden', 'false');"

# The two copies of the palette, held together by tests/style-palette.node.test.ts. Mutating
# the CSS side is the only way to prove that gate bites: the TypeScript side is measured by
# tests/palette.node.test.ts, which would fail first for a different reason.
add "the stylesheet ground drifts from the measured one" \
    "$CSS/style.css" \
    "  --ground: #1C041B;" \
    "  --ground: #21062A;"

add "the stylesheet accent drifts from the measured one" \
    "$CSS/style.css" \
    "  --accent: #C933FF;" \
    "  --accent: #D040FF;"

# ⚠️ 88 px OF ICON IN A 350 px COLUMN. The engine's `--tap` is `22 x k` and grows with the canvas —
# right for a bar spanning a stage, and here it takes the HUD's scrollbar with it. The floor is the
# other half: without the engine's sheet at all, the same buttons collapsed to 33 px.
# ⚠️ THE ENGINE HAS A `.hud` TOO, and it is a horizontal strip with `flex-wrap: wrap`. A layer only
# protects what this file DECLARES, so the undeclared property arrived -- and a COLUMN that wraps opens a
# SECOND column outside the panel. Shipped for an hour; measured at 800x600 with the bar at x=833.
add "the HUD stops saying no to the engine's wrap, and opens a second column" \
    "$CSS/style.css" \
    "  flex-wrap: nowrap;" \
    "  /* wrap left to the engine */"

# ⚠️ THE CORRECTION THE ENGINE MOUNTS FOR NOBODY. Without the writer the icon is not built at all, so
# the palette measured under protanopia, deuteranopia and tritanopia cannot be switched on by a child.
add "the colour-vision correction stops reaching the declared world" \
    "$BOOT/main.ts" \
    "    engine.aplicarFiltroDeVisao(visionCss(vision), 'mundo-e-menus');" \
    "    engine.aplicarFiltroDeVisao('', 'mundo-e-menus');"

add "the correction ring stops moving, so one press is every press" \
    "$BOOT/main.ts" \
    "      vision = nextVision(vision);" \
    "      "

add "the on state loses its non-colour channel" \
    "$BOOT/main.ts" \
    "    cvdButton.classList.toggle('pi-on', vision.correcao !== 'tricro');" \
    "    cvdButton.classList.toggle('pi-on', false);"

add "the accessibility bar takes the engine's preferred size in a narrow column" \
    "$CSS/style.css" \
    "  --tap: 44px;" \
    "  /* floor removed */"

add "the footer blinks, as the original's does" \
    "$CSS/style.css" \
    "  animation: feedback-fade 5s ease both;" \
    "  animation: blink-and-fade-out 5s ease both;"

# ⚠️ THIS ONE ESCAPED TWICE BEFORE THE CODE CHANGED, and the escapes were right both times.
# The HUD guarded the high-score line twice over -- an empty string AND `hidden` -- so breaking
# either alone changed nothing observable and the behaviour was ungated while looking doubly
# protected. The second guard was removed rather than a second assertion invented.
add "the high score line reads zero on a first visit" \
    "$UI/hud.ts" \
    "    best.hidden = record <= 0;" \
    "    best.hidden = false;"

add "the result screen claims a record on every round" \
    "$UI/screens.ts" \
    "  record.hidden = !deps.record;" \
    "  record.hidden = false;"

# ========================= WHAT ENGINE 8 MOUNTS, AND WHAT THIS GAME OWNS OF IT =========================
# ⚠️ THE BAR IS THE DOOR TO EVERYTHING ELSE. With no host the engine says so in `problems` and
# mounts nothing, and blind mode, TTS, contrast and Libras are reachable from nowhere — which is
# the measurement that made ADR-0120 take the decline away in the first place.
add "the accessibility bar loses its host, and the engine mounts it nowhere" \
    "$BOOT/main.ts" \
    "    host: { doc, win: window, cvdHost: doc.getElementById('cvd'), a11yBarHost: engineBar }," \
    "    host: { doc, win: window, cvdHost: doc.getElementById('cvd') },"

add "the neural voice goes back to being an omission rather than a decision" \
    "$BOOT/main.ts" \
    "    declines: { semAssistenteDePad: true, semAtorDePausa: true, semVozNeural: true }," \
    "    declines: { semAssistenteDePad: true, semAtorDePausa: true },"

# ⚠️ A PAUSE THAT DOES NOT STOP TIME charges a child for the seconds she spent turning the contrast
# up, and it looks identical to a working one until a tile expires behind the card.
add "the clock keeps running behind the pause card" \
    "$BOOT/main.ts" \
    "    if (round && !screen && !paused) handle(round.advance(dt * FRAME_MS));" \
    "    if (round && !screen) handle(round.advance(dt * FRAME_MS));"

# ⚠️ REGISTRATION ORDER IS THE WHOLE FIX. `ui/menu-nav` listens on the window in CAPTURE and calls
# `stopPropagation()` on Escape, so a bubble listener opens the card and can never close it.
add "the pause key drops to the bubble phase, and Escape can no longer close" \
    "$BOOT/main.ts" \
    "  }, { capture: true });" \
    "  });"

# ⚠️ AND THE WAY OUT THAT IS NOT A KEY. `createGame` takes no pause actions, so the engine's §5
# filter hides "Continuar" as a dead button — correctly, and leaving a child on a touch screen
# with a card and no exit.
add "the resume item goes back to hidden, and a touch screen has no way out" \
    "$BOOT/main.ts" \
    "      reviveResume();" \
    "      "

# ========================= THE TIME A CHILD CAN ASK FOR (WCAG 2.2.1) =========================
# ⚠️ The plan promised conformance from `endless` PLUS a deadline multiplier, and only the first
# half existed for weeks. `endless` removes the DEFEAT and leaves the HURRY: every tile still
# expired on the original curve, so a child who needed longer simply was not punished for never
# reaching the twenty hits.
add "the pace stops reaching the deadline, so the ring is a button that does nothing" \
    "$RULES/difficulty.ts" \
    "  return (Math.max(0, 9000 - 9000 * 0.22 * level) + 5000) * pace;" \
    "  return Math.max(0, 9000 - 9000 * 0.22 * level) + 5000;"

# ⚠️ x10 IS THE CRITERION AND NOT A TASTE. SC 2.2.1 is met by adjusting "over a wide range that is
# at least ten times the length of the default setting". Trimming the ring to make the button
# shorter drops the game out of conformance in silence.
add "the ring stops short of ten times the default, losing the conformance claim" \
    "$RULES/difficulty.ts" \
    "export const PACES: readonly Pace[] = [1, 2, 5, 10];" \
    "export const PACES: readonly Pace[] = [1, 2, 5];"

# ⚠️ THE DEFAULT IS THE ORIGINAL GAME. A ring that did not start at 1 would opt every child into an
# accommodation she did not ask for, and would change the curve for everyone to help some.
add "the default pace stops being the original curve" \
    "$RULES/difficulty.ts" \
    "export const PACE_DEFAULT: Pace = 1;" \
    "export const PACE_DEFAULT: Pace = 2;"

# ⚠️ ACCEPTED, STORED, AND NEVER READ is the failure this one names: every arithmetic test on
# `tileDeadlineMs` would still pass while the tile on the mat kept the unaccommodated deadline.
add "the round keeps the unaccommodated deadline whatever the child chose" \
    "$RULES/round.ts" \
    "    const deadlineMs = tileDeadlineMs(level, options.pace);" \
    "    const deadlineMs = tileDeadlineMs(level, 1);"

# ⚠️ AND THE CONTROL ITSELF. Without the button in the panel the multiplier is reachable only by
# someone editing the source, which is nobody this criterion is about.
add "the time control leaves the panel" \
    "$UI/options.ts" \
    "  root.append(difficultyButton, defeatButton, paceButton, collect, said);" \
    "  root.append(difficultyButton, defeatButton, collect, said);"

# ⚠️ THE CI HANDED OVER AN ADDRESS AND NOTHING READ IT, for weeks. A workflow input nobody reads
# looks exactly like coverage, so the wiring is gated rather than trusted.
# ⚠️ THE READER OF THIS VERY FILE. `tests/mutation-anchors.node.test.ts` parses the `add` calls below
# and checks every anchor still matches its file -- the failure that actually happens, five times in
# one afternoon. A parser that quietly matched FEWER entries would report a clean sweep over a subset,
# which is the same shape as the rot it exists to find.
add "the anchor reader silently stops seeing most of the mutations" \
    "$TESTS/mutation-anchors.node.test.ts" \
    "    if (!lines[i].startsWith('add \"')) continue;" \
    "    if (!lines[i].startsWith('add \"the ')) continue;"

add "the built-bundle audit falls out of test:a11y" \
    "$CFG/package.json" \
    " && node tests/axe-url.mjs" \
    ""

add "the audit stops reading the address the workflow passes" \
    "$TESTS/axe-url.mjs" \
    "const url = process.env.AXE_URL;" \
    "const url = 'http://localhost:8199';"

add "a missing address goes back to passing quietly" \
    "$TESTS/axe-url.mjs" \
    "  console.log('axe-url: AXE_URL is not set — the BUILT BUNDLE was not audited.');" \
    "  "

# ========================= THE LEAN IS DECORATION, AND TWO CONTRACT ANSWERS DEPEND ON IT =========================
# ⚠️ `holdsAtOnce` answers 1 and `seguraTeclas` answers false, and both carry the same caveat: the
# Shift+Arrow lean is a chord a child may not be able to make, which is survivable ONLY because it
# changes nothing a round is made of. These three are what notice when that stops being true.
add "the camera lean starts touching the round it is supposed to only look at" \
    "$BOOT/main.ts" \
    "    applyCamera(camera.nudge(direction));" \
    "    applyCamera(camera.nudge(direction)); if (round) handle(round.advance(9000));"

add "the lean goes dead, so the round-did-not-change claim is true for the dullest reason" \
    "$BOOT/main.ts" \
    "    if (!event.shiftKey) return;" \
    "    if (!event.shiftKey || true) return;"

add "Shift+Home stops squaring the mat, stranding a child at an angle" \
    "$BOOT/main.ts" \
    "      applyCamera(camera.reset());" \
    "      applyCamera(camera.snapshot());"

# ========================= THE SHARED RANDOM STREAM (ADR-0141) =========================
# 🔴 THE WRONG IMPORT IS THE SHORTER ONE, and this repository took it: ADR-0141 measured
# `app/js/boot/main.ts:23` as `import { rnd }`. The defect is INVISIBLE where the tests run -- a
# standalone build has one stream and cannot collide with itself -- so the gate is load-bearing.
add "the shared random stream comes back through the shorter import" \
    "$BOOT/main.ts" \
    "import { createRng } from '@the-inclusionist/engine/core/rng.js';" \
    "import { createRng, rnd } from '@the-inclusionist/engine/core/rng.js';"

# ⚠️ AND THE HOLE A NAMED-BINDING CHECK LEAVES OPEN: a namespace import reaches all four shared
# functions through a property and past every check on the names.
# 🔴 REMOVED, AND RECORDED RATHER THAN FAKED. There WAS a mutation here turning the namespace
# check of `tests/rng-boundary.node.test.ts` into `false`, and it can never be killed by this
# tree: the check guards against a SHAPE that no file currently has, so making it vacuous changes
# no outcome. Killing it would need a fixture file that takes `import * as rng from core/rng`,
# and inventing one to satisfy a tally is the kind of green this whole file exists to refuse.
# The check stays, because the shape it guards is real the day somebody writes it.

add "the rng gate matches no import at all and passes over nothing" \
    "$TESTS/rng-boundary.node.test.ts" \
    "]*core/rng" \
    "]*core/nope"

# ========================= THE REGION BOUNDARY (ADR-0139 §4) =========================
# ⚠️ A CARTRIDGE MAY WRITE INSIDE ITS REGION AND NOWHERE ELSE, and `teardown()` is enforceable only
# because the shell empties that one element. Until 2026-09-11 this game put the screens and the
# pointer ball in `<body>` and wrote `--region-w` on the document root -- three things the next
# cartridge on the page would have inherited.
add "the screens go back to the document body, outside the region" \
    "$BOOT/main.ts" \
    "    stageWrap.appendChild(next.root);" \
    "    doc.body.appendChild(next.root);"

add "the pointer ball goes back outside the region" \
    "$BOOT/main.ts" \
    "  stageWrap.appendChild(ball);" \
    "  doc.body.appendChild(ball);"

# ⚠️ AND THE OTHER DIRECTION: dropping the write entirely satisfies "nothing on the root" and puts
# the logo back under the HUD column, which is the defect the root write existed to fix.
add "the region size stops being published where the screens can read it" \
    "$UI/layout.ts" \
    "  wrap.style.setProperty('--region-w'," \
    "  host.doc.documentElement.style.setProperty('--region-w',"

# ⚠️ ADR-0139 GATE 1: «a cartridge that is imported and never instantiated must do nothing
# observable». The module used to end with a bare `boot()`, so importing it started the game -- and
# a module that boots on import cannot be one of six on a page.
add "the game boots again at module scope, the moment it is imported" \
    "$BOOT/main.ts" \
    "export function boot(): RunningGame {" \
    "export function boot(): RunningGame { return bootAgain(); }\nfunction bootAgain(): RunningGame {"

add "the shell stops calling the game, so nothing runs at all" \
    "$BOOT/standalone.ts" \
    "boot();" \
    "// boot();"

# ⚠️ ADR-0139 §3: A CARTRIDGE NEVER CALLS `startLoop`. «Six cartridges each opening their own frame
# callback is six loops competing for one frame», and `aoFalhar` -- where spec D16 lives -- is the
# shell's to wire. The game owns a FRAME; the loop that drives it is outside.
add "the frame stops being handed over, so the shell drives nothing" \
    "$BOOT/main.ts" \
    "  return { update };" \
    "  return { update: () => {} };"

# ⚠️ «one broken game must stay distinguishable from a broken engine» (D16). A frame that throws
# stops the loop, which is right; stopping in SILENCE is not, because a blind child cannot see a
# frozen screen.
add "a frame that throws stops the game without saying so" \
    "$BOOT/standalone.ts" \
    "    srAlert(say.t('say.crashed'));" \
    "    "

# ========================= THE AUDITED MARKUP =========================
add "the canvas stops hiding itself from a screen reader" \
    "$BOOT/main.ts" \
    "  canvas.setAttribute('aria-hidden', 'true');" \
    "  canvas.setAttribute('aria-hidden', 'false');"

# ⚠️ EVERY `"` IN AN HTML ANCHOR NEEDS A BACKSLASH. These are double-quoted shell strings, so an
# unescaped quote closes the argument and the remainder becomes separate words -- which matches
# nothing and reports SKIP, the same silent shape as a drifted anchor.
add "the shipped page loses the status region the engine requires" \
    "$APP/index.html" \
    "<div id=\"sr-status\" class=\"sr-only\" role=\"status\" aria-live=\"polite\"></div>" \
    "<div id=\"sr-status\" class=\"sr-only\"></div>"

# ========================= THE NINE POSITIONS, AND THIS GAME'S FIVE =========================

add "the game claims a position it does not use" \
    "$INPUT/actions.ts" \
    "export const USED: readonly Action[] = ['up', 'down', 'left', 'right', 'action1', 'start'];" \
    "export const USED: readonly Action[] = ['up', 'down', 'left', 'right', 'action1', 'start', 'action4'];"

add "the game declares no action at all, which cannot be played" \
    "$INPUT/actions.ts" \
    "export const USED: readonly Action[] = ['up', 'down', 'left', 'right', 'action1', 'start'];" \
    "export const USED: readonly Action[] = [];"

add "the hammer moves to a position the preset does not name" \
    "$INPUT/actions.ts" \
    "export const HAMMER: Action = 'action1';" \
    "export const HAMMER: Action = 'action3';"

add "an abstract position reaches the remapping screen" \
    "$INPUT/actions.ts" \
    "    action1: { label: t('act.hammer'), short: t('act.hammer.short'), hint: t('act.hammer.hint') }," \
    "    action1: { label: 'action1', short: 'action1' },"

add "a label is left blank, which is a mute row for a screen reader" \
    "$INPUT/actions.ts" \
    "    up: { label: t('act.up'), short: t('act.up.short') }," \
    "    up: { label: '', short: t('act.up.short') },"

# ⚠️ THE PAUSE POSITION was deliberately absent while this game declined the pause menu. Engine
# 8.0.0 removed the decline, so an unnamed `start` is a key the child cannot find and cannot remap.
add "the pause loses its name, and \`start\` goes back to being unreachable" \
    "$INPUT/actions.ts" \
    "export const USED: readonly Action[] = ['up', 'down', 'left', 'right', 'action1', 'start'];" \
    "export const USED: readonly Action[] = ['up', 'down', 'left', 'right', 'action1'];"

add "the pause loses its hint, so nothing says the settings live behind it" \
    "$INPUT/actions.ts" \
    "    start: { label: t('act.pause'), short: t('act.pause.short'), hint: t('act.pause.hint') }," \
    "    start: { label: t('act.pause'), short: t('act.pause.short') },"

add "the hammer stops working on a remapped key" \
    "$UI/grid-mirror.ts" \
    "    if (intent === HAMMER && !NATIVE_ACTIVATION.has(event.code)) {" \
    "    if (false) {"

add "the hammer fires twice on Enter, once from the key and once from the click" \
    "$UI/grid-mirror.ts" \
    "    if (intent === HAMMER && !NATIVE_ACTIVATION.has(event.code)) {" \
    "    if (intent === HAMMER) {"

# ========================= THE NUMBERS, NOW THAT THEY ARE TEXT =========================
# ⚠️ EIGHT MUTATIONS WERE RETIRED HERE and are not a loss: every one of them pointed at the
# seven-segment layout -- the digit-to-segments table, the nudge that stopped a lone "1" hugging
# its cell edge, the whole-pixel `fillRect`. That code is gone, the numbers are set in Atkinson
# Hyperlegible, and the questions those mutations asked are asked of the FACE instead, in
# tests/glyph.browser.test.ts, by measuring it. They had all been reporting SKIP.

add "the numbers go back to the size the segments drew" \
    "$RENDER/glyph.ts" \
    "export const GLYPH_HEIGHT = 8;" \
    "export const GLYPH_HEIGHT = 9;"

add "the numbers shrink until their strokes are thinner than a pixel" \
    "$RENDER/glyph.ts" \
    "export const GLYPH_HEIGHT = 8;" \
    "export const GLYPH_HEIGHT = 2;"

add "the numbers overflow their tile" \
    "$RENDER/glyph.ts" \
    "export const GLYPH_HEIGHT = 8;" \
    "export const GLYPH_HEIGHT = 18;"

# ⚠️ The one that would be INVISIBLE without a measurement. A digit fills 0.70 of the em box in
# this face, so treating the font size AS the height draws every number 30% small -- which looks
# deliberate on screen and is not.
add "the font size is used as the digit height, drawing every number 30% small" \
    "$RENDER/glyph.ts" \
    "export const DIGIT_HEIGHT_RATIO = 0.70;" \
    "export const DIGIT_HEIGHT_RATIO = 1;"

add "the numbers fall back to a face that was not chosen for them" \
    "$RENDER/glyph.ts" \
    "export const GLYPH_FAMILY = 'Atkinson Hyperlegible';" \
    "export const GLYPH_FAMILY = 'Verdana';"

add "the number is drawn at fractional coordinates, so it shimmers as the mat leans" \
    "$RENDER/glyph-pass.ts" \
    "  ctx.fillText(text, Math.round(centre.x), Math.round(centre.y + baseline));" \
    "  ctx.fillText(text, centre.x + 9, centre.y + baseline);"

add "the number stops being centred on its tile" \
    "$RENDER/glyph-pass.ts" \
    "  ctx.textAlign = 'center';" \
    "  ctx.textAlign = 'left';"

# ⚠️ NO MUTATION ON `ctx.textBaseline`, AND THE ESCAPE IS WHY. Swapping 'alphabetic' back to
# 'middle' was tried and changed nothing measurable -- correctly: `measureText` reports its
# bounding box relative to the CURRENT baseline, so the offset below self-corrects and both
# settings land the ink in the same place. An equivalent mutant, recorded instead of gated.
#
# What is NOT equivalent is dropping the offset, which is the mutation that remains: it puts
# every number 4.6 px low on an 80 px tile, resting on the bottom edge rather than centred.
add "the measured baseline offset is dropped" \
    "$RENDER/glyph-pass.ts" \
    "  const baseline = (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;" \
    "  const baseline = 0;"

add "the glyph pass forgets the zoom, so the numbers stay source-sized" \
    "$RENDER/glyph-pass.ts" \
    "  ctx.font = fontFor(GLYPH_HEIGHT * viewport.zoom);" \
    "  ctx.font = fontFor(GLYPH_HEIGHT);"

# ⚠️ A COMMENT SAT ON THE WRONG ENGINE VERSION THROUGH TWO UPGRADES and survived a deliberate
# sweep, because the sweep grepped for the version being REPLACED and the comment named the one
# before it. The gate finds the phrase instead of the number, so it does not need to be told what
# to look for.
add "a comment names an engine version the manifest does not pin" \
    "$CFG/vite.config.ts" \
    "the pinned version \`8.0.0\`" \
    "the pinned version \`7.0.1\`"

# ⚠️ THE REPORT AND THE GATE HAVE TO STAY TOGETHER. The two tests above fire on the day an engine
# upgrade closes either gap, and a gate that fires with nowhere to read WHY is a puzzle. This is the
# same failure this repository already paid for once, when style.css cited a test nobody had written.
add "the engine-gap report stops naming what the gate watches" \
    "$DOCS/engine-8-consumer-gaps.md" \
    "itself — \`ITENS_DA_ENGINE\` is \`options\`" \
    "itself — that set is \`options\`"

# ⚠️ ADR-0083 MEASURES A WORLD THAT IS GONE, and by ADR-0057 a dated record is SUPERSEDED and never
# amended: editing the table would erase the evidence the decision rested on. The notice at the top
# is what tells a reader who stops after the first screen -- the same shape spike 0 carries.
add "the dated record stops saying that what it measured has changed" \
    "$DOCS/ADR-0083-conformidade-medida.md" \
    "JÁ NÃO É O ESTADO DE HOJE" \
    "continua a valer"

# ⚠️ AND THE OTHER HALF, which a well-meaning tidy-up would break: a notice that arrived together
# with a corrected table would be an amendment wearing a supersession's clothes.
add "the old repository names are tidied away, erasing the measurement" \
    "$DOCS/ADR-0083-conformidade-medida.md" \
    "| \`SP-the-inclusionist-whackwhack\` | \`@the-inclusionist/game-whackwhack\` |" \
    "| \`game-whackwhack\` | \`@the-inclusionist/game-whackwhack\` |"

# ⚠️ A CONFORMANCE PAGE IS THE DOCUMENT MOST WORTH DISTRUSTING: nobody re-reads it and every reader
# takes it at face value. It drifts by LOSING failures, never by inventing them, so the three
# mutations below all delete an admission rather than a claim.
add "the conformance page quietly drops the target size it does not meet" \
    "$DOCS/CONFORMANCE.md" \
    "### 2.5.5 Target Size" \
    "### Target sizing"

add "the page stops admitting that no screen-reader user has tested this" \
    "$DOCS/CONFORMANCE.md" \
    "No screen-reader user has tested this game" \
    "Testing is ongoing"

add "a contrast figure on the page drifts from the one palette.ts measured" \
    "$DOCS/CONFORMANCE.md" \
    "idle tile vs ground **3.10:1**" \
    "idle tile vs ground **3.90:1**"

# ⚠️ THE NUMBERS IN A MAP AGE FIRST, and two of the three in this one were wrong within an hour of
# being written -- counted by eye instead of by find. A stale count is worse than none: a reader
# trusts it precisely where it is least examined.
add "the architecture map miscounts the modules in the tree" \
    "$DOCS/ARCHITECTURE.md" \
    "The map. Thirty-five modules" \
    "The map. Thirty-three modules"

# ⚠️ AN IMPORT THAT NEVER REACHES THE TABLE grows this game's dependency on the engine without
# anybody deciding that it should. The table is where that decision is made visible.
add "an engine import drops off the map while the code keeps using it" \
    "$DOCS/ARCHITECTURE.md" \
    "| \`platform/storage.js\` |" \
    "| (removed) |"

# ⚠️ THE SEARCH TOOL MEASURED A GAME THAT NO LONGER EXISTED for months, because its colours were
# typed into it. It reads `render/palette.ts` now, and this is what stops them being typed back.
add "the palette search goes back to a copy of the colours instead of reading them" \
    "$TESTS/palette-search.cjs" \
    "const GROUND = hex(fromPalette('GROUND'));" \
    "const GROUND = hex('#1C041B');"

# ⚠️ THE FINDING THAT TURNS A COLOUR DECISION INTO A CONSTRAINT: the mat's two contrast steps
# multiply to the whole climb, and the climb is capped at 21, so hc7 cannot happen in any hue.
add "the search stops printing which contrast levels are out of reach" \
    "$TESTS/palette-search.cjs" \
    "IMPOSSIBLE for any palette" \
    "hard to reach"

add "spike 0 stops saying that its conclusions were superseded" \
    "$DOCS/spike-0-symbol-legibility.md" \
    "> ## ⚠️ FIVE OF THIS DOCUMENT'S CONCLUSIONS NO LONGER HOLD" \
    "> ## Notes"

add "the old decision table is presented as current again" \
    "$DOCS/spike-0-symbol-legibility.md" \
    "| Decision (2026-09-05) | Value as decided then |" \
    "| Decision | Value |"

add "GAME-RULES forgets that the segment layout was replaced" \
    "$DOCS/GAME-RULES.md" \
    "### The number is set in Atkinson Hyperlegible" \
    "### The number is set in a typeface"

TO_FILE="$(mktemp)"

# ========================= AN INTERRUPTED RUN MUST NOT LEAVE MUTATED SOURCE =========================
# ⚠️ THIS TRAP USED TO CLEAN UP THE TEMP FILE AND NOTHING ELSE, and the omission bit three times in
# one afternoon. The loop below copies a source file to `.bak`, edits the original, runs the suite,
# and restores. Kill it anywhere in the middle -- Ctrl+C, a stopped background task, a closed
# terminal -- and the file is left BROKEN on disk with a `.bak` beside it, silently. Twice it was
# `ui/grid-mirror.ts` and once `rules/difficulty.ts`; each time it was found by `git status` minutes
# later, and each time it could as easily have been committed.
#
# `MUTATING` names the file that is mutated RIGHT NOW, or is empty between mutations. `restore` is
# idempotent, which matters because an `exit` inside the INT handler fires the EXIT trap as well.
MUTATING=""
restore() {
  if [ -n "$MUTATING" ] && [ -f "$MUTATING.bak" ]; then
    mv "$MUTATING.bak" "$MUTATING"
    echo
    echo "interrupted - restored $MUTATING"
  fi
  MUTATING=""
  rm -f "$TO_FILE"
}
trap 'restore' EXIT
trap 'restore; exit 130' INT
trap 'restore; exit 143' TERM

# ⚠️ THE BASELINE MUST BE GREEN, and this check exists because its absence produced a lie.
# A run with one already-failing test reported 58 of 58 mutations "caught" — every mutation looked
# lethal because the suite was dead before any of them was applied. A mutation harness on a red
# baseline measures nothing at all and says everything is fine, which is the worst combination.
# ⚠️ `node` E NÃO `npx`, E A RAZÃO É UMA JANELA POR MUTAÇÃO. No Windows o `npx` não é um binário: é
# um shim `.cmd`, e o Git Bash lança `cmd.exe` para o correr. Com 191 mutações isso são 191 janelas
# de prompt a abrir e fechar por cima do que o Dev estiver a fazer -- medido, e relatado por ele na
# terceira. `node_modules/vitest/vitest.mjs` é o ficheiro que o `npx` acaba por chamar de qualquer
# forma, portanto isto corre o MESMO vitest e não passa por shell nenhuma.
VITEST="node node_modules/vitest/vitest.mjs"

# ========================= THE FIRST FULL RUN, 2026-09-11 =========================
# 📏 216 declared, 216 applied, 216 CAUGHT. Zero escaped, zero skipped for a drifted anchor.
#
# ⚠️ IT HAD NEVER BEEN DONE BEFORE THAT DAY, in either of two senses, and both are worth keeping:
# the set had only ever been run FILTERED, and `ci.yml` said in as many words that no runner had
# ever run it. A gate that has never been run whole is a gate nobody has measured -- every piece
# was green when it was written, which says nothing about the pieces nobody has touched since.
#
# 📏 It took about NINE MINUTES, not the fifty that were feared, because of the cheap-project-first
# change above: the declaration is 22 mutations in 40 seconds when `node` catches all of them. The
# fifty-minute estimate was measured on a cold Vite cache and was wrong by a factor of five.
#
# 📌 Run in pieces, by directory, and the pieces were then checked to cover the whole exactly
# once: every declared name appears in the log, no name twice, nothing in the log the script does
# not declare. A filtered run proves only what it ran -- the UNION of disjoint runs proves all of
# it, and that union is what was verified rather than assumed.

echo "checking the baseline is green before mutating anything..."
if ! $VITEST run >/dev/null 2>&1; then
  echo
  echo "BASELINE IS RED. Every mutation would report as caught for the wrong reason."
  echo "Fix the suite first, then re-run this."
  exit 2
fi
echo "baseline green."
echo

# ========================= RUNNING IT IN PIECES =========================
# `bash tests/mutation-check.sh combo` runs only the mutations whose NAME or FILE contains
# "combo". It exists because the whole set was twelve minutes of silence, and twelve minutes of
# silence is how this ended up being run in the
# background, out of the Dev's sight, twice. A filtered run is a minute and prints as it goes.
#
# ⚠️ A FILTERED RUN PROVES ONLY WHAT IT RAN. The exit status still means "nothing escaped",
# but of a subset, so it is a development tool and not the gate. The gate is the unfiltered run.
# ========================= THE EVERYDAY RUN IS `--changed` =========================
# 📏 MEASURED 2026-09-11, and the arithmetic is why this mode exists. A clean `node` suite is
# 1.8 s and a clean `browser` suite is 5.1 s, but ONE mutation cycle costs 5.7 s to 10 s -- the
# difference is Vite re-transforming the module graph after the file on disk changes, and no
# amount of startup tuning touches it. At 228 mutations the whole set is about twenty minutes,
# and it is a CI or nightly job rather than something anyone waits for.
#
# ⚠️ THE DISCIPLINE NEVER ASKED FOR THE WHOLE SET ANYWAY. The rule is «every gate is born red and
# proven able to fail» -- which is about the gate you just wrote, not about the two hundred that
# were proven when they were written. `--changed` runs exactly the mutations whose FILE this
# working tree has touched, so proving what you just changed costs one cycle instead of the set.
#
#   bash tests/mutation-check.sh --changed          # vs the last commit, and what is staged
#   bash tests/mutation-check.sh --since main       # vs any ref
#   bash tests/mutation-check.sh combo              # by name or path, as before
#   bash tests/mutation-check.sh                    # the whole set. The gate.
FILTER="${1:-}"
CHANGED=""

if [ "$FILTER" = "--changed" ] || [ "$FILTER" = "--since" ]; then
  if [ "$FILTER" = "--since" ]; then
    REF="${2:?--since needs a git ref}"
    CHANGED="$(git diff --name-only "$REF" 2>/dev/null)"
    echo "CHANGED SINCE $REF:"
  else
    # Working tree AND index, so a staged-but-uncommitted change is covered too. `git status`
    # rather than `git diff` because it sees untracked files, and a new source file with a new
    # mutation beside it is exactly the case worth catching.
    CHANGED="$(git status --porcelain | sed 's/^...//' | sed 's/.* -> //')"
    echo "CHANGED IN THE WORKING TREE:"
  fi
  if [ -z "$CHANGED" ]; then
    echo "  (nothing)"
    echo
    echo "no file changed, so no mutation is worth running. Nothing proven, nothing claimed."
    exit 0
  fi
  echo "$CHANGED" | sed 's/^/  /'
  echo
  FILTER=""
elif [ -n "$FILTER" ]; then
  echo "FILTERED to mutations matching: $FILTER"
  echo "(a partial run -- the gate is this script with no argument)"
  echo
fi

caught=0
escaped=0
skipped=0
for i in "${!NAMES[@]}"; do
  if [ -n "$FILTER" ]; then
    case "${NAMES[$i]} ${FILES[$i]}" in
      *"$FILTER"*) ;;
      *) skipped=$((skipped + 1)); continue ;;
    esac
  fi
  if [ -n "$CHANGED" ]; then
    # The mutation runs only if the file it edits is one of the changed ones.
    case "$CHANGED" in
      *"${FILES[$i]}"*) ;;
      *) skipped=$((skipped + 1)); continue ;;
    esac
  fi
  f="${FILES[$i]}"
  cp "$f" "$f.bak"
  # Set AFTER the copy: a trap that fires between the two would otherwise try to restore from a
  # `.bak` that does not exist yet. `restore` checks for the file anyway, and both guards are cheap.
  MUTATING="$f"

  # The replacement goes through a FILE, never through argv: a multi-line argument is truncated
  # at the first newline on the way to a Windows node process, and when the surviving line equals
  # the anchor the mutation silently does nothing while the harness reports it as escaped.
  printf '%s' "${TOS[$i]}" > "$TO_FILE"

  if ! node tests/mutate.cjs "$f" "${FROMS[$i]}" --to-file "$TO_FILE"; then
    echo "SKIP  (anchor drifted) - ${NAMES[$i]}"
    mv "$f.bak" "$f"
    MUTATING=""
    escaped=$((escaped + 1))
    continue
  fi

  # ========================= THE CHEAP PROJECT FIRST =========================
  # ⚠️ THIS IS A SPEEDUP AND NOT A WEAKENING, and the difference matters enough to write down.
  #
  # A mutation is CAUGHT when the suite goes red. The suite is two projects: `node` is pure and
  # takes about two seconds, `browser` starts Playwright and takes about twelve. Running both for
  # every mutation asks a question that is already answered whenever the first one goes red --
  # once `node` fails, nothing the browser could report changes the verdict.
  #
  # So `browser` runs only when `node` PASSED, which is exactly the case where the answer is still
  # open. The verdict for every mutation is identical to running both together; what changes is
  # that the majority -- rules, spawn, round, the declaration -- stop paying for a browser they
  # never needed.
  #
  # 📏 Measured before this: ~15-25 s per mutation, so the ~200 in this file were about 17 minutes
  # of wall clock, which is why the unfiltered run had never once been done end to end.
  #
  # ⚠️ AND A RED `node` STILL HAS TO BE A RED CAUSED BY THE MUTATION. The baseline check at the top
  # is what makes that true: it refuses to start unless the WHOLE suite is green, so anything red
  # below is red because of the line that was just changed.
  # ⚠️ THIS FLAG EXISTS BECAUSE THE ANCHOR CHECK CONTAMINATED EVERY VERDICT, and it did so for
  # five commits including the first full sweep. `tests/mutation-anchors.node.test.ts` asserts
  # every anchor still matches its file -- and APPLYING a mutation deletes the very line its own
  # anchor points at, so the check failed for every mutation and the harness read that failure as
  # "caught". A gate that reports success for reasons of its own is the exact defect this whole
  # file exists to find, and it was inside the file that finds it.
  export INCL_MUTATING=1
  if $VITEST run --project node >/dev/null 2>&1; then
    if $VITEST run --project browser >/dev/null 2>&1; then
      echo "ESCAPED - ${NAMES[$i]}"
      escaped=$((escaped + 1))
    else
      echo "caught  - ${NAMES[$i]}"
      caught=$((caught + 1))
    fi
  else
    echo "caught  - ${NAMES[$i]}"
    caught=$((caught + 1))
  fi
  unset INCL_MUTATING
  mv "$f.bak" "$f"
  MUTATING=""
done

echo
if [ -n "$CHANGED" ]; then
  echo "changed-only: $((caught + escaped)) run, $skipped not run"
  echo "(the gate is this script with no argument; this proves what you touched)"
elif [ -n "$FILTER" ]; then
  echo "filtered by \"$FILTER\": $((caught + escaped)) run, $skipped not run"
fi
echo "mutations caught: $caught   escaped: $escaped"
# A SKIP counts as an escape on purpose. An anchor that no longer matches its file is a gate that
# has stopped being checked, and it fails silently in both directions: the mutation is never
# applied, so the suite stays green, so the run looks clean. Five of these had been skipping since
# the palette was re-measured and the mat turned 4x5.
[ "$escaped" -eq 0 ]
