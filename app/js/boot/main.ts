// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/main — the composition root. The only file that knows every other one exists.
//
// ========================= WHAT IT OWNS, AND WHY IT IS THE ONLY ONE =========================
// Everything below is a wiring decision that no single module could make for itself: which
// category is running, where the frame clock comes from, that a mistake is `srSay` and the end of
// a round is `srAlert`, and that a frame delta measured in FRAMES becomes milliseconds before it
// reaches the rules. Each of those is a fact about this GAME, not about any of its parts, which is
// why they live here instead of leaking one at a time into modules that would then need them.

import { createGame } from '@the-inclusionist/engine';
import { srAlert, srSay } from '@the-inclusionist/engine/core/a11y-sr.js';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { rnd } from '@the-inclusionist/engine/core/rng.js';

import { CATEGORIES } from '../rules/category.ts';
import { LIVES } from '../rules/defeat.ts';
import { createRound, type RoundEvent } from '../rules/round.ts';
import { spotOfCell } from '../rules/grid.ts';
import { createWhackDeclaration } from '../declaration/whack-declaration.ts';
import { createFrameTicker } from '../render/frame-ticker.ts';
import { createMat } from '../render/mat.ts';
import { stampGlyphs } from '../render/glyph-pass.ts';
import { pickTopmost, toIllustrationSpace } from '../render/picking.ts';
import { createZdogStage } from '../render/zdog-stage.ts';
import { createGridMirror } from '../ui/grid-mirror.ts';
import { announcementFor } from '../ui/announce.ts';
import { createHud } from '../ui/hud.ts';
import { applyLayout } from '../ui/layout.ts';
import { createI18n, preferredLocale } from '../i18n/index.ts';

/**
 * ⚠️ FRAMES TO MILLISECONDS, and this is the only place the conversion happens.
 *
 * `startLoop` hands out `deltaTime` in FRAMES — PixiJS's convention, which the engine inherited
 * and its animation module is written against — while `rules/round` deals in milliseconds so the
 * original game's timing curve can be stated and asserted in the units it was written in. Physics
 * copied from a tutorial in seconds runs wrong here, and so would a wave deadline.
 */
const FRAME_MS = 1000 / 60;

function boot(): void {
  const doc = document;
  const region = doc.getElementById('game-region');
  if (!region) throw new Error('boot: #game-region is missing');

  // 1. LANGUAGE FIRST. Nothing that carries a word may be built before the locale is known —
  //    the engine learned the same lesson and moved `initI18n` to the top of its own boot.
  const i18n = createI18n(preferredLocale(navigator.language));
  doc.documentElement.lang = i18n.bcp47();
  doc.title = i18n.t('game.title');

  const round = createRound({
    category: CATEGORIES[0],
    difficulty: 'medium',
    defeat: 'lives',
    rnd,
  });

  const declaration = createWhackDeclaration({
    view: () => round.view(),
    t: (key) => i18n.t(key),
  });

  const engine = createGame({
    declaration,
    host: { doc, win: window, cvdHost: doc.getElementById('cvd') },
    // A single mat with no phases: there is no level select to pause into, and no second
    // controller to map. Declared rather than left for the engine to infer from a null.
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
  });
  if (engine.problems.length) console.warn('engine:', engine.problems.join('; '));

  // 2. THE PICTURE.
  const stage = createZdogStage();
  const mat = createMat(stage.root);
  const canvas = stage.canvas;
  canvas.id = 'board-canvas';
  // The canvas is not the board. The grid mirror below is, and it goes in FIRST so a screen
  // reader meets it before anything else in the region.
  canvas.setAttribute('aria-hidden', 'true');
  region.appendChild(canvas);

  const mirror = createGridMirror({
    doc,
    declaration,
    t: (key, params) => i18n.t(key, params),
    onActivate: (cell) => handle(round.hit(cell)),
    onCursor: (cell) => { round.setFocus(spotOfCell(cell)); invalidate(); },
    resolveAction: (code) => engine.keyboard.actionOf(code, 0),
  });
  region.insertBefore(mirror.root, canvas);

  const hud = createHud({
    doc,
    declaration,
    i18n,
    defeat: 'lives',
    livesLeft: () => Math.max(0, LIVES - round.errors()),
    level: () => round.level(),
  });
  region.appendChild(hud.root);




  // 3. WHAT THE ROUND SAYS OUT LOUD.
  //    The sentences live in `ui/announce`, which is pure and tested; all that is left here is the
  //    wiring decision itself — urgent goes to the assertive region, everything else to the polite
  //    one. That split is the only part of announcing that is about this composition.
  function announce(event: RoundEvent): void {
    const said = announcementFor(event, {
      i18n,
      collecting: declaration.objectiveOf(0).name.text,
      hits: round.hits(),
    });
    if (!said) return;
    (said.urgent ? srAlert : srSay)(said.text);
  }

  let dirty = true;
  function invalidate(): void { dirty = true; }

  function handle(events: readonly RoundEvent[]): void {
    for (const event of events) announce(event);
    if (events.length === 0) return;
    mirror.refresh();
    hud.refresh();
    invalidate();
  }

  // 4. THE PICTURE, ONCE PER FRAME THAT NEEDS ONE.
  function draw(): void {
    const wave = round.wave();
    mat.setLit(wave ? wave.tiles.map((t) => t.cell) : []);
    stage.render();
    if (!wave) return;
    // ⚠️ AFTER `stage.render()`, which updates the graph: the projected corners the glyphs are
    // placed on are last frame's until it runs, and numbers a frame behind the mat look like a
    // rendering glitch while really being a sequencing bug.
    const ctx = canvas.getContext('2d');
    if (ctx) {
      stampGlyphs(
        ctx,
        wave.tiles.map((t) => ({ cell: t.cell, text: String(t.value) })),
        mat.quads(),
        stage.viewport(),
      );
    }
  }

  // 5. THE POINTER. It ends in the same `onActivate` the keyboard does.
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    // Client pixels to CANVAS pixels: the canvas is displayed at a whole multiple of its
    // resolution, so the caller divides by that factor before inverting the projection.
    const scale = rect.width / canvas.width;
    const at = toIllustrationSpace(
      { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale },
      stage.viewport(),
    );
    const cell = pickTopmost(mat.quads(), at);
    if (cell !== null) handle(round.hit(cell));
  });

  // 6. LAYOUT, and the resize that keeps the scale a whole number of physical pixels.
  applyLayout({ doc, win: window });
  window.addEventListener('resize', () => { applyLayout({ doc, win: window }); invalidate(); });

  // 7. THE LOOP.
  const ticker = createFrameTicker();
  startLoop(ticker, (dt: number) => {
    handle(round.advance(dt * FRAME_MS));
    if (!dirty) return;
    dirty = false;
    draw();
  }, 2, {
    // ⚠️ The engine's own main.ts does NOT wire this, and it should. A frame that throws stops the
    // loop — which is right — but a blind child cannot see a frozen screen, so the stop has to be
    // said out loud. `core/loop`'s own comment is exactly that sentence.
    aoFalhar: (error: unknown) => {
      srAlert(i18n.t('say.crashed'));
      console.error('frame failed:', error);
    },
  });

  // Debug surface. A hidden tab never fires requestAnimationFrame, so an animation that only
  // advances when a screenshot is taken cannot be verified; `step` drives it by hand.
  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as Record<string, unknown>).__whack = {
      round, mat, stage, mirror, i18n, engine,
      step: (dt = 1) => ticker.step(dt),
    };
  }
}

boot();
