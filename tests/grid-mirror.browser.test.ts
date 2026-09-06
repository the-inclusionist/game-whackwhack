// SPDX-License-Identifier: AGPL-3.0-or-later
// The board a screen reader actually meets, and the keyboard path through it.
//
// A whole round has to be playable without a pointer and without the canvas. These tests are that
// claim, made concrete: real buttons, one tab stop, arrows that clamp, and one funnel that both
// input paths end in.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAT_CELLS, MAT_COLS, MAT_ROWS, spotOfCell } from '../app/js/rules/grid.ts';
import { createGridMirror, step, type MirrorDeclaration } from '../app/js/ui/grid-mirror.ts';
import { createWhackDeclaration } from '../app/js/declaration/whack-declaration.ts';
import { EVEN } from '../app/js/rules/category.ts';
import type { RoundTile } from '../app/js/rules/round.ts';

/** Two tiles on the mat: one to collect at cell 0, one to leave alone at cell 7. */
const TILES: RoundTile[] = [
  { cell: 0, value: 4, correct: true, heat: 1 },
  { cell: 7, value: 7, correct: false, heat: 0.5 },
];

/** Echoes the key and its params, so a test can see a real lookup rather than a hardcoded string. */
const echo = (key: string, params?: Record<string, string | number>): string =>
  params ? `${key}(${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',')})` : key;

const made: { destroy(): void }[] = [];

function mirror(over: { tiles?: readonly RoundTile[] } = {}) {
  let tiles: readonly RoundTile[] = over.tiles ?? TILES;
  const declaration: MirrorDeclaration = createWhackDeclaration({
    view: () => ({ category: EVEN, tiles, hits: 0, focus: null }),
    t: echo,
  });
  const onActivate = vi.fn();
  const onCursor = vi.fn();
  const m = createGridMirror({ doc: document, declaration, t: echo, onActivate, onCursor });
  document.body.appendChild(m.root);
  made.push(m);
  return { m, onActivate, onCursor, setTiles: (next: readonly RoundTile[]) => { tiles = next; } };
}

function buttons(m: { root: HTMLElement }): HTMLButtonElement[] {
  return [...m.root.querySelectorAll('button')] as HTMLButtonElement[];
}

afterEach(() => {
  for (const m of made) m.destroy();
  made.length = 0;
  document.body.replaceChildren();
});

describe('[Interface] it is a real grid of real buttons', () => {
  it('has one button per cell', () => {
    expect(buttons(mirror().m)).toHaveLength(MAT_CELLS);
  });

  it('is a grid of rows, so a reader can say where it is', () => {
    const { m } = mirror();
    expect(m.root.getAttribute('role')).toBe('grid');
    expect(m.root.querySelectorAll('[role="row"]')).toHaveLength(MAT_ROWS);
    expect(m.root.getAttribute('aria-colcount')).toBe(String(MAT_COLS));
  });

  it('uses BUTTON elements, so Enter and Space work by platform', () => {
    // Re-implementing activation on a div is where keyboard support usually breaks: the
    // handler covers Enter and forgets Space, or vice versa.
    for (const button of buttons(mirror().m)) {
      expect(button.tagName).toBe('BUTTON');
      expect(button.type).toBe('button');
      expect(button.getAttribute('role')).toBe('gridcell');
    }
  });

  it('is hidden from sight but not from a reader', () => {
    expect(mirror().m.root.className).toContain('sr-only');
    expect(mirror().m.root.getAttribute('aria-hidden')).toBeNull();
  });
});

describe('[Right] exactly one cell is in the tab order', () => {
  it('starts with a single tab stop', () => {
    const reachable = buttons(mirror().m).filter((b) => b.tabIndex === 0);
    expect(reachable).toHaveLength(1);
  });

  it('still has exactly one after the cursor moves', () => {
    // Twenty tab stops on the way past a game board would be its own accessibility failure, and
    // ZERO would strand a keyboard user outside the mat entirely.
    const { m } = mirror();
    m.focusCell(13);
    const reachable = buttons(m).filter((b) => b.tabIndex === 0);
    expect(reachable).toHaveLength(1);
    expect(reachable[0].dataset.cell).toBe('13');
  });
});

