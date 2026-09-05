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

add "levelAt drops the clamp to one" \
    "$RULES/difficulty.ts" \
    "return Math.max(1, Math.ceil(elapsedMs / LEVEL_MS));" \
    "return Math.ceil(elapsedMs / LEVEL_MS);"

add "the decay factor shifts off the original curve" \
    "$RULES/difficulty.ts" \
    "return Math.max(0, 9000 - 9000 * 0.22 * level) + 5000;" \
    "return Math.max(0, 9000 - 9000 * 0.2 * level) + 5000;"

add "waveDeadlineMs loses its five-second floor" \
    "$RULES/difficulty.ts" \
    "return Math.max(0, 9000 - 9000 * 0.22 * level) + 5000;" \
    "return 9000 - 9000 * 0.22 * level + 5000;"

add "a rounding call is put back to absorb drift" \
    "$RULES/difficulty.ts" \
    "return Math.max(0, 9000 - 9000 * 0.22 * level) + 5000;" \
    "return Math.round(Math.max(0, 9000 - 9000 * 0.219 * level) + 5000);"

add "the level turns every second instead of every fifteen" \
    "$RULES/difficulty.ts" \
    "export const LEVEL_MS = 15_000;" \
    "export const LEVEL_MS = 1_000;"

add "the hardest wave lights only one tile" \
    "$RULES/difficulty.ts" \
    "  hard: 4," \
    "  hard: 1,"

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

add "the wave stops shuffling before pairing" \
    "$RULES/wave.ts" \
    "  const placed = shuffled(values, rnd);" \
    "  const placed = values;"

add "the correct count loses its lower bound" \
    "$RULES/wave.ts" \
    "  const minCorrect = Math.max(1, litCount - wrong.length);" \
    "  const minCorrect = 1;"

add "the correct count loses its upper bound" \
    "$RULES/wave.ts" \
    "  const maxCorrect = Math.min(litCount - 1, right.length);" \
    "  const maxCorrect = litCount - 1;"

add "every lit tile becomes correct" \
    "$RULES/wave.ts" \
    "  const correctCount = minCorrect + Math.floor(rnd() * (maxCorrect - minCorrect + 1));" \
    "  const correctCount = litCount;"

add "take draws with replacement, so a value can repeat" \
    "$RULES/wave.ts" \
    "    const j = i + Math.floor(rnd() * (pool.length - i));" \
    "    const j = Math.floor(rnd() * pool.length);"

add "the wave accepts a single lit tile" \
    "$RULES/wave.ts" \
    "  if (!Number.isInteger(litCount) || litCount < 2) {" \
    "  if (litCount < 0) {"

add "the wave accepts a deadline that already passed" \
    "$RULES/wave.ts" \
    "  if (!(deadlineMs > 0)) {" \
    "  if (deadlineMs < 0) {"

add "a tile lies about being correct" \
    "$RULES/wave.ts" \
    "    ...take(wrong, litCount - correctCount, rnd).map((value) => ({ value, correct: false }))," \
    "    ...take(wrong, litCount - correctCount, rnd).map((value) => ({ value, correct: true })),"

add "a rules module reaches for the engine" \
    "$RULES/category.ts" \
    "import { LIT_PER_WAVE } from './difficulty.ts';" \
    "import { rnd } from '@the-inclusionist/engine/core/rng.js';
import { LIT_PER_WAVE } from './difficulty.ts';"

add "a rules module reaches for the renderer" \
    "$RULES/wave.ts" \
    "import type { Category } from './category.ts';" \
    "import type { Category } from './category.ts';
import { CAMERA } from '../render/zdog-stage.ts';"

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
    "export const MAT_COLS = 5;" \
    "export const MAT_COLS = 4;"

RENDER=app/js/render

add "the unlit tile goes back to the colour spike 0 rejected" \
    "$RENDER/palette.ts" \
    "export const TILE_IDLE = '#686878';" \
    "export const TILE_IDLE = '#2E3B4E';"

add "the lit tile stops separating from the unlit one" \
    "$RENDER/palette.ts" \
    "export const TILE_LIT = '#F2D479';" \
    "export const TILE_LIT = '#8A8A98';"

