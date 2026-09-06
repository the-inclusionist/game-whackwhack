// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/grid-mirror — the mat, in the DOM, for everyone who is not looking at the canvas.
//
// ========================= THE CANVAS IS NOT THE SOURCE OF TRUTH =========================
// The canvas is `aria-hidden`, deliberately, and this module IS the mat as far as a screen reader
// is concerned: twenty real buttons in a real grid, each saying where it is and what is on it.
// The engine applies the same rule to itself — the game speaks through the DOM.
//
// ========================= ITS LABELS COME FROM THE DECLARATION =========================
// Not from a second table. `nameAt` and `roleAt` are already the answers the sonar and the
// colour-blocking use, so reading them here means the screen reader, the audio navigation and the
// high-contrast pass cannot disagree about what a tile is. A separate label table would be a
// second source of truth for the one fact the whole game turns on.
//
// ========================= THE CHOICES WORTH DEFENDING =========================
//
//  · REAL BUTTONS, with `role="gridcell"` layered on. The role supplies the row and column
//    semantics; the ELEMENT keeps its activation behaviour, so Enter and Space work because the
//    platform makes them work rather than because this file re-implements them.
//
//  · ROVING TABINDEX. One cell is in the tab order at a time. Twenty tab stops on the way past a
//    game board would be an accessibility failure of its own.
//
//  · ONE FUNNEL. Pointer and keyboard both end in `onActivate(cell)`. They cannot drift apart if
//    there is nowhere to drift to.
//
//  · ARROWS CLAMP, THEY DO NOT WRAP. On a mat where a wave can be anywhere, wrapping from the last
//    column to the first row silently teleports a player who was counting their way across.
//
//  · THE STATE IS IN `aria-disabled`, NOT IN THE LABEL. A reader then says "dimmed" in the user's
//    own language rather than in whatever this catalogue happens to carry — and an unlit tile
//    stays focusable, because a player exploring the mat needs to be able to visit it.

import type { GameDeclaration, Spot } from '@the-inclusionist/engine/core/contract.js';
import { MAT_CELLS, MAT_COLS, MAT_ROWS, spotOfCell } from '../rules/grid.ts';
import { HAMMER } from '../input/actions.ts';

/** What the mirror needs of the declaration: the two questions about a place. */
export type MirrorDeclaration = Pick<GameDeclaration, 'nameAt' | 'roleAt'>;

export interface GridMirrorDeps {
  readonly doc: Document;
  readonly declaration: MirrorDeclaration;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  /** The same handler a click uses. */
  onActivate(cell: number): void;
  /** Called when the keyboard cursor moves, so the mat can draw it. */
  onCursor?(cell: number): void;
  /**
   * Turns a key CODE into an intent, so the mat can be walked with whatever keys the player can
   * reach. The engine's KeyboardRuntime is the real one and it is remappable and saved; without
   * it this falls back to the arrow keys alone.
   *
   * Injected rather than imported so the grid can be tested without booting an engine.
   */
  resolveAction?(code: string): string | null;
}

export interface GridMirror {
  readonly root: HTMLElement;
  /** Re-labels every cell from the current declaration. Call after anything changes. */
  refresh(): void;
  focusCell(cell: number): void;
  cursor(): number;
  destroy(): void;
}

const ARROW_INTENT: Readonly<Record<string, string>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * The intents this grid MOVES on.
 *
 * ⚠️ The comment here named `jump` and `run`, and those words no longer exist. ADR-0074 emptied
 * the engine's vocabulary of meaning and ADR-0077 finished it: the positions are `up`..`right`,
 * `action1`..`action4`, four shoulders and triggers, `start` and `select`, and not one of them says
 * what it is for. A stale comment about a platformer's verbs was the only thing in this file that
 * still claimed otherwise.
 */
const MOVES = new Set(['up', 'down', 'left', 'right']);

/**
 * The codes the PLATFORM already turns into a click on a focused `<button>`.
 *
 * ⚠️ HANDLING `action1` MYSELF ON THESE WOULD FIRE THE HAMMER TWICE -- once from this keydown
 * and once from the native click that follows it. The whole reason the mirror is made of real
 * buttons is that Enter and Space come free; the manual path exists only for a child who has
 * REMAPPED the hammer onto some other key, which the platform knows nothing about.
 */
const NATIVE_ACTIVATION = new Set(['Enter', 'NumpadEnter', 'Space']);

