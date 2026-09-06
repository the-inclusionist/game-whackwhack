// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main — the composition root. The only file that knows every other one exists.
//
// ========================= WHAT IT OWNS, AND WHY IT IS THE ONLY ONE =========================
// Everything below is a wiring decision that no single module could make for itself: which scene
// follows which, where the frame clock comes from, that a mistake is `srSay` and the end of a round
// is `srAlert`, and that a frame delta measured in FRAMES becomes milliseconds before it reaches
// the rules. Each of those is a fact about this GAME rather than about any of its parts.
//
// ========================= THE HOLE THIS FILE USED TO HAVE =========================
// ⚠️ There was no title and no result screen, and that was not a missing feature — it was a game
// that stopped after about thirty seconds and said nothing. Three missed waves ends a round in
// `lives` mode; the mat then sat empty forever with no button on the page and no way back except
// reloading. Every module was tested and the hole was BETWEEN them: "what happens after the round
// ends" belongs to no module, so no module's tests asked.
//
// The engine's scene stack is the thing that was going unused. It is used now, and the three
// scenes it holds are the whole shape of the game.

import { createGame } from '@the-inclusionist/engine';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { rnd } from '@the-inclusionist/engine/core/rng.js';

import { CATEGORIES } from '../rules/category.ts';
import { LIVES } from '../rules/defeat.ts';
import { ROUND_GOAL } from '../rules/difficulty.ts';
import { createRound, type Round, type RoundEvent } from '../rules/round.ts';
import { spotOfCell } from '../rules/grid.ts';
import { createWhackDeclaration } from '../declaration/whack-declaration.ts';
import { createFrameTicker } from '../render/frame-ticker.ts';
import { createMat } from '../render/mat.ts';
import { stampGlyphs } from '../render/glyph-pass.ts';
import { pickTopmost, toIllustrationSpace } from '../render/picking.ts';
import { createCamera, type NudgeDirection } from '../render/camera.ts';
import { createFades } from '../render/fade.ts';
import { createZdogStage } from '../render/zdog-stage.ts';
import { createGridMirror } from '../ui/grid-mirror.ts';
import { announcementFor } from '../ui/announce.ts';
import { createHud } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import { createOptions, type RoundChoice } from '../ui/options.ts';
import { createResultScreen, createTitleScreen, type Screen } from '../ui/screens.ts';
import { createI18n, preferredLocale } from '../i18n/index.ts';

/**
 * ⚠️ FRAMES TO MILLISECONDS, and this is the only place the conversion happens.
 *
 * `startLoop` hands out `deltaTime` in FRAMES — PixiJS's convention, which the engine inherited and
 * its animation module is written against — while `rules/round` deals in milliseconds so the
 * original game's timing curve can be stated and asserted in the units it was written in.
 */
const FRAME_MS = 1000 / 60;