add "the ink stops being readable on its tile" \
    "$RENDER/palette.ts" \
    "export const INK = '#1A1206';" \
    "export const INK = '#6A5A30';"

add "the palette separates by hue instead of luminance" \
    "$RENDER/palette.ts" \
    "export const TILE_IDLE = '#686878';" \
    "export const TILE_IDLE = '#38784A';"

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

add "setLit stops clearing the previous wave" \
    "$RENDER/mat.ts" \
    "        anchors[cell].translate.y = on ? -TILE_RISE : 0;" \
    "        if (on) anchors[cell].translate.y = -TILE_RISE;"

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

add "letting a WRONG tile expire becomes a mistake" \
    "$RULES/round.ts" \
    "      if (!tile.resolved && tile.correct) {" \
    "      if (!tile.resolved) {"

add "letting a CORRECT tile expire stops costing anything" \
    "$RULES/round.ts" \
    "      if (!tile.resolved && tile.correct) {" \
    "      if (false) {"

add "a second hit on the same tile charges again" \
    "$RULES/round.ts" \
    "      const tile = tiles.find((t) => t.cell === cell && !t.resolved);" \
    "      const tile = tiles.find((t) => t.cell === cell);"

add "hitting a dark tile becomes a mistake" \
    "$RULES/round.ts" \
    "      if (!tile) return out;   // dark, or already answered. Neither is a mistake." \
    "      if (!tile) { errors += 1; return out; }"

add "the wave waits out the clock even when every tile is answered" \
    "$RULES/round.ts" \
    "      if (tiles.every((t) => t.resolved)) clearWave(out);" \
    "      void 0;"

add "the wave deadline shrinks every frame again" \
    "$RULES/round.ts" \
    "    wave = { tiles, deadlineMs };" \
    "    wave = { tiles, get deadlineMs() { return timeLeft; } } as unknown as Wave;"

add "the level stops being announced" \
    "$RULES/round.ts" \
    "        out.push({ kind: 'level-up', level });" \
    "        void level;"

add "the end of the round is announced on every later frame" \
    "$RULES/round.ts" \
    "    if (ended) return true;" \
    "    if (false) return true;"

add "a long frame swallows the wave that opened inside it" \
    "$RULES/round.ts" \
    "      while (remaining > 0 && !ended) {" \
    "      if (remaining > 0 && !ended) {"

add "the gap is not restarted after a wave clears" \
    "$RULES/round.ts" \
    "    gapLeft = waveGapMs(level);" \
    "    void level;"

add "the round keeps running after it is over" \
    "$RULES/round.ts" \
    "      if (ended || dtMs <= 0) return out;" \
    "      if (dtMs <= 0) return out;"

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

add "the new wave names only the CORRECT values" \
    "$UI/announce.ts" \
    "          values: event.wave.tiles.map((t) => t.value).join(', ')," \
    "          values: event.wave.tiles.filter((t) => t.correct).map((t) => t.value).join(', '),"

add "the wave announcement drops what to collect" \
    "$UI/announce.ts" \
    "          what: context.collecting," \
    "          what: ''," \

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

add "clearing a wave becomes an announcement" \
    "$UI/announce.ts" \
    "      return null;" \
    "      return { text: 'wave cleared', urgent: false };"

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

TO_FILE="$(mktemp)"
trap 'rm -f "$TO_FILE"' EXIT

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

  # The replacement goes through a FILE, never through argv: a multi-line argument is truncated
  # at the first newline on the way to a Windows node process, and when the surviving line equals
  # the anchor the mutation silently does nothing while the harness reports it as escaped.
  printf '%s' "${TOS[$i]}" > "$TO_FILE"

  if ! node tests/mutate.cjs "$f" "${FROMS[$i]}" --to-file "$TO_FILE"; then
    echo "SKIP  (anchor drifted) - ${NAMES[$i]}"
    mv "$f.bak" "$f"
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
done

echo
echo "mutations caught: $caught   escaped: $escaped"
[ "$escaped" -eq 0 ]
