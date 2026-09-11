// SPDX-License-Identifier: AGPL-3.0-or-later
// ADR-0139's fourth gate: a cartridge gives its region back the way it found it.
//
// ========================= WHY THIS IS ITS OWN FILE =========================
// It boots the whole game and then DESTROYS it, which is exactly what no other file in this suite
// can tolerate — `tests/a11y.browser.test.ts` boots once in `beforeAll` and every case after that
// reads the living document. Tearing down inside it would leave the rest of the file auditing a
// corpse, and passing, because an empty region has no violations.
//
// ========================= WHY IT COULD NOT BE WRITTEN BEFORE =========================
// ⚠️ THE GATE NEEDED TWO THINGS THAT ARRIVED ON DIFFERENT DAYS. The game needed a `teardown()`,
// which is the second half of ADR-0139's `GameInstance`; and the engine needed `unmount()`, which
// ADR-0142 decided and engine 9.0.0 shipped. Until both existed the question «what does a second
// cartridge inherit?» had no way of being asked at all.
//
// ========================= WHAT IT IS REALLY MEASURING =========================
// 📌 NOT TIDINESS. In the platform this region is handed to the NEXT game, and whatever the last
// one left behind arrives as that game's bug: a stale pointer listener that moves a ball which no
// longer exists, an `inert` flag on an element nobody can now tab into, twenty gridcell buttons a
// screen reader still finds and announces. The residue that matters is the residue nobody can see
// in a screenshot, which is why half of this file dispatches events rather than counting nodes.
//
// 🔴 AND IT FOUND ONE ON ITS FIRST RUN, which was not the one it was written for: the engine's own
// pause card lives INSIDE the cartridge's declared world. See `ENGINE_OWNED` below.
//
// ========================= ONE LIFE, MANY QUESTIONS =========================
// The whole arc — boot, play to a loss, tear down — happens once in `beforeAll`, and every case
// asks a different question about the same corpse. Doing it per case would boot six games into one
// document; doing it inside the first case would make every later one depend on its order.

import { beforeAll, describe, expect, it } from 'vitest';
import indexHtml from '../app/index.html?raw';
import '../app/css/style.css';

/** The REAL markup, for the same reason `a11y.browser.test.ts` uses it: a copy would drift. */
function scaffold(): void {
  const body = indexHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!body) throw new Error('teardown: could not find a <body> in app/index.html');
  document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');
}

const region = (): HTMLElement => document.getElementById('game-region')!;
const wrap = (): HTMLElement => document.getElementById('stage-wrap')!;

/**
 * ⚠️ THE ENGINE'S PAUSE CARD IS NOT THE CARTRIDGE'S NODE, and this file found that by failing.
 * `createGame` hangs `#vp-pause-0` at `host.pauseHost` or, by default, at `#game-region` — so a
 * game that gives back everything it created still leaves one child there, and the gate's own
 * words are «no node the CARTRIDGE created».
 *
 * 🔴 AND IT IS A CONTRACT FINDING RATHER THAN AN EXCEPTION TO WAVE THROUGH. ADR-0117 §2 says the
 * page has ONE pause card; ADR-0139 §4 says the region belongs to the cartridge. Those two put a
 * page-level surface inside one of six cartridges' declared worlds — so a platform shell that does
 * the obvious thing between games, `region.replaceChildren()`, destroys the pause for every game
 * after the first, and nothing says a word. The answer is `host.pauseHost` pointing somewhere the
 * page owns; that is the platform's call to make (ADR-0068 §5), not this repository's.
 *
 * 📌 Named by id rather than skipped by count: a second stray node would still fail this.
 */
const ENGINE_OWNED = new Set(['vp-pause-0']);
const leftInRegion = (): string[] =>
  [...region().children].map((e) => e.id || e.tagName).filter((id) => !ENGINE_OWNED.has(id));

/**
 * ⚠️ `#game-region` IS A CHILD OF `#stage-wrap`, which is the shape the two names hide: the region
 * this cartridge writes inside is the WRAP, and the world its declaration names is the integer-
 * scaled canvas box nested in it. So an empty wrap is not the right answer — the host's own element
 * has to still be there, and this file's first draft asserted a count of zero and failed on it.
 */
const HOST_OWNED = new Set(['game-region']);
const leftInWrap = (): string[] =>
  [...wrap().children].map((e) => e.id || e.className || e.tagName)
    .filter((id) => !HOST_OWNED.has(id));

interface DebugHook {
  readonly round: { tiles(): readonly { cell: number; correct: boolean }[] } | null;
  readonly engine: { cenas: { nomes(): readonly string[] } };
  start(over: { defeat: string }): void;
  step(dt?: number): void;
  /** The GAME's half of the teardown, alone. See the note beside it in `boot/main`. */
  teardown(): void;
}
const debug = (): DebugHook => (window as unknown as { __whack: DebugHook }).__whack;

