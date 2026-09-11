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

import type { Engine } from '@the-inclusionist/engine';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { createRng } from '@the-inclusionist/engine/core/rng.js';

import { CATEGORIES } from '../rules/category.ts';
import { comboKeyFor } from '../rules/combo.ts';
import { LIVES } from '../rules/defeat.ts';
import { PACE_DEFAULT, ROUND_GOAL } from '../rules/difficulty.ts';
import { createRound, type Round, type RoundEvent } from '../rules/round.ts';
import { spotOfCell } from '../rules/grid.ts';
import {
  createWhackDeclaration, type RoundView,
} from '../declaration/whack-declaration.ts';
import { PAUSE } from '../input/actions.ts';
import type { I18n } from '../i18n/index.ts';
import { createMat } from '../render/mat.ts';
import { stampGlyphs } from '../render/glyph-pass.ts';
import { pickTopmost, toIllustrationSpace } from '../render/picking.ts';
import { createCamera, type NudgeDirection } from '../render/camera.ts';
import { createFades } from '../render/fade.ts';
import { CAMERA, createZdogStage } from '../render/zdog-stage.ts';
import { GLYPH_FAMILY, GLYPH_HEIGHT, fontSizeFor } from '../render/glyph.ts';
import { createGridMirror } from '../ui/grid-mirror.ts';
import { announcementFor } from '../ui/announce.ts';
import { createFeedback } from '../ui/feedback.ts';
import { createHud } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import { createOptions, type RoundChoice } from '../ui/options.ts';
import { createResultScreen, createTitleScreen, type Screen } from '../ui/screens.ts';
import { readHighScore, recordHighScore } from '../store/high-score.ts';

/**
 * ⚠️ FRAMES TO MILLISECONDS, and this is the only place the conversion happens.
 *
 * `startLoop` hands out `deltaTime` in FRAMES — PixiJS's convention, which the engine inherited and
 * its animation module is written against — while `rules/round` deals in milliseconds so the
 * original game's timing curve can be stated and asserted in the units it was written in.
 */
const FRAME_MS = 1000 / 60;

/**
 * ⚠️ EXPORTED, AND NOTHING CALLS IT HERE. This module used to end with a bare `boot()`, so
 * importing it started the game — and ADR-0139 §2 and spec D14 both forbid exactly that for a
 * cartridge. A module that boots on import cannot be one of six on a page: it cannot be
 * instantiated twice, it cannot be torn down, and whatever it did at import time already
 * happened before anybody decided it should.
 *
 * The call lives in `boot/standalone.ts` now, which is the shell. The platform will be a
 * different shell around the same function.
 *
 * 📌 THE SHAPE ADR-0139 ASKS FOR IS `create(ctx): { update, teardown }`, and the four things that
 * stood between this and it are now three done and one left. It no longer boots on import, no
 * longer calls `createGame`, no longer finds its own document by id, and it gives the region back.
 * What is left is the NAME and the packaging — `slug`, `dicts`, `hooks` and a `ctx` in place of
 * `BootDeps` — and the last of those is not this repository's to invent (ADR-0068 §5).
 */
/**
 * What a shell gets back: ADR-0139's `GameInstance`, both halves of it since 2026-09-11. Named
 * rather than left as an anonymous object, so a shell can be typed against what it is promised.
 */
