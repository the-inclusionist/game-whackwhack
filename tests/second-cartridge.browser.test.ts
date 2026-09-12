// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0139's third gate: two cartridges mounted in sequence leave exactly ONE accessibility bar.
//
// ========================= THE FAILURE THIS EXISTS TO CATCH =========================
// ⚠️ `createGame` MOUNTS THE PAGE. The accessibility bar, the pause card, the six colour-vision
// filters, the TTS, the sonar, the settings panel, the menu navigation and the keyboard runtime all
// come out of one call. A cartridge that made that call would give a platform six of each — six
// bars in the tab order, six keyboard runtimes competing for one document — and a bundler would
// report no extra bytes at all, because it is one module either way.
//
// 📌 SO THE COUNT IS THE MEASUREMENT. «One bar» is not tidiness: for a child navigating by keyboard
// a second bar is a second pass through eight controls before reaching the game, and for a screen
// reader it is eight duplicate names for the same eight things.
//
// ========================= WHY THIS COULD NOT BE WRITTEN UNTIL TODAY =========================
// It needs a SECOND cartridge, and there was no way to mount one: `boot()` used to start on import,
// then it called `createGame` itself, then it had no `teardown()`. The last of those closed this
// afternoon, and `Engine.mount()` — ADR-0142's decision, shipped in engine 9.0.0 — is the other
// half. This file mounts the same game twice, which is the honest local stand-in for two games:
// the question «does a second mount duplicate the page?» does not care whether they differ.
//
// ========================= WHAT IT FOUND ON ITS FIRST RUN =========================
// 🔴 THE PAGE'S ACCESSIBILITY BAR WENT WITH THE FIRST CARTRIDGE. `createGame` builds and fills it,
// ADR-0117 §2 says the page has ONE — and `ui/hud` appends it as the last entry of the game's own
// column, because the engine «cannot guess a stranger's layout». So `teardown()` removing the HUD
// destroyed it, and every cartridge after the first would have had no accessibility bar at all,
// with nothing anywhere saying why. Borrowing a node somebody else owns means handing it back.
//
// ⚠️ AND IT IS NOT A DUPLICATE OF `tests/teardown.browser.test.ts`. That file asks what a teardown
// LEAVES; this one asks what a second mount ADDS. A game could give its region back perfectly and
// still bring a second bar with it, and a game could mount cleanly twice while leaking listeners.

import { beforeAll, describe, expect, it } from 'vitest';
import indexHtml from '../app/index.html?raw';
import '../app/css/style.css';
import { boot, type RunningGame } from '../app/js/boot/main.ts';

/** The REAL markup, for the same reason the other browser files use it: a copy would drift. */
function scaffold(): void {
  const body = indexHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!body) throw new Error('second-cartridge: could not find a <body> in app/index.html');
  document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');
}

interface DebugHook {
  readonly engine: Parameters<typeof boot>[0]['engine'];
  readonly i18n: Parameters<typeof boot>[0]['i18n'];
  teardown(): void;
}
const debug = (): DebugHook => (window as unknown as { __whack: DebugHook }).__whack;

const region = (): HTMLElement => document.getElementById('game-region')!;
const wrap = (): HTMLElement => document.getElementById('stage-wrap')!;

/** How many of each page-level surface the document holds. One is the answer, always. */
function pageSurfaces(): Record<string, number> {
  return {
    a11yBars: document.querySelectorAll('#a11y-bar').length,
    a11yIcons: document.querySelectorAll('#a11y-bar .pi-btn').length,
    pauseCards: document.querySelectorAll('#vp-pause-0').length,
    cvdFilterHosts: document.querySelectorAll('#cvd').length,
    // The game's own, counted for the opposite reason: exactly one of each must come BACK.
    canvases: document.querySelectorAll('#board-canvas').length,
    mirrors: document.querySelectorAll('[role="grid"]').length,
    pointerBalls: document.querySelectorAll('.pointer-ball').length,
  };
}

const first: Record<string, number> = {};
const between: Record<string, number> = {};
const second: Record<string, number> = {};
let secondGame: RunningGame;
/**
 * The page's accessibility bar, held by IDENTITY from before the first teardown.
 *
 * 🔴 THIS REFERENCE IS THE POINT, AND IT IS WHAT THIS FILE FOUND. Between cartridges the bar is not
 * in the document — a cartridge decides WHERE it sits (`ui/hud` puts it last in the column) and
 * between games there is no game to say. So `querySelector('#a11y-bar')` answers null, correctly,
 * and a gate that counted the document would read «the page lost its bar» and «the page never had
 * one» as the same thing. The question is whether the ELEMENT survived, with its icons.
 */
let pageBar: HTMLElement;
const barIcons = { first: 0, between: 0, second: 0 };
const barConnected = { first: false, between: false, second: false };
/**
 * 🔴 WHERE THE BAR IS WHEN NO GAME HOLDS IT, and a mutation is why this is measured apart from
 * `barConnected`. Removing the hand-back from `teardown()` left every count above unchanged:
 * `removeChild` DETACHES rather than destroys, so the bar was still whole — inside the corpse of
 * the HUD — and the next `boot()` recovered it anyway, because `append` MOVES a node.
 *
 * ⚠️ The difference those counts cannot see is that a shell wanting to place the bar between
 * cartridges would have had to dig it out of a subtree the last cartridge left behind. Handing
 * something back means handing it back, not leaving it in the wreckage.
 */