/**
 * Drives the game to its RESULT screen — the only state in which the region behind is `inert`.
 *
 * 🔴 THIS EXISTS BECAUSE AN ASSERTION WAS VACUOUS AND A MUTATION SAID SO. The `inert` case below
 * asserted that a torn-down region can still be tabbed into, and it passed with `unmount()` deleted
 * from `teardown()` — because a boot ends on the TITLE screen, which is deliberately NOT modal
 * (`ui/screens` says why: there is no round behind it to protect anyone from). The flag was never
 * set, so clearing it proved nothing. Reaching the state is the difference between a gate and a
 * sentence.
 *
 * 📌 SUDDEN DEATH BECAUSE IT IS THE SHORTEST HONEST PATH: one wrong tile ends the round, so this
 * needs no waiting for a deadline to expire — only enough frames for a first wave to arrive.
 */
function playUntilLost(): void {
  debug().start({ defeat: 'sudden-death' });
  // ⚠️ A ROUND STARTS EMPTY. Tiles arrive on a clock — `tick: 'clock'` is this game's contract
  // answer — so a round asked for its tiles in the same breath as it was started reports none, and
  // the first version of this helper threw on exactly that.
  let wrong;
  for (let frame = 0; frame < 600 && !wrong; frame++) {
    debug().step(1);
    wrong = debug().round?.tiles().find((t) => !t.correct);
  }
  if (!wrong) throw new Error('teardown: no incorrect tile arrived in ten seconds of frames');
  const button = region().querySelector<HTMLElement>(`[data-cell="${wrong.cell}"]`);
  if (!button) throw new Error('teardown: the mirror has no button for the tile to hit');
  button.click();
}

/**
 * ================== THE TWO HALVES, READ SEPARATELY ==================
 * 🔴 A MUTATION FORCED THIS SHAPE. Deleting the game's own clean-up from `teardown()` changed
 * NOTHING observable, because the shell calls `engine.unmount()` immediately afterwards, that pops
 * the scene stack, and this game's scene `exit` is that same clean-up — the overlap ADR-0142
 * measured in this very file. One dispatch of `pagehide` therefore proves both halves at once and
 * neither half on its own.
 *
 * 📌 So the arc runs in two steps and is read three times: alive, after the GAME's teardown alone,
 * and after the SHELL's `pagehide`. Each case below asks one question of one of those three.
 */
const alive = { inRegion: 0, inWrap: 0, regionInert: false, scenes: 0 };
const afterGame = { inRegion: [] as string[], inWrap: [] as string[], inert: false, scenes: 0 };
const afterGameProbe = { regionW: '', ballTransform: '' };
const afterShell = { scenes: 0 };
/** The pointer ball, kept from before the teardown — afterwards there is no way to find it. */
let ball: HTMLElement;
/** The host elements, kept by identity: the cartridge must not have replaced them. */
let hostRegion: HTMLElement;
let hostWrap: HTMLElement;

beforeAll(async () => {
  scaffold();
  // The debug hook is read off `location.search` at import time, so this has to come first.
  history.replaceState(null, '', `${location.pathname}?debug=true`);
  // The SHELL, not the game — this file is about what a shell can hand to the next cartridge, and
  // the shell is the thing that owns both halves of the answer.
  await import('../app/js/boot/standalone.ts');

  playUntilLost();

  alive.inRegion = leftInRegion().length;
  alive.inWrap = leftInWrap().length;
  alive.regionInert = region().inert;
  alive.scenes = debug().engine.cenas.nomes().length;
  hostRegion = region();
  hostWrap = wrap();

  const found = wrap().querySelector<HTMLElement>('.pointer-ball');
  if (!found) throw new Error('teardown: the pointer ball is not where this file expects it');
  ball = found;

  // Cleared so that a surviving listener has something to rewrite, and the case below can tell.
  wrap().style.removeProperty('--region-w');
  ball.style.transform = 'none';

  // ---- STEP ONE: the GAME's half, with no shell involved ----
  debug().teardown();
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: 321, clientY: 123 }));
  region().dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', shiftKey: true }));
  afterGame.inRegion = leftInRegion();
  afterGame.inWrap = leftInWrap();
  afterGame.inert = region().inert;
  afterGame.scenes = debug().engine.cenas.nomes().length;
  afterGameProbe.regionW = wrap().style.getPropertyValue('--region-w');
  afterGameProbe.ballTransform = ball.style.transform;

  // ---- STEP TWO: the SHELL's half ----
  window.dispatchEvent(new PageTransitionEvent('pagehide'));
  afterShell.scenes = debug().engine.cenas.nomes().length;
});