describe('[Right] the arrows walk the mat and stop at its edges', () => {
  it.each([
    ['right', 0, 1],
    ['down', 0, MAT_COLS],
    ['left', 1, 0],
    ['up', MAT_COLS, 0],
  ])('moves %s from %i to %i', (intent, from, to) => {
    expect(step(from, intent as string)).toBe(to);
  });

  it('clamps rather than wrapping at every edge', () => {
    // Wrapping teleports a player who was counting their way across, and gives them no way to
    // tell that they did anything at all.
    expect(step(0, 'left')).toBe(0);
    expect(step(0, 'up')).toBe(0);
    expect(step(MAT_COLS - 1, 'right')).toBe(MAT_COLS - 1);
    expect(step(MAT_CELLS - 1, 'down')).toBe(MAT_CELLS - 1);
    expect(step(MAT_CELLS - 1, 'right')).toBe(MAT_CELLS - 1);
  });

  it('never leaves the mat, from anywhere, in any direction', () => {
    for (let cell = 0; cell < MAT_CELLS; cell++) {
      for (const intent of ['up', 'down', 'left', 'right']) {
        const to = step(cell, intent);
        expect(to).toBeGreaterThanOrEqual(0);
        expect(to).toBeLessThan(MAT_CELLS);
      }
    }
  });

  it('moves focus and the cursor together on a real key press', () => {
    const { m, onCursor } = mirror();
    buttons(m)[0].focus();
    buttons(m)[0].dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    expect(m.cursor()).toBe(1);
    expect(document.activeElement).toBe(buttons(m)[1]);
    expect(onCursor).toHaveBeenCalledWith(1);
  });

  it('ignores a key that is not a direction', () => {
    const { m } = mirror();
    buttons(m)[3].focus();
    buttons(m)[3].dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
    expect(m.cursor()).toBe(0);
  });

  it('lets a non-movement intent through to whoever else is listening', () => {
    // ⚠️ THE SONAR LIVES ON ONE OF THESE. The engine puts blind navigation on the `especial`
    // action, and this grid is bound to the cells the player is standing on. Swallowing an intent
    // it does not use — calling preventDefault on it — would silently disable the sonar key for
    // exactly the player who most depends on it. Not moving the cursor is not enough; the event
    // has to stay usable.
    const declaration: MirrorDeclaration = createWhackDeclaration({
      view: () => ({ category: EVEN, tiles: TILES, hits: 0, focus: null }),
      t: echo,
    });
    const m = createGridMirror({
      doc: document,
      declaration,
      t: echo,
      onActivate: vi.fn(),
      resolveAction: (code) => (code === 'KeyS' ? 'especial' : null),
    });
    document.body.appendChild(m.root);
    made.push(m);

    const cells = buttons(m);
    cells[3].focus();
    const event = new KeyboardEvent('keydown', { code: 'KeyS', bubbles: true, cancelable: true });
    cells[3].dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(m.cursor()).toBe(0);
  });

  it('DOES swallow a direction, so the page does not scroll under the player', () => {
    const { m } = mirror();
    const cells = buttons(m);
    cells[0].focus();
    const event = new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true, cancelable: true });
    cells[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('takes a remapped intent from the engine when one is supplied', () => {
    // The engine's keyboard runtime is remappable and saved. A grid that only listened for
    // ArrowRight would ignore the remapping a child depends on.
    const declaration: MirrorDeclaration = createWhackDeclaration({
      view: () => ({ category: EVEN, tiles: TILES, hits: 0, focus: null }),
      t: echo,
    });
    const m = createGridMirror({
      doc: document,
      declaration,
      t: echo,
      onActivate: vi.fn(),
      resolveAction: (code) => (code === 'KeyD' ? 'right' : null),
    });
    document.body.appendChild(m.root);
    made.push(m);
    const cells = buttons(m);
    cells[0].focus();
    cells[0].dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }));
    expect(m.cursor()).toBe(1);
  });
});

describe('[Right] the hammer works on a REMAPPED key, and only once', () => {
  it('activates the cell under the cursor when action1 arrives on another key', () => {
    // ⚠️ The engine's keyboard is remappable and saved. A grid that only listened for Enter
    // would ignore the remapping a child depends on -- and this game's whole verb is that one
    // button, so ignoring it is ignoring the game.
    const declaration: MirrorDeclaration = createWhackDeclaration({
      view: () => ({ category: EVEN, tiles: TILES, hits: 0, focus: null }),
      t: echo,
    });
    const onActivate = vi.fn();
    const m = createGridMirror({
      doc: document, declaration, t: echo, onActivate,
      resolveAction: (code) => (code === 'KeyJ' ? 'action1' : null),
    });
    document.body.appendChild(m.root);
    made.push(m);

    const cells = buttons(m);
    cells[7].focus();
    const event = new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true, cancelable: true });
    cells[7].dispatchEvent(event);

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith(7);
    // Swallowed, or the key also does whatever the browser had planned for it.
    expect(event.defaultPrevented).toBe(true);
  });

  it('does NOT fire twice when action1 is bound to Enter', () => {
    // ⚠️ THE ASSERTION THE GUARD EXISTS FOR. On a real `<button>` the platform turns Enter
    // into a click by itself; handling it here as well would hammer the tile twice on one press,
    // which in this game means scoring a hit and then a mistake on a tile that is already gone.
    const declaration: MirrorDeclaration = createWhackDeclaration({
      view: () => ({ category: EVEN, tiles: TILES, hits: 0, focus: null }),
      t: echo,
    });
    const onActivate = vi.fn();
    const m = createGridMirror({
      doc: document, declaration, t: echo, onActivate,
      resolveAction: (code) => (code === 'Enter' ? 'action1' : null),
    });
    document.body.appendChild(m.root);
    made.push(m);

    const cells = buttons(m);
    cells[0].focus();
    // The real sequence a browser delivers: keydown, then the activation click.
    cells[0].dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true, cancelable: true }));
    cells[0].click();

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('leaves the cursor where it was, because hammering is not moving', () => {
    const declaration: MirrorDeclaration = createWhackDeclaration({
      view: () => ({ category: EVEN, tiles: TILES, hits: 0, focus: null }),
      t: echo,
    });
    const m = createGridMirror({
      doc: document, declaration, t: echo, onActivate: vi.fn(),
      resolveAction: (code) => (code === 'KeyJ' ? 'action1' : null),
    });
    document.body.appendChild(m.root);
    made.push(m);

    // ⚠️ `focusCell`, not `cells[5].focus()`. Focusing the DOM node directly does NOT move the
    // mirror's cursor -- and that is not a defect: the roving tabindex leaves exactly one cell
    // tabbable, so nothing but this method and a click can put focus on another one. The first
    // draft of this test used the raw `.focus()` and read a cursor of 0, which was the honest
    // answer to a question nobody in the game ever asks.
    const cells = buttons(m);
    m.focusCell(5);
    expect(m.cursor()).toBe(5);
    cells[5].dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true, cancelable: true }));
    expect(m.cursor()).toBe(5);
  });
});

