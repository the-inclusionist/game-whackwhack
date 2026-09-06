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

add "the 1 goes back to hugging the right edge of its cell" \
    "$RENDER/glyph.ts" \
    "const DIGIT_NUDGE: Readonly<Record<string, number>> = { '1': -1.5 };" \
    "const DIGIT_NUDGE: Readonly<Record<string, number>> = {};"

add "a 6 draws the same shape as a 5" \
    "$RENDER/glyph.ts" \
    "  '6': ['top', 'topLeft', 'middle', 'bottomLeft', 'bottomRight', 'bottom']," \
    "  '6': ['top', 'topLeft', 'middle', 'bottomRight', 'bottom'],"

add "the glyph grows past the tile it sits on" \
    "$RENDER/glyph.ts" \
    "export const GLYPH_HEIGHT = 9;" \
    "export const GLYPH_HEIGHT = 17;"

add "the glyph stops being centred" \
    "$RENDER/glyph.ts" \
    "    const originX = -total / 2 + i * (boxW + gap) + (DIGIT_NUDGE[ch] ?? 0) * step;" \
    "    const originX = i * (boxW + gap) + (DIGIT_NUDGE[ch] ?? 0) * step;"

add "a letter takes the whole frame down mid-round" \
    "$RENDER/glyph.ts" \
    "  const digits = [...text].filter((ch) => DIGIT_SEGMENTS[ch] !== undefined);" \
    "  const digits = [...text];"

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

add "the camera pitch flattens the mat" \
    "$RENDER/zdog-stage.ts" \
    "  pitch: -0.9," \
    "  pitch: -0.05,"

add "a lit tile stops changing colour" \
    "$RENDER/mat.ts" \
    "        faces[cell].color = on ? TILE_LIT : TILE_IDLE;" \
    "        faces[cell].color = TILE_IDLE;"

add "the gutter between tiles disappears" \
    "$RENDER/mat.ts" \
    "const GUTTER = 1.5;" \
    "const GUTTER = 0;"

add "the glyph is drawn at fractional coordinates, so it blurs" \
    "$RENDER/glyph-pass.ts" \
    "    const x0 = Math.round(centre.x + Math.min(stroke.from.x, stroke.to.x));" \
    "    const x0 = centre.x + Math.min(stroke.from.x, stroke.to.x) + 0.5;"

add "a vertical segment collapses to nothing" \
    "$RENDER/glyph-pass.ts" \
    "    ctx.fillRect(x0, y0, Math.max(weight, x1 - x0), Math.max(weight, y1 - y0));" \
    "    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);"

add "the glyph is placed at the tile corner instead of its centre" \
    "$RENDER/glyph-pass.ts" \
    "    stampOne(ctx, centreOf(quad, viewport), item.text, height, weight);" \
    "    stampOne(ctx, { x: quad.corners[0].x, y: quad.corners[0].y }, item.text, height, weight);"

add "the projected centre is read without the zoom" \
    "$RENDER/picking.ts" \
    "    x: point.x * viewport.zoom + viewport.width / 2," \
    "    x: point.x + viewport.width / 2,"

add "the result screen loses its way forward" \
    "$UI/screens.ts" \
    "  card.append(score, level, again, change);" \
    "  card.append(score, level);"

add "the result screen offers only replaying, never changing options" \
    "$UI/screens.ts" \
    "  card.append(score, level, again, change);" \
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

add "the title starts with a fixed category whatever was chosen" \
    "$UI/screens.ts" \
    "      category: deps.categories.find((c) => c.id === category.select.value) ?? deps.categories[0]," \
    "      category: deps.categories[0],"

add "the title ignores the chosen difficulty" \
    "$UI/screens.ts" \
    "      difficulty: difficulty.select.value as Difficulty," \
    "      difficulty: 'medium' as Difficulty,"

add "the selects lose their labels" \
    "$UI/screens.ts" \
    "  label.htmlFor = id;" \
    "  label.htmlFor = 'nope';"

add "an option is shown by its raw id" \
    "$UI/screens.ts" \
    "    deps.categories.map((c) => ({ value: c.id, label: i18n.t(c.nameKey) }))," \
    "    deps.categories.map((c) => ({ value: c.id, label: c.id })),"

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

add "a category name stops matching its catalogue key" \
    "$RULES/category.ts" \
    "export const MULTIPLE_OF_4 = multipleOf(4, { id: 'multiple-of-4', nameKey: 'obj.multiplesOf4' });" \
    "export const MULTIPLE_OF_4 = multipleOf(4, { id: 'multiple-of-4', nameKey: 'obj.multiplesOfFour' });"

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
    "  return Math.max(0, 9000 - 9000 * 0.22 * level) + 5000;" \
    "  return 9000 - 9000 * 0.22 * level + 5000;"

add "the decay factor shifts off the original curve" \
    "$RULES/difficulty.ts" \
    "  return Math.max(0, 9000 - 9000 * 0.22 * level) + 5000;" \
    "  return Math.max(0, 9000 - 9000 * 0.2 * level) + 5000;"

add "a rounding call is put back to absorb drift" \
    "$RULES/difficulty.ts" \
    "  return Math.max(0, 9000 - 9000 * 0.22 * level) + 5000;" \
    "  return Math.round(Math.max(0, 9000 - 9000 * 0.219 * level) + 5000);"

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

add "the first tile waits a full gap after Play is pressed" \
    "$RULES/round.ts" \
    "  let spawnLeft = 0;" \
    "  let spawnLeft = 3000;"

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
echo "checking the baseline is green before mutating anything..."
if ! npx vitest run >/dev/null 2>&1; then
  echo
  echo "BASELINE IS RED. Every mutation would report as caught for the wrong reason."
  echo "Fix the suite first, then re-run this."
  exit 2
fi
echo "baseline green."
echo

caught=0
escaped=0
for i in "${!NAMES[@]}"; do
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

  if npx vitest run >/dev/null 2>&1; then
    echo "ESCAPED - ${NAMES[$i]}"
    escaped=$((escaped + 1))
  else
    echo "caught  - ${NAMES[$i]}"
    caught=$((caught + 1))
  fi
  mv "$f.bak" "$f"
  MUTATING=""
done

echo
echo "mutations caught: $caught   escaped: $escaped"
# A SKIP counts as an escape on purpose. An anchor that no longer matches its file is a gate that
# has stopped being checked, and it fails silently in both directions: the mutation is never
# applied, so the suite stays green, so the run looks clean. Five of these had been skipping since
# the palette was re-measured and the mat turned 4x5.
[ "$escaped" -eq 0 ]