const barParent = { between: 'unread' as string | null };

beforeAll(async () => {
  scaffold();
  history.replaceState(null, '', `${location.pathname}?debug=true`);
  // The shell boots cartridge ONE and, crucially, is the only thing that ever calls `createGame`.
  await import('../app/js/boot/standalone.ts');
  const found = document.getElementById('a11y-bar');
  if (!found) throw new Error('second-cartridge: the shell built no accessibility bar');
  pageBar = found;
  Object.assign(first, pageSurfaces());
  barIcons.first = pageBar.querySelectorAll('.pi-btn').length;
  barConnected.first = pageBar.isConnected;

  // ---- cartridge one leaves ----
  debug().teardown();
  debug().engine.unmount();
  Object.assign(between, pageSurfaces());
  barIcons.between = pageBar.querySelectorAll('.pi-btn').length;
  barConnected.between = pageBar.isConnected;
  barParent.between = pageBar.parentElement
    ? pageBar.parentElement.id || pageBar.parentElement.className
    : null;

  // ---- cartridge two arrives, into the SAME engine and with the SAME bar ----
  secondGame = boot({
    engine: debug().engine,
    a11yBar: pageBar,
    i18n: debug().i18n,
    region: wrap(),
    world: region(),
  });
  Object.assign(second, pageSurfaces());
  barIcons.second = pageBar.querySelectorAll('.pi-btn').length;
  barConnected.second = pageBar.isConnected;
});

describe('[Interface] ADR-0139 gate 3 — a second cartridge does not bring a second page', () => {
  it('the first cartridge got a page with one of everything', () => {
    // ⚠️ THE VACUITY GUARD. Every count below is «the same as the first», and a boot that mounted
    // nothing would satisfy all of them at zero.
    expect(first.a11yBars, 'no accessibility bar was mounted at all').toBe(1);
    expect(barConnected.first).toBe(true);
    expect(barIcons.first, 'the bar is empty, so counting it twice proves nothing')
      .toBeGreaterThan(4);
    expect(first.pauseCards).toBe(1);
    expect(first.canvases).toBe(1);
  });

  it('the page survives the first cartridge leaving', () => {
    /**
     * 📌 THE DIRECTION NOBODY EXPECTS TO FAIL, and it is half the gate. A cartridge that took the
     * accessibility bar down with it would pass a naive «is there only one?» check on the way back
     * up, because one is what you get after removing one and adding one. The page's surfaces belong
     * to the PAGE (ADR-0117 §2) and a cartridge leaving must not touch them.
     */
    expect(
      barIcons.between,
      'the cartridge destroyed the page\'s accessibility bar on its way out',
    ).toBe(barIcons.first);
    expect(
      barConnected.between,
      'the bar is still in the document with no game to place it — whose column is it in?',
    ).toBe(false);
    expect(
      barParent.between,
      'the bar was left inside something the cartridge created, for a shell to dig out',
    ).toBe(null);
    expect(between.pauseCards, 'the cartridge took the page\'s pause card with it').toBe(1);
    expect(between.cvdFilterHosts).toBe(1);

    // And its own things are gone, which is gate 4's business and is asserted here only so that
    // «the same count afterwards» below cannot be satisfied by nothing having left.
    expect(between.canvases, 'the first cartridge left its canvas behind').toBe(0);
    expect(between.pointerBalls).toBe(0);
  });

  it('the second cartridge adds no second page', () => {
    /**
     * ⚠️ THE GATE ITSELF, in four counts. Each of these is a surface `createGame` mounts, and each
     * would be duplicated by a cartridge that called it — which is exactly why
     * `tests/cartridge-boundary.node.test.ts` refuses the call in source. This is the same rule
     * measured by consequence rather than by reading: a source grep cannot see a duplicate that
     * arrives through some other door.
     */
    expect(second.a11yBars, 'a second accessibility bar — the child now tabs through two').toBe(1);
    expect(second.a11yIcons, 'the bar gained icons the second time round').toBe(first.a11yIcons);
    expect(barConnected.second, 'the second cartridge never placed the page\'s bar').toBe(true);
    expect(barIcons.second, 'the bar was rebuilt rather than reused').toBe(barIcons.first);
    expect(second.pauseCards, 'a second pause card').toBe(1);
    expect(second.cvdFilterHosts, 'a second set of colour-vision filters').toBe(1);
  });

  it('the second cartridge is a whole game, and not a ghost of one', () => {
    // ⚠️ THE OTHER HALF, and without it the case above passes for a `boot()` that did nothing. The
    // second game has to be as complete as the first — one canvas, one mirror, one ball, no more.
    expect(second.canvases, 'the second cartridge drew no board').toBe(1);
    expect(second.mirrors, 'the second cartridge built no screen-reader grid').toBe(1);
    expect(second.pointerBalls).toBe(1);
    expect(secondGame.isNavigable(), 'the second game answers nothing about itself')
      .toBeTypeOf('boolean');
  });

  it('and it can leave too, which is what makes a third possible', () => {
    secondGame.teardown();
    const after = pageSurfaces();
    expect(after.canvases, 'the second cartridge could not be removed').toBe(0);
    expect(after.pointerBalls).toBe(0);
    expect(pageBar.querySelectorAll('.pi-btn').length, 'the page lost its bar on the second exit')
      .toBe(barIcons.first);
  });
});