describe('[Interface] ADR-0139 gate 4 — the region comes back the way it was handed over', () => {
  it('had something to give back in the first place', () => {
    // ⚠️ THE HALF THAT KEEPS THE REST HONEST. Every assertion below is satisfied by a game that
    // never built anything, and a boot that silently failed would pass this file top to bottom.
    // The canvas, the mirror, the HUD and the feedback layer are four children of the world; the
    // pointer ball and the result screen are two of the region. Both counts already exclude what
    // the engine and the host own, so they count only this game's own work.
    expect(alive.inRegion, 'the game built nothing in its world, so there is nothing to prove')
      .toBeGreaterThanOrEqual(4);
    expect(alive.inWrap, 'the game built nothing in its region').toBeGreaterThanOrEqual(2);
    expect(alive.regionInert, 'the game never reached the state the inert case measures').toBe(true);
    expect(alive.scenes, 'the engine held no scene, so the shell half proves nothing').toBeGreaterThan(0);
  });

  it('leaves no node of its own behind', () => {
    // 📌 THE HOST ELEMENTS THEMSELVES SURVIVE, and that is the point rather than an exception: the
    // shell handed them over, so removing them would be the cartridge reaching further on the way
    // out than it ever reached while running.
    expect(document.getElementById('game-region'), "the cartridge removed the host's own element")
      .toBe(hostRegion);
    expect(document.getElementById('stage-wrap')).toBe(hostWrap);

    // ⚠️ READ AFTER THE GAME'S OWN `teardown()` AND BEFORE THE SHELL'S, because `teardown()` has to
    // stand alone: a shell swapping cartridges calls `mount()`, which does not pop the scene stack.
    expect(afterGame.inRegion, 'nodes left in the world for the next cartridge').toEqual([]);
    expect(afterGame.inWrap, 'nodes left in the region for the next cartridge').toEqual([]);
  });

  it('leaves the host elements usable, and not merely empty', () => {
    /**
     * ⚠️ `inert` IS THE RESIDUE A NODE COUNT CANNOT SEE, and it is why `beforeAll` plays a whole
     * round first. The game sets it on the region behind the RESULT screen — correctly, so a reader
     * cannot tab into twenty tiles of a finished board — and an empty region that is still `inert`
     * arrives at the next cartridge as a region nothing can be focused inside. Nothing about that
     * looks wrong; it just does not work.
     */
    expect(afterGame.inert, 'the region is still inert, so the next cartridge cannot be tabbed into')
      .toBe(false);
    expect(wrap().inert).toBeFalsy();
  });

  it('stops listening to the window, which is where the invisible residue lives', () => {
    /**
     * ⚠️ THE CASE THAT MADE THIS FILE WORTH WRITING, AND ITS FIRST DRAFT WAS VACUOUS TOO. Nodes are
     * visible; listeners are not. This game registers `pointermove` and `resize` on the WINDOW and
     * `keydown` on the region — none of them inside anything a shell can empty.
     *
     * 🔴 THE FIRST VERSION ASSERTED `not.toThrow()`, WHICH A SURVIVING LISTENER SATISFIES. Setting
     * `.style.transform` on a detached node is perfectly legal, and `applyLayout` against a wrap
     * that still exists computes happily. So this measures the WRITE instead: `--region-w` was
     * cleared before the teardown, and a live `resize` handler puts it back.
     */
    expect(
      afterGameProbe.regionW,
      'a resize listener survived teardown and laid out a canvas that has no parent',
    ).toBe('');
    expect(
      afterGameProbe.ballTransform,
      'a pointermove listener survived teardown and still moves a ball nobody can see',
    ).toBe('none');

    // And nothing came BACK, which is the other direction: a live listener that re-mounts is worse
    // than one that only writes.
    expect(afterGame.inRegion).toEqual([]);
    expect(afterGame.inWrap).toEqual([]);
  });

  it('needs the SHELL to empty the engine, which the game cannot do for itself', () => {
    /**
     * ⚠️ THE HALF NO COUNT OF THE GAME'S OWN NODES CAN SEE. `engine.unmount()` clears what the
     * ENGINE registered for this cartridge — the two keyboard registries, the reach notice, and the
     * scene stack. Measured here through the stack, because the other two are not observable from a
     * consumer: the live key scheme does not change (the registry it clears is what «restore
     * defaults» reads) and `alcance` recomputes from a cartridge that is still there.
     *
     * 📌 A stale scene is not cosmetic. `mount()` does NOT pop the stack, so the next cartridge on
     * the page inherits this game's title scene — and the first `pop()` it triggers would run THIS
     * game's `exit()` against a region that now belongs to somebody else.
     */
    expect(afterGame.scenes, 'the game emptied the engine, which is not its to empty')
      .toBe(alive.scenes);
    expect(afterShell.scenes, 'the shell left the engine holding this cartridge\'s scenes').toBe(0);
  });

  it('can be torn down twice, because a shell that retries must not be what breaks', () => {
    // A game that already threw is exactly the game a shell most wants to tear down, and a
    // `teardown()` that only works once turns one failure into two. The shell deliberately does
    // NOT register `pagehide` with `{ once: true }`, so this reaches the real guard.
    expect(() => window.dispatchEvent(new PageTransitionEvent('pagehide'))).not.toThrow();
    expect(leftInRegion()).toEqual([]);
  });
});