function boot(): void {
  const doc = document;
  // Narrowed once into a const the closures below can see: TypeScript's narrowing of a `let` does
  // not survive into a function body, and every screen transition touches this element.
  const found = doc.getElementById('game-region');
  if (!found) throw new Error('boot: #game-region is missing');
  const region: HTMLElement = found;

  // 1. LANGUAGE FIRST. Nothing that carries a word may be built before the locale is known.
  const i18n = createI18n(preferredLocale(navigator.language));
  doc.documentElement.lang = i18n.bcp47();
  // ⚠️ The name carries a NEWLINE so the title screen can set it in two lines. A tab title wants
  // it on one, and normalising here beats a second catalogue entry that could drift from the
  // first — two spellings of a game's own name is exactly the kind of thing nobody notices.
  doc.title = i18n.t('game.title').replace(/\s+/g, ' ');

  let choice: RoundChoice = { category: CATEGORIES[0], difficulty: 'medium', defeat: 'lives' };
  let round: Round | null = null;
  let screen: Screen | null = null;

  // The declaration is built ONCE and reads through the variables above, so a new round does not
  // need a new declaration — and the engine, which was handed this object at boot, never sees a
  // stale one. Before the first round there is no round to ask, and the stand-in is an EMPTY mat
  // — which the contract already treats as "nothing to aim at", so the title and result screens
  // are conformant states rather than special cases.
  const declaration = createWhackDeclaration({
    view: () => round?.view() ?? { category: choice.category, tiles: [], hits: 0, focus: null },
    t: (key) => i18n.t(key),
  });

  const engine = createGame({
    declaration,
    host: { doc, win: window, cvdHost: doc.getElementById('cvd') },
    // There IS no pause menu: the title and result screens are the only two places the game
    // stops, and both are reachable without one. Declared rather than inferred from a null.
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
    // Menus are navigable exactly when a screen is up, which is the boolean the engine asked for
    // instead of a phase name — the correction the quiz consumer forced.
    isNavigable: () => screen !== null,
  });
  if (engine.problems.length) console.warn('engine:', engine.problems.join('; '));

  // 2. THE PICTURE. Built once and reused across rounds; only the lit set changes.
  const stage = createZdogStage();
  const mat = createMat(stage.root);
  const canvas = stage.canvas;
  canvas.id = 'board-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  region.appendChild(canvas);

  const mirror = createGridMirror({
    doc,
    declaration,
    t: (key, params) => i18n.t(key, params),
    onActivate: (cell) => { if (round) handle(round.hit(cell)); },
    onCursor: (cell) => { round?.setFocus(spotOfCell(cell)); invalidate(); },
    resolveAction: (code) => engine.keyboard.actionOf(code, 0),
  });
  region.insertBefore(mirror.root, canvas);

  /**
   * ⚠️ THE CHOICES ARE PART OF THE HUD, NOT PART OF THE TITLE. They were three `<select>`s on the
   * title card, then the same three folded into a `<details>`, and both were rejected: "nada de
   * menu desta forma, mas sim no próprio HUD antes de começar". The panel is built once here and
   * lives in the column for the whole session, which is also why `startRound` reads it rather
   * than being handed a choice — there is no moment when the current choice is anywhere else.
   */
  const options = createOptions({
    doc,
    i18n,
    initial: choice,
    // Kept in `choice` as it changes rather than only at start, so the HUD's own readouts (which
    // are drawn from the DECLARATION, which reads `choice`) show the category being picked.
    onChange: (next) => { choice = next; hud.setDefeat(next.defeat); hud.refresh(); },
  });

  const hud = createHud({
    doc,
    declaration,
    options: options.root,
    i18n,
    defeat: choice.defeat,
    livesLeft: () => (choice.defeat === 'lives' ? Math.max(0, LIVES - (round?.errors() ?? 0)) : null),
    level: () => round?.level() ?? 1,
  });
  region.appendChild(hud.root);

  // 3. WHAT THE ROUND SAYS OUT LOUD. The sentences live in `ui/announce`, which is pure and tested;
  //    what is left here is the wiring — urgent to the assertive region, everything else polite.
  function announce(event: RoundEvent): void {
    const said = announcementFor(event, {
      i18n,
      collecting: declaration.objectiveOf(0).name.text,
      hits: round?.hits() ?? 0,
    });
    if (said) (said.urgent ? srAlert : srSay)(said.text);
  }

  // Reduced motion maps to a duration of ZERO, which makes every fade already finished: the tile
  // is simply gone. The preference is arithmetic here rather than a second code path that rots.
  const fades = createFades({
    durationMs: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : undefined,
  });

  let dirty = true;
  function invalidate(): void { dirty = true; }

  function handle(events: readonly RoundEvent[]): void {
    for (const event of events) {
      announce(event);
      // A tile leaves the mat for one of three reasons, and all three earn the same exit: hit,
      // hit wrongly, or left to expire. Only the SCORE distinguishes them; the disappearance is
      // the same event to look at, and giving them different exits would be inventing a
      // distinction the player has to learn on top of the one that matters.
      if (event.kind === 'hit' || event.kind === 'mistake') {
        fades.start(event.cell, String(event.value), performance.now());
      }
    }
    if (events.length === 0) return;
    mirror.refresh();
    hud.refresh();
    invalidate();
    const over = events.find((e) => e.kind === 'over');
    if (over && over.kind === 'over') showResult(over.outcome);
  }

  // 4. THE SCREENS. Each one mounts on `enter` and unmounts on `exit`, so the scene stack is the
  //    single answer to "what is on screen" rather than a second flag kept beside it.
  function mount(next: Screen): void {
    screen?.destroy();
    screen = next;
    // ⚠️ `inert` on the region behind. Without it a reader tabs off the dialog into twenty mat
    // buttons that cannot be played, and the reading order says the game is still going.
    // ⚠️ WHAT GOES INERT DEPENDS ON THE SCREEN, and that is the whole reason the options can be
    // in the HUD at all. The result screen kills the region: there is a finished board behind it
    // and nothing there is playable. The title kills only the MAT and its mirror — genuinely
    // inoperable, because no round exists — and leaves the HUD column live, because the column is
    // where the round is configured. `region.inert` would have taken the controls with it.
    region.inert = next.modal;
    mirror.root.inert = true;
    canvas.inert = true;
    // Behind the RESULT screen the HUD repeats the score that screen exists to give. Behind the
    // title it shows the choices, which is the point.
    hud.root.hidden = next.modal;
    hud.setPhase('choosing');
    doc.body.appendChild(next.root);
    next.focus();
  }

  function unmount(): void {
    screen?.destroy();
    screen = null;
    region.inert = false;
    mirror.root.inert = false;
    canvas.inert = false;
    hud.root.hidden = false;
    hud.setPhase('playing');
  }

  function showTitle(): void {
    engine.cenas.replace({
      nome: 'title',
      enter: () => mount(createTitleScreen({
        doc, i18n, onStart: () => startRound(options.choice()),
      })),
      exit: unmount,
    });
  }

  function showResult(outcome: 'won' | 'lost'): void {
    const hits = round?.hits() ?? 0;
    const level = round?.level() ?? 1;
    engine.cenas.replace({
      nome: 'result',
      enter: () => mount(createResultScreen({
        doc, i18n, outcome, hits, level, need: ROUND_GOAL,
        onAgain: () => startRound(options.choice()),
        onChange: showTitle,
      })),
      exit: unmount,
    });
  }

  function startRound(next: RoundChoice): void {
    choice = next;
    round = createRound({
      category: next.category,
      difficulty: next.difficulty,
      defeat: next.defeat,
      rnd,
    });
    fades.clear();
    engine.cenas.replace({ nome: 'playing', enter: unmount });
    hud.setDefeat(next.defeat);
    mirror.refresh();
    hud.refresh();
    invalidate();
  }

  // 5. THE PICTURE, ONCE PER FRAME THAT NEEDS ONE.
  //
  // ⚠️ Nothing here filters anything out any more, and that is the point of the model change. It
  // used to read a whole wave and skip the tiles marked `resolved`, and the bug that was reported
  // is what happens when a reader forgets: an answered tile stayed lit with its number on it, the
  // score went up and nothing moved. `round.tiles()` is only what is on the mat.
  function draw(): void {
    const live = round?.tiles() ?? [];
    const now = performance.now();

    mat.setLit(live.map((t) => t.cell));

    // ⚠️ THE COLOUR IS THE CLOCK, AND EACH TILE CARRIES ITS OWN. Height says a tile is in play;
    // cooling says for how much longer. It was one heat for the whole wave, which the independent
    // model makes meaningless — two tiles that arrived seconds apart do not share a countdown, and
    // reading one number for both would have shown a tile that had just lit as nearly spent.
    // The tile also settles as it cools, so the fact has a non-colour channel (WCAG 1.4.1).
    for (const tile of live) {
      // ⚠️ RAISE FIRST. `setRaise` also writes the colour — it has to, so a sinking tile cools back
      // to idle — so calling it after `setHeat` would throw the cooling away every frame.
      mat.setRaise(tile.cell, 0.75 + 0.25 * tile.heat);
      mat.setHeat(tile.cell, tile.heat);
    }

    // A tile that has just been answered sinks as its number fades, so the change is something a
    // child SEES happen rather than something they find already done.
    for (const leaving of fades.active(now)) mat.setRaise(leaving.cell, leaving.alpha);
    stage.render();

    // ⚠️ AFTER `stage.render()`, which updates the graph: the projected corners the glyphs sit on
    // are last frame's until it runs, and numbers one frame behind the mat look like a rendering
    // glitch while really being a sequencing bug.
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const quads = mat.quads();
    // The live numbers at full ink, then the ones on their way out at whatever is left of theirs.
    stampGlyphs(
      ctx,
      live.map((t) => ({ cell: t.cell, text: String(t.value) })),
      quads,
      stage.viewport(),
    );
    stampGlyphs(
      ctx,
      fades.active(now).map((f) => ({ cell: f.cell, text: f.text, alpha: f.alpha })),
      quads,
      stage.viewport(),
    );
  }

  // 6. THE POINTER. It ends in the same place the keyboard does.
  //
  // ⚠️ TWO EVENTS, DEDUPLICATED, and not belt-and-braces for its own sake. `pointerdown` is the
  // responsive one and is what a modern browser fires, but this game targets whatever is actually
  // in a public school — and a device or embedding that delivers only the legacy mouse sequence
  // would leave the mat looking alive and completely unresponsive, with nothing to diagnose from.
  // So `click` is a FALLBACK: it runs only when no `pointerdown` preceded it, which means a
  // browser that fires both still handles exactly one hit per tap.
  let lastPointerAt = -Infinity;
  const POINTER_WINDOW_MS = 700;

  function whackAt(clientX: number, clientY: number): void {
    if (!round || screen) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    // Client pixels to CANVAS pixels: the canvas is displayed at a whole multiple of its
    // resolution, so divide by that factor before inverting the projection.
    const scale = rect.width / canvas.width;
    const at = toIllustrationSpace(
      { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale },
      stage.viewport(),
    );
    const cell = pickTopmost(mat.quads(), at);
    if (cell !== null) handle(round.hit(cell));
  }

  canvas.addEventListener('pointerdown', (event: PointerEvent) => {
    lastPointerAt = event.timeStamp;
    whackAt(event.clientX, event.clientY);
  });

  canvas.addEventListener('click', (event: MouseEvent) => {
    if (event.timeStamp - lastPointerAt < POINTER_WINDOW_MS) return;
    whackAt(event.clientX, event.clientY);
  });

  // 7. THE CAMERA. Shift and an arrow leans the mat; Shift+Home puts it back square-on.
  const camera = createCamera();
  const CAMERA_KEYS: Readonly<Record<string, NudgeDirection>> = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  };
  region.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!event.shiftKey) return;
    if (event.code === 'Home') {
      event.preventDefault();
      applyCamera(camera.reset());
      return;
    }
    const direction = CAMERA_KEYS[event.code];
    if (!direction) return;
    event.preventDefault();
    applyCamera(camera.nudge(direction));
  });

  function applyCamera(state: { pitch: number; yaw: number }): void {
    stage.setCamera(state.pitch, state.yaw);
    invalidate();
  }

  /**
   * ========================= THE MAT LEANS TOWARDS THE POINTER =========================
   * The original's signature, restored — and ADDED to the keyboard nudge rather than replacing it.
   *
   * ⚠️ That distinction is the whole accessibility argument. The original tilts with `mousemove`
   * alone, which excludes a keyboard and a touch screen entirely; removing the tilt to satisfy
   * WCAG 2.5.7 was the mistake I made first, and it made the game poorer for everyone instead of
   * better for anyone. Two ways into one control is what the guideline actually asks for.
   *
   * The pointer sets the lean ABSOLUTELY — it is a position, not a gesture — so it does not
   * accumulate against the nudge; the last input to speak wins, which is what a hand expects.
   */
  const ball = doc.createElement('div');
  ball.className = 'pointer-ball';
  ball.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(ball);

  window.addEventListener('pointermove', (event: PointerEvent) => {
    // `transform` rather than left/top: it stays on the compositor and cannot force a layout on
    // every mouse move, which on school hardware is the difference between smooth and not.
    ball.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;

    // The mat is not the subject while the RESULT screen is up. Behind the title it is — the
    // original's board leans under the logo, and that lean is half of what the title screen is.
    if (screen?.modal) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // −1 … 1 across the canvas, clamped: a pointer outside it should lean no further than its edge.
    const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
    applyCamera(camera.point(-nx, -ny));
  });

  // 8. LAYOUT, and the resize that keeps the scale a whole number of physical pixels.
  applyLayout({ doc, win: window });
  window.addEventListener('resize', () => { applyLayout({ doc, win: window }); invalidate(); });

  // 9. THE LOOP.
  const ticker = createFrameTicker();
  startLoop(ticker, (dt: number) => {
    // Only the round gets time, and only while it is the top of the stack. A wave that expired
    // behind a result screen would charge a player for a mistake they were not allowed to make.
    if (round && !screen) handle(round.advance(dt * FRAME_MS));
    // A fade in progress is a reason to draw even when nothing else changed — the dirty flag is
    // about STATE, and an animation is state changing continuously. So is a wave's countdown: the
    // tiles cool every frame, and without this they would cool only when something else happened.
    if (fades.busy(performance.now()) || round?.tiles().length) invalidate();
    if (!dirty) return;
    dirty = false;
    draw();
  }, 2, {
    // ⚠️ The engine's own main.ts does not wire this, and it should. A frame that throws stops the
    // loop — which is right — but a blind child cannot see a frozen screen, so the stop is said.
    aoFalhar: (error: unknown) => {
      srAlert(i18n.t('say.crashed'));
      console.error('frame failed:', error);
    },
  });

  showTitle();

  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as Record<string, unknown>).__whack = {
      get round() { return round; },
      get screen() { return screen; },
      mat, stage, mirror, hud, options, i18n, engine, camera,
      start: (over: Partial<RoundChoice> = {}) => startRound({ ...choice, ...over }),
      step: (dt = 1) => ticker.step(dt),
    };
  }
}

boot();