describe('[Right] pointer and keyboard end in the SAME funnel', () => {
  it('activates on a click', () => {
    const { m, onActivate } = mirror();
    buttons(m)[7].click();
    expect(onActivate).toHaveBeenCalledWith(7);
  });

  it('activates on Enter, through the platform rather than a handler', () => {
    const { m, onActivate } = mirror();
    const button = buttons(m)[7];
    button.focus();
    // A real Enter on a focused <button> produces a click. That is the whole reason for using a
    // button element, so the test drives it the way the platform does.
    button.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
    button.click();
    expect(onActivate).toHaveBeenCalledWith(7);
  });

  it('moves the cursor to whatever was clicked, so the two paths cannot diverge', () => {
    const { m } = mirror();
    buttons(m)[12].click();
    expect(m.cursor()).toBe(12);
  });
});

describe('[Right] the labels come from the declaration, not a second table', () => {
  it('names a lit tile by the value the declaration gives it', () => {
    const label = buttons(mirror().m)[0].getAttribute('aria-label')!;
    expect(label).toContain('content=4');
    expect(label).toContain('col=1');
    expect(label).toContain('row=1');
  });

  it('names the WRONG tile too', () => {
    // Silence on a wrong tile would tell a blind player which ones are correct by omission.
    expect(buttons(mirror().m)[7].getAttribute('aria-label')).toContain('content=7');
  });

  it('says an unlit tile is empty, in a translated word', () => {
    expect(buttons(mirror().m)[1].getAttribute('aria-label')).toContain('content=mat.empty');
  });

  it('counts columns and rows from one, the way a person says them', () => {
    const label = buttons(mirror().m)[MAT_COLS + 2].getAttribute('aria-label')!;
    expect(label).toContain('col=3');
    expect(label).toContain('row=2');
    expect(spotOfCell(MAT_COLS + 2)).toEqual({ x: 2, y: 1 });
  });

  it('re-labels when the mat changes', () => {
    // Built once and consulted for the life of the round: a mirror that kept the first labels
    // would read out a board that emptied minutes ago, with nothing to indicate it.
    const { m, setTiles } = mirror();
    setTiles([{ cell: 1, value: 16, correct: true, heat: 1 }]);
    m.refresh();
    expect(buttons(m)[1].getAttribute('aria-label')).toContain('content=16');
    expect(buttons(m)[0].getAttribute('aria-label')).toContain('content=mat.empty');
  });
});

describe('[Right] state travels as ARIA, not as a word in the label', () => {
  it('marks an unlit tile dimmed and a lit one not', () => {
    // `aria-disabled` lets the reader say "dimmed" in the user's own language; a word in the
    // label would say it in whichever language this catalogue happens to carry.
    const cells = buttons(mirror().m);
    expect(cells[0].getAttribute('aria-disabled')).toBe('false');
    expect(cells[1].getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps an unlit tile FOCUSABLE, because exploring the mat is how it is learnt', () => {
    const { m } = mirror();
    const idle = buttons(m)[1];
    expect(idle.disabled).toBe(false);
    m.focusCell(1);
    expect(document.activeElement).toBe(idle);
  });

  it('carries the role so a stylesheet can colour-block without re-deriving it', () => {
    const cells = buttons(mirror().m);
    expect(cells[0].dataset.role).toBe('goal');
    expect(cells[7].dataset.role).toBe('hazard');
    expect(cells[1].dataset.role).toBe('free');
  });
});

describe('[Zero] with an empty mat, it is still navigable', () => {
  it('labels every cell empty and stays focusable', () => {
    const { m } = mirror({ tiles: [] });
    for (const button of buttons(m)) {
      expect(button.getAttribute('aria-label')).toContain('content=mat.empty');
      expect(button.disabled).toBe(false);
    }
    m.focusCell(9);
    expect(m.cursor()).toBe(9);
  });
});