export interface RunningGame {
  /** ⚠️ `dt` in FRAMES, not seconds. */
  update(dt: number): void;
  /**
   * ⚠️ THE THREE BELOW EXIST BECAUSE THE ENGINE IS BUILT BEFORE THE GAME IS. `createGame` takes
   * a declaration and an `isNavigable` as VALUES, and both of this game's read live state that
   * does not exist until `boot()` has run. So the shell passes DELEGATING versions that forward
   * here once there is something to forward to — which is ADR-0139 §5's own mechanism, one
   * level down from the platform.
   *
   * 📌 AND IT IS WHY THE SHELL HOLDS THE ONLY MUTABLE POINTER. Spec D14 forbids module state in
   * a CARTRIDGE; the shell is not one, and something has to know which instance is current.
   */
  view(): RoundView;
  isNavigable(): boolean;
  pauseKey(event: KeyboardEvent): void;
  /**
   * WHAT EACH ITEM OF THE PAUSE CARD DOES IN THIS GAME — the engine actions three by itself
   * (`options`, `pmback`, `acessibilidade`) and hides every other that answers nothing, which is
   * ADR-0106 §5's rule against a dead button.
   *
   * ⚠️ A FUNCTION AND NOT A VALUE, and the engine's own note says why: a game's table changes
   * during a match — a «leave» that only lights up after the first phase — and freezing it at boot
   * already broke a case inside `ui/pause-icons`.
   */
  pauseActs(): Record<string, (() => void) | undefined>;
  /**
   * GIVES THE REGION BACK THE WAY IT WAS FOUND — ADR-0139's fourth gate, and the half of the
   * cartridge shape that was missing until now.
   *
   * ⚠️ TWO KINDS OF RESIDUE, AND THE SECOND IS THE DANGEROUS ONE. Nodes are visible: empty the
   * region and you can SEE what is left. Listeners are not — this game registers on `window` for
   * the pointer and the resize, and on the region for the camera keys, and none of those three
   * live inside anything a shell can empty. Two cartridges mounted in sequence would leave the
   * first one still moving a pointer ball that no longer exists.
   *
   * 📌 IDEMPOTENT ON PURPOSE. A shell that tears down twice — or tears down a game that already
   * crashed — must not be the thing that throws.
   */
  teardown(): void;
}

/** What a shell hands the game. The host half of `CreateGameOptions` never appears here. */
export interface BootDeps {
  /** Exactly what `createGame` returned. The game never calls it — ADR-0139 §2. */
  readonly engine: Engine;
  /** Already built and already filled by the engine; the HUD only decides where it sits. */
  readonly a11yBar: HTMLElement;
  readonly i18n: I18n;
  /**
   * THE ELEMENT THIS GAME MAY WRITE INSIDE, and nothing outside it (ADR-0139 §4).
   *
   * 📏 Measured: it is `#stage-wrap`. It fills the viewport, so a `.screen` inside it at
   * `inset: 0` keeps the box it had as `position: fixed`, and `#game-region` could not host the
   * screens because it is the integer-scaled canvas box and a title has to cover more than the mat.
   */
  readonly region: HTMLElement;
  /**
   * ⚠️ THE SECOND ELEMENT, AND THE CONTRACT ONLY NAMES ONE — which is a hole worth reporting
   * rather than papering over.
   *
   * `GameCtx` gives a cartridge exactly one `region`. But this game's `world()` answers
   * `#game-region`, and `createGame` RESOLVES that selector at boot — before any cartridge
   * exists — to decide whether to push a line into `problems` (ADR-0142 §2 lists it at :120).
   * So the element the world names cannot be one the cartridge creates: it has to be there
   * already, which makes it the host's, which makes it a second element in `ctx`.
   *
   * 📌 Either the contract grows a second member, or `world()` has to name the region it was
   * given rather than a fixed selector. Neither is this repository's to decide (ADR-0068 §5),
   * and inventing one here would invent it for six.
   */
  readonly world: HTMLElement;
}

