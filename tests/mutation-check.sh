#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Proves each rules gate can actually fail. Green that could never have been red proves nothing.
# Applies one mutation at a time, runs the node project, and expects a FAILURE. Always restores.
#
# ⚠️ The substitution runs through tests/mutate.cjs rather than `node -e`, which in this sandbox
# writes nothing, prints nothing and exits 0 — turning every mutation into a false "escaped".
set -u
cd "$(dirname "$0")/.."

RULES=app/js/rules
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

TO_FILE="$(mktemp)"
trap 'rm -f "$TO_FILE"' EXIT

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

  if npx vitest run --project node >/dev/null 2>&1; then
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