/** Where an intent lands from `cell`, clamped at the edges. Pure, so it is tested on its own. */
export function step(cell: number, intent: string): number {
  const at = spotOfCell(cell);
  let { x, y } = at;
  if (intent === 'left') x -= 1;
  else if (intent === 'right') x += 1;
  else if (intent === 'up') y -= 1;
  else if (intent === 'down') y += 1;
  else return cell;
  // Clamp rather than wrap: a player counting their way across the mat should hit a wall, not
  // reappear somewhere else.
  x = Math.min(MAT_COLS - 1, Math.max(0, x));
  y = Math.min(MAT_ROWS - 1, Math.max(0, y));
  return y * MAT_COLS + x;
}

export function createGridMirror(deps: GridMirrorDeps): GridMirror {
  const { doc, declaration, t } = deps;

  const root = doc.createElement('div');
  root.className = 'grid-mirror sr-only';
  root.setAttribute('role', 'grid');
  root.setAttribute('aria-label', t('mat.label'));
  root.setAttribute('aria-rowcount', String(MAT_ROWS));
  root.setAttribute('aria-colcount', String(MAT_COLS));

  const cells: HTMLButtonElement[] = [];
  let cursorCell = 0;

  for (let row = 0; row < MAT_ROWS; row++) {
    const rowEl = doc.createElement('div');
    rowEl.setAttribute('role', 'row');
    rowEl.setAttribute('aria-rowindex', String(row + 1));

    for (let col = 0; col < MAT_COLS; col++) {
      const cell = row * MAT_COLS + col;
      const button = doc.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-colindex', String(col + 1));
      button.dataset.cell = String(cell);
      // Roving tabindex: only the cursor is reachable by Tab.
      button.tabIndex = cell === cursorCell ? 0 : -1;
      button.addEventListener('click', () => {
        moveCursor(cell, { focus: false });
        deps.onActivate(cell);
      });
      button.addEventListener('keydown', onKeyDown);
      rowEl.appendChild(button);
      cells.push(button);
    }
    root.appendChild(rowEl);
  }

  function intentOf(event: KeyboardEvent): string | null {
    const mapped = deps.resolveAction?.(event.code);
    if (mapped) return mapped;
    return ARROW_INTENT[event.code] ?? null;
  }

  function onKeyDown(event: KeyboardEvent): void {
    const from = Number((event.currentTarget as HTMLElement).dataset.cell);
    const intent = intentOf(event);

    // The hammer, for a remapped key. See NATIVE_ACTIVATION for why Enter and Space are excluded
    // rather than handled here: on a real button the platform already delivers them as a click.
    if (intent === HAMMER && !NATIVE_ACTIVATION.has(event.code)) {
      event.preventDefault();
      deps.onActivate(from);
      return;
    }

    if (!intent || !MOVES.has(intent)) return;
    const to = step(from, intent);
    event.preventDefault();
    // Moving to where you already are is not a no-op worth announcing, but it must not scroll
    // the page either — hence preventDefault above the equality check.
    if (to !== from) moveCursor(to, { focus: true });
  }

  function moveCursor(cell: number, options: { focus: boolean }): void {
    cells[cursorCell].tabIndex = -1;
    cursorCell = cell;
    cells[cursorCell].tabIndex = 0;
    if (options.focus) cells[cursorCell].focus();
    deps.onCursor?.(cell);
  }

  function labelFor(cell: number): string {
    const at: Spot = spotOfCell(cell);
    const name = declaration.nameAt(at);
    // Columns and rows are named from one, because that is how a person counts them out loud.
    return t('mat.cell', {
      col: at.x + 1,
      row: at.y + 1,
      content: name ? name.text : t('mat.empty'),
    });
  }

  function refresh(): void {
    for (let cell = 0; cell < MAT_CELLS; cell++) {
      const button = cells[cell];
      const role = declaration.roleAt(spotOfCell(cell));
      button.setAttribute('aria-label', labelFor(cell));
      // An unlit tile stays FOCUSABLE — exploring the mat is how a blind player builds a picture
      // of it — but is marked dimmed so a reader can say so without this file naming the state in
      // one particular language.
      button.setAttribute('aria-disabled', role === 'free' ? 'true' : 'false');
      button.dataset.role = role;
    }
  }

  refresh();

  return {
    root,
    refresh,
    focusCell(cell: number) { moveCursor(cell, { focus: true }); },
    cursor() { return cursorCell; },
    destroy() {
      for (const button of cells) button.removeEventListener('keydown', onKeyDown);
      root.remove();
      cells.length = 0;
    },
  };
}