export function boot(deps: BootDeps): RunningGame {
  // ⚠️ HANDED IN, NOT LOOKED UP. Two `getElementById` calls stood here until 2026-09-11, and a
  // cartridge that reaches into the document by id is a cartridge that only works inside a page it
  // wrote itself — in a platform the ids belong to five other games as much as to this one. The
  // narrowing they needed goes away with them: a parameter is already non-null.
  const { engine, a11yBar, i18n, world, region: stageWrap } = deps;
  /** The integer-scaled canvas box — the element `declaration.world()` names. */
  const region: HTMLElement = world;

  /**
   * ================== EVERYTHING THIS GAME WILL HAVE TO GIVE BACK ==================
   * ⚠️ COLLECTED AT THE POINT OF CREATION, not remembered at the point of deletion. A `teardown()`
   * written as a list of things to undo is a list that goes out of date the next time somebody
   * appends a node — silently, and only in the platform, where a second cartridge inherits what
   * the first forgot. Wrapping the creation is what makes forgetting hard.
   *
   * 📌 `AbortController` FOR THE LISTENERS because it is one revocation for all of them, present
   * and future: a new `addEventListener` that omits the signal is a visible omission at the call
   * site, whereas a missing line in a teardown function is invisible everywhere.
   */
  const life = new AbortController();
  const { signal } = life;
  /** Nodes this game put into elements it does not own. Removed in reverse, like a stack. */
  const planted: Node[] = [];
  function plant<T extends Node>(node: T): T {
    planted.push(node);
    return node;
  }
  // ⚠️ STILL GLOBAL, and still the host's: `document` and `window`. They are the last two
  // reaches past the region, and the contract's `ctx` is where they belong — not in a lookup
  // invented here for six repositories (ADR-0068 §5).
  const doc = region.ownerDocument;

  // 1. LANGUAGE FIRST. Nothing that carries a word may be built before the locale is known.
  // ⚠️ RESOLVED BY THE SHELL NOW, and handed in. The engine needs the locale before the game
  // exists — `createGame` writes the accessibility bar's labels — so whoever calls `createGame`
  // has to know it first. `doc.documentElement.lang` went with it: in a platform the document's
  // language belongs to the platform, not to one of six cartridges.
  // ⚠️ The name carries a NEWLINE so the title screen can set it in two lines. A tab title wants
  // it on one, and normalising here beats a second catalogue entry that could drift from the
  // first — two spellings of a game's own name is exactly the kind of thing nobody notices.
  doc.title = i18n.t('game.title').replace(/\s+/g, ' ');

  /**
   * ========================= THIS GAME'S OWN RANDOM STREAM =========================
   * 🔴 THIS LINE USED TO BE `import { rnd }`, AND ADR-0141 MEASURED IT HERE BY LINE NUMBER.
   *
   * `core/rng` exports two things that look identical at the import site: `createRng`, which returns
   * an INDEPENDENT stream, and `rnd` / `randInt` / `shuffle` / `reseed`, which are all bound to a
   * `const _padrao` at module scope — engine state, shared by every consumer in the page.
   *
   * ⚠️ IN A STANDALONE BUILD THAT IS HARMLESS, which is exactly why it survived: one game, one
   * stream, nothing to collide with, and every test here passes either way. Inside the platform two
   * cartridges drawing from `rnd` share ONE stream, so each one's draws depend on how much the other
   * drew, and a `reseed` in one repositions the other's underneath it. The failure is invisible where
   * the tests run and shows up as a game that is not reproducible for a reason nowhere in its code.
   *
   * 📌 THE ENGINE SOLVED THIS BEFORE ANYONE NEEDED IT. `createRng`'s own doc says of the stream it
   * returns: «Reposiciona ESTA corrente. Não alcança nenhuma outra.» The defect was never in the
   * engine — it was in the shorter import.
   *
   * ⚠️ AND THE SEED IS DELIBERATELY NOT CHOSEN HERE. ADR-0139 and ADR-0141 both leave the seed policy
   * open — who picks it, and whether a run is reproducible across shells — so this takes the engine's
   * default rather than inventing an answer for six repositories. When the cartridge factory arrives,
   * this line is replaced by `ctx.rng` and nothing else in this file moves.
   */
  const rng = createRng();

  let choice: RoundChoice = {
    category: CATEGORIES[0], difficulty: 'medium', defeat: 'lives', pace: PACE_DEFAULT,
  };
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

  /**
   * ========================= WHERE THE ACCESSIBILITY BAR LIVES =========================
   * Built here rather than in `index.html` because `createGame` fills it at boot and the HUD,
   * which is its home on screen, does not exist yet at that point. So the element is made first,
   * handed to the engine, and given to the HUD a few lines below to place.
   *
   * ⚠️ IT IS IN THE HUD COLUMN AND NOT UNDER THE STAGE, for the reason written over `hud.help`:
   * every pixel of height taken from `#stage-wrap` is height the integer upscale cannot use, and
   * at a 640x360 source a strip of 34 px once cost a WHOLE step. The HUD overlays the canvas, so
   * it is free — and it is reachable on the title screen, which is what the engine asks for: the
   * title screen is NOT modal (`region.inert` stays false), so a child reaches blind mode, TTS,
   * contrast and Libras before she starts rather than after she has already needed them.
   *
   * ⚠️ AND THE ID IS DELIBERATELY *NOT* `#title-icons`, which is the id the engine falls back to
   * when a game declares no host. Measured: the engine's own sheet carries
   * `#title-icons { position: absolute; top: 10px; left: 50%; transform: translateX(-50%) }` —
   * a header strip across the top of a stage, which is right for the platformer it was written
   * for and lands this game's bar on top of its difficulty cycler. Taking the fallback id would
   * be taking a LAYOUT with it. Declaring the host is what buys the right to place it.
   */
  // ⚠️ BUILT BY THE SHELL, because `createGame` fills it and `createGame` runs first. What is
  // left here is the HUD placing it, which is the half a host cannot decide for a stranger.
  void a11yBar;
  /**
   * ✅ THE COLOUR-VISION BUTTON IS THE ENGINE'S AGAIN, and this block used to be the reason it was not.
   *
   * Until engine 9.0.0, `createGame` decided whether the 🚥 icon exists by asking
   * `Boolean(ctx.setCorrecaoDoJogador)` — a writer it never passed and `CreateGameOptions` had no
   * field for — so no game booted through it had the icon. This game built the button by hand here
   * and kept the state in `ui/vision.ts`. Both are gone: 9.0.0 takes the writer, and the shell hands
   * it over with the seat it writes onto.
   *
   * 📌 WHAT WAS MEASURED FOR STAYS MEASURED FOR. `render/palette.ts` checked every colour in this
   * game under protanopia, deuteranopia and tritanopia, and `#cvd` still builds the six filters at
   * boot. The only thing that changed is that a child can now reach them through the engine's own
   * bar instead of through a button this game drew beside it.
   *
   * ⚠️ AND THE CONTRAST ICON IS STILL DELIBERATELY ABSENT (plan item A1b). `setTemaDoJogador` exists
   * now, but high contrast means REPAINTING the mat from the declared roles, not filtering it, and
   * `render/high-contrast` is written for the platformer. Handing over a writer that repaints
   * nothing would mount ADR-0106 §5's dead button — the exact defect this block once avoided.
   */

  /**
   * ⚠️ THE LISTENER IS THE SHELL'S AND THE DECISION IS THIS GAME'S, and the split is forced by
   * ORDER. `ui/menu-nav` registers on the window in CAPTURE and calls `stopPropagation()` on
   * Escape, so whoever wants the key first has to register before `createGame` — which now
   * happens before this function is ever called. The shell registers; this decides.
   */
  function pauseKey(event: KeyboardEvent): void {
    // ⚠️ THE ENGINE ANSWERS "WHICH POSITION IS THIS KEY", and asking it rather than comparing codes
    // is what makes a remapped pause work. A child who moved the pause to another key in the
    // settings screen moved it here too, and nothing in this file had to know.
    if (engine.keyboard.actionOf(event.code, 0) !== PAUSE) return;
    // Not during a screen: the title and the result are already stops, and a pause card over a
    // modal result would be two dialogs deep with one Escape between them.
    if (screen) return;
    if (paused && (engine.overlays.escapeTarget() || engine.overlays.topVisibleOverlay())) return;
    event.preventDefault();
    event.stopPropagation();
    setPaused(!paused);
  }

  // 2. THE PICTURE. Built once and reused across rounds; only the lit set changes.
  const stage = createZdogStage();
  const mat = createMat(stage.root);
  const canvas = stage.canvas;
  canvas.id = 'board-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  region.appendChild(plant(canvas));

  const mirror = createGridMirror({
    doc,
    declaration,
    t: (key, params) => i18n.t(key, params),
    onActivate: (cell) => { if (round) handle(round.hit(cell)); },
    onCursor: (cell) => { round?.setFocus(spotOfCell(cell)); invalidate(); },
    resolveAction: (code) => engine.keyboard.actionOf(code, 0),
  });
  region.insertBefore(plant(mirror.root), canvas);

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

  /**
   * ⚠️ READ ONCE, AT BOOT, and held. `readHighScore` touches `localStorage`, and the HUD refreshes
   * on every event of a round -- a hit, a mistake, a level. Reading storage a few times a second
   * for a number that changes when a ROUND ENDS is work nobody asked for, and on the school
   * hardware this targets it is work in the middle of the frame budget.
   */
  let best = readHighScore();

  const hud = createHud({
    doc,
    declaration,
    options: options.root,
    icons: a11yBar,
    i18n,
    defeat: choice.defeat,
    livesLeft: () => (choice.defeat === 'lives' ? Math.max(0, LIVES - (round?.errors() ?? 0)) : null),
    level: () => round?.level() ?? 1,
    best: () => best,
  });
  region.appendChild(plant(hud.root));

  /**
   * The "+1" footer. In the REGION rather than the document, so it is bounded by the board and
   * scrolls out of existence with it; the original fixes its own to the viewport, which it can
   * afford because its HUD is a header rather than a column.
   */
  const feedback = createFeedback({ doc });
  region.appendChild(plant(feedback.root));

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
      /**
       * ⚠️ THE SCORE AFTER THE HIT, not a streak. The original's rule is that the RUNNING SCORE
       * being a multiple of five earns a word; a mistake resets nothing, because nothing is being
       * counted but the score. `round.hits()` is already updated by the time this runs, which is
       * what makes the fifth hit -- and not the sixth -- the one that gets the word.
       */
      if (event.kind === 'hit') {
        const word = comboKeyFor(round?.hits() ?? 0, rng.rnd);
        feedback.push(i18n.t(word ?? 'feedback.point'));
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
    stageWrap.appendChild(next.root);
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
    /**
     * ⚠️ SAVED ON EVERY ENDING, win or loss. The original saves only in `handleGameOver`, so a
     * round that is WON never records its score -- which is the one round most likely to deserve
     * it. Both endings come through here, so both count.
     */
    const record = recordHighScore(hits);
    if (record) best = hits;
    hud.refresh();
    engine.cenas.replace({
      nome: 'result',
      enter: () => mount(createResultScreen({
        doc, i18n, outcome, hits, level, need: ROUND_GOAL, record,
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
      pace: next.pace,
      rnd: rng.rnd,
    });
    fades.clear();
    // A new round starts on a clean footer rather than on the tail of the last one.
    feedback.clear();
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
  }, { signal });

  canvas.addEventListener('click', (event: MouseEvent) => {
    if (event.timeStamp - lastPointerAt < POINTER_WINDOW_MS) return;
    whackAt(event.clientX, event.clientY);
  }, { signal });

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
  }, { signal });

  function applyCamera(state: { pitch: number; yaw: number }): void {
    stage.setCamera(state.pitch, state.yaw);
    invalidate();
  }

  /**
   * ========================= 7b. THE PAUSE =========================
   * ⚠️ THIS GAME USED TO DECLINE ONE, AND ENGINE 8.0.0 TOOK THE DECLINE AWAY (ADR-0120). The
   * reasoning that was written at the call to `createGame` — the title and result screens are the
   * only two places this game stops — was true, and it answered the wrong question: the pause is
   * not only a way to stop, it is the door to the settings a child may need MID-ROUND, when the
   * contrast is wrong or the voice is off and the clock is running.
   *
   * ⚠️ AND THE CARD IS THE ENGINE'S, NOT THIS GAME'S. `createGame` builds it, gives it the id its
   * own menu navigation looks for, and hangs it in `#game-region`; what it deliberately does NOT
   * do is decide when it opens, because "what it means to be playing" is the one part of this only
   * the game knows. So the engine mounts and this function reveals — and without these few lines
   * the card would be a element that exists, is found by the navigation, and can never be seen.
   *
   * Escape opens and closes it. `KeyH` does too, because that is where the engine put the position
   * for hand symmetry; what does NOT is Enter, which this game took off `start` in the declaration
   * because Enter is how the hammer falls.
   */
  let paused = false;
  function setPaused(next: boolean): void {
    if (next === paused) return;
    paused = next;
    if (paused) engine.pausa.mostrar(0);
    else engine.pausa.esconder(0);
    // ⚠️ SAID, NOT SHOWN. A child in blind mode gets no signal from a card appearing, and the one
    // thing she must not have to guess is whether the clock is still running.
    srSay(i18n.t(paused ? 'pause.on' : 'pause.off'));
    invalidate();
  }


  /**
   * ✅ THE STOPGAP IS GONE, AND THE GATE THAT WATCHED IT WAS ALMOST THE REASON IT STAYED.
   *
   * Until engine 9.0.0 this game reached into `#vp-pause-0`, un-hid the `resume` item and wired
   * it by hand, because `createGame` mounted a pause card for every game and offered no way to
   * supply the item that CLOSES it. Escape still worked; a child on a school tablet opened the
   * card and had no way back, which is worse than the dead button the filter was avoiding.
   *
   * ⚠️ AND THE SELF-REMOVING GATE MISSED IT. It asked whether the engine had started actioning
   * `resume` itself — one of two possible fixes — and 9.0.0 took the other: `getPauseActs` on
   * `CreateGameOptions`. The workaround became unnecessary and the test stayed green. It now
   * measures the CONDITION and both doors; the lesson is worth more than the deletion.
   */


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
  /**
   * ⚠️ INSIDE THE REGION, AND STILL `position: fixed`. The rule a cartridge owes is about the
   * DOM — what `teardown()` leaves behind — and a fixed CHILD of the region is still a child of
   * it, so emptying the region takes it. Making it `absolute` would cost a second
   * `getBoundingClientRect()` on every pointer move to subtract the region's origin, and the
   * comment just below is about not doing layout work on that path.
   *
   * 📌 OPEN, AND NOT INVENTED HERE: whether a cursor decoration should be visually clipped to
   * the cartridge in platform mode. No record raises it, and guessing answers it for six.
   */
  stageWrap.appendChild(plant(ball));

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
  }, { signal });

  /**
   * ⚠️ THE NUMBERS NEED THEIR FACE BEFORE THEY ARE ANY GOOD, and `@font-face` is LAZY: a declared
   * face is not fetched until something asks to draw with it, and a Canvas2D `fillText` does not
   * count as asking. Without this the first frames stamp their digits in the sans-serif fallback
   * -- at a different width, so a two-digit number can overhang its tile -- and then silently
   * switch when something else on the page happens to want the font.
   *
   * The redraw is the point of the `then`: the frames already drawn are wrong and nothing else
   * would ever invalidate them.
   */
  doc.fonts.load(`${fontSizeFor(GLYPH_HEIGHT * CAMERA.zoom)}px '${GLYPH_FAMILY}'`, '0123456789')
    .then(invalidate)
    .catch(() => { /* a browser that refuses fonts still gets the fallback, which is legible */ });

  // 8. LAYOUT, and the resize that keeps the scale a whole number of physical pixels.
  const layoutHost = { wrap: stageWrap, region, doc, win: window };
  applyLayout(layoutHost);
  window.addEventListener('resize', () => { applyLayout(layoutHost); invalidate(); }, { signal });

  /**
   * ================== 9. ONE FRAME. THE LOOP THAT DRIVES IT IS THE SHELL'S ==================
   * ⚠️ THIS USED TO BE `startLoop(...)` RIGHT HERE, and ADR-0139 §3 says a cartridge never calls
   * it: «Six cartridges each opening their own frame callback is six loops competing for one
   * frame», and the error boundary spec D16 asks for lives in `aoFalhar`, which is the shell's to
   * wire. In the platform ONE loop calls each mounted cartridge's `update(dt)`.
   *
   * So what the game owns is a frame, and what it hands over is this function. It is half of the
   * `GameInstance` the contract asks for, and `teardown()` below is the other.
   *
   * ⚠️ `dt` IS IN FRAMES, not seconds — the ticker's convention, inherited from PixiJS — and it
   * becomes milliseconds at the boundary below, before it reaches any rule.
   */
  function update(dt: number): void {
    // ⚠️ A TORN-DOWN GAME STILL RECEIVES FRAMES, and pretending otherwise is how a shell's loop
    // ends up drawing into a canvas that has no parent. The loop belongs to the shell (ADR-0139 §3),
    // so the game cannot stop it — what it can do is stop DOING anything, which is the honest answer
    // to «what does `update` mean after `teardown`?».
    if (torndown) return;
    // Only the round gets time, and only while it is the top of the stack. A wave that expired
    // behind a result screen would charge a player for a mistake they were not allowed to make.
    if (round && !screen && !paused) handle(round.advance(dt * FRAME_MS));
    // A fade in progress is a reason to draw even when nothing else changed — the dirty flag is
    // about STATE, and an animation is state changing continuously. So is a wave's countdown: the
    // tiles cool every frame, and without this they would cool only when something else happened.
    if (fades.busy(performance.now()) || round?.tiles().length) invalidate();
    if (!dirty) return;
    dirty = false;
    draw();
  }

  showTitle();

  /**
   * ⚠️ BUILT BEFORE THE DEBUG HOOK ON PURPOSE, so the hook drives THIS object. A mutation making
   * `boot()` return a dead `update` escaped once, because every test stepped the game through a
   * hook that closed over the frame function directly — the thing a SHELL receives was exercised
   * by nobody. Routing the stepper through the returned object closes that by construction
   * rather than by one more test remembering to.
   */
  /**
   * ================== GIVING THE REGION BACK ==================
   * ⚠️ ADR-0139's FOURTH GATE: «after `teardown()`, emptying the region leaves no node the cartridge
   * created». The engine's `unmount()` (9.0.0) does the half that is the ENGINE's — the two keyboard
   * registries, the reach notice, the scene stack — and this does the half that is the game's.
   *
   * 📌 THE SCREEN GOES THROUGH `unmount()` AND NOT THROUGH THE LIST, because it is mounted and
   * discarded on every transition: registering each one would keep a reference to every screen the
   * game ever showed. Its own `destroy()` is what removes it, and calling the local `unmount()` also
   * clears `inert` and `hidden` off elements this game does not own — which nobody would see in a
   * DOM count, and which would arrive at the next cartridge as a region that cannot be tabbed into.
   *
   * ⚠️ AND THE ORDER MATTERS ONCE. Listeners first: a resize between the two loops would call
   * `applyLayout` against nodes half removed. Nothing else here depends on order.
   */
  let torndown = false;
  function teardown(): void {
    // Idempotent, because a shell that tears down twice — or tears down a game that already threw —
    // must not be the thing that fails.
    if (torndown) return;
    torndown = true;
    life.abort();
    unmount();
    for (let i = planted.length - 1; i >= 0; i--) planted[i]!.parentNode?.removeChild(planted[i]!);
    planted.length = 0;
  }

  const api: RunningGame = {
    update,
    view: () => round?.view() ?? { category: choice.category, tiles: [], hits: 0, focus: null },
    isNavigable: () => screen !== null || paused,
    pauseKey,
    // ⚠️ BUILT ON EVERY CALL, not once: `refrescarItensDaPausa` reads the table each time the card
    // opens, and a frozen one is how the engine's own note says this broke before.
    pauseActs: () => ({ resume: () => setPaused(false) }),
    teardown,
  };

  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as Record<string, unknown>).__whack = {
      get round() { return round; },
      get screen() { return screen; },
      mat, stage, mirror, hud, options, feedback, i18n, engine, camera,
      get best() { return best; },
      start: (over: Partial<RoundChoice> = {}) => startRound({ ...choice, ...over }),
      /**
       * ⚠️ CALLS `update` AND NOT THE TICKER, since the loop left this file. It is the same frame
       * body either way; what it skips is `startLoop`'s `maxDt` clamp and its error boundary —
       * and skipping the boundary is BETTER here, because a frame that throws inside a test
       * should fail the test rather than be swallowed and announced.
       */
      step: (dt = 1) => api.update(dt),
      /**
       * ⚠️ THE GAME'S HALF OF THE TEARDOWN, REACHABLE ON ITS OWN — and it is here because a
       * mutation escaped without it. In the standalone shell `engine.unmount()` runs right
       * after `teardown()` and pops the scene stack, and this game's scene `exit` IS its own
       * clean-up (the very thing ADR-0142 measured in this file) — so deleting the clean-up
       * from `teardown()` changed nothing anybody could see. It would still be wrong: a shell
       * that swaps cartridges calls `mount()`, which does NOT pop the stack, and `teardown()`
       * has to stand alone. Exposing it is what lets a test ask that question.
       */
      teardown: () => api.teardown(),
    };
  }

  return api;
}

