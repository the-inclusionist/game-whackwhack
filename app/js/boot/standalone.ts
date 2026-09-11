// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/standalone — the shell that runs this game as its own page.
//
// ========================= WHY A SHELL EXISTS AT ALL =========================
// ⚠️ ADR-0139 §2: A CARTRIDGE NEVER CALLS `createGame`. It mounts the accessibility bar, the pause
// card, the six colour-vision filters, the TTS, the sonar, the settings panel, the menu navigation
// and the keyboard runtime — and six cartridges calling it inside one platform would deduplicate
// the BYTES and multiply the RUNTIME: N accessibility bars, N TTS instances, N keyboard runtimes
// competing for one document. That failure shows up as broken behaviour rather than as weight.
//
// So the caller lives outside the game, and ADR-0140 §2 is the payoff: because the caller is
// outside, it is free to DIFFER. This file is one caller; the platform will be another; the game
// between them is the same file and does not know which one it got.
//
// ========================= THE SPLIT, READ OFF `CreateGameOptions` =========================
// ADR-0139 §1 divides that type by asking whether a PAGE could answer the field without knowing
// which game is running:
//
//   THE HOST'S HALF — decided here: `host`, `declines`, `baixarPesados`, `carregarVozNeural`,
//     `aoProgredirPesados`, `disponibilidade`.
//   THE GAME'S HALF — from the game: `declaration`, `isNavigable`, `preset`, and the six others
//     this game does not use.
//
// ========================= AND THE ORDER THAT FORCES A DELEGATION =========================
// ⚠️ `createGame` TAKES THE GAME'S HALF AS VALUES, AND RUNS BEFORE THE GAME EXISTS. This game's
// declaration reads the live round and its `isNavigable` reads the live screen — neither exists
// until `boot()` has run, and `boot()` needs the engine that `createGame` returns.
//
// 📏 That is not a defect of this game; it is ADR-0139 §5 arriving one level early. The record's own
// answer for the platform is «a declaration whose members forward to the mounted cartridge», and the
// answer here is the same: forward to whatever `boot()` returned, and answer safely before it has.
//
// 📌 SO THE ONLY MUTABLE POINTER IN THE ARRANGEMENT IS HERE. Spec D14 forbids module state in a
// CARTRIDGE — it survives `teardown()` and leaks into the next game on the page. A shell is not a
// cartridge, and something has to know which instance is current. Keeping it here is what keeps the
// game itself clean.

import { createGame } from '@the-inclusionist/engine';
import { srAlert } from '@the-inclusionist/engine/core/a11y-sr.js';
import { startLoop } from '@the-inclusionist/engine/core/loop.js';
import { ACTIONS, type Action } from '@the-inclusionist/engine/core/actions.js';
import { KEYS, set } from '@the-inclusionist/engine/platform/storage.js';
import { aplicacao, type Correcao, type VisualState } from '@the-inclusionist/engine/render/viz-axes.js';
import { VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import { lerVisualGuardado } from '@the-inclusionist/engine/render/viz-setters.js';

import { createWhackDeclaration } from '../declaration/whack-declaration.ts';
import { createI18n, preferredLocale } from '../i18n/index.ts';
import { actionPreset } from '../input/actions.ts';
import { createFrameTicker } from '../render/frame-ticker.ts';
import { CATEGORIES } from '../rules/category.ts';
import { boot, type RunningGame } from './main.ts';

const doc = document;

// 1. THE LANGUAGE, BEFORE ANYTHING THAT CARRIES A WORD. The engine writes the accessibility bar's
//    labels inside `createGame`, so the locale has to be settled before that call and not after.
//    ⚠️ `documentElement.lang` moved here with it: in a platform the document's language belongs to
//    the platform, not to one of six cartridges.
const i18n = createI18n(preferredLocale(navigator.language));
doc.documentElement.lang = i18n.bcp47();

// 2. THE ACCESSIBILITY BAR'S HOST. Built here because `createGame` FILLS it; the HUD only places it.
//    ⚠️ The engine gets an element of its own inside the row: its click handler rewrites the
//    `aria-label` of every `.pi-btn` under the host from state it holds, and the colour-vision
//    button this game adds is driven by state the engine was never given.
const a11yBar = doc.createElement('div');
a11yBar.id = 'a11y-bar';
const engineBar = doc.createElement('div');
engineBar.id = 'a11y-bar-engine';
a11yBar.appendChild(engineBar);

// 3. THE TWO ELEMENTS THE GAME IS GIVEN, and this is the file allowed to know their ids.
//    ⚠️ `#stage-wrap` IS THE REGION (measured 2026-09-11): it fills the viewport, so a `.screen`
//    inside it at `inset: 0` keeps the box it had as `position: fixed`. `#game-region` could not
//    be it — that is the integer-scaled canvas box, and a title screen covers more than the mat.
//    📌 AND THE SECOND ONE IS A HOLE IN THE CONTRACT, not a convenience: `declaration.world()`
//    answers `#game-region` and `createGame` resolves that selector BEFORE any cartridge exists,
//    so the element the world names cannot be one the cartridge created. `GameCtx` names one
//    region. Reported in `BootDeps`; not decided here (ADR-0068 §5).
const stageWrap = doc.getElementById('stage-wrap');
const gameRegion = doc.getElementById('game-region');
if (!stageWrap || !gameRegion) throw new Error('standalone: #stage-wrap or #game-region is missing');

/*
 * ========================= THE SEAT'S VISION, AND WHY IT IS THE SHELL'S =========================
 * ✅ ENGINE 9.0.0 GAVE THIS A DOOR. Until it did, `createGame` decided whether the 🚥 icon exists by
 * asking `Boolean(ctx.setCorrecaoDoJogador)` — a writer it never passed and `CreateGameOptions` had
 * no field for — so the icon was mounted for NO game that booted through it. This game answered by
 * building the button by hand in `ui/vision.ts` (91 lines) and in `boot/main.ts` (~50 more). Both
 * are deleted: the engine mounts the icon, rings the correction, and says the sentence.
 *
 * ⚠️ WHAT IS LEFT IS THE STATE, AND IT BELONGS TO THE PAGE. A child's colour correction is not one
 * of six games' business; the key is `KEYS.visualP(0)` — the engine's own — so the choice she makes
 * in one game is already made in the next on the same origin.
 *
 * 🔴 AND THE DOOR IS HALF A DOOR, WHICH IS WORTH REPORTING RATHER THAN WORKING AROUND IN SILENCE.
 * `ui/pause-icons` rings from `(getPlayers()[i] || {}).visual`, and `createGame` answers
 * `getPlayers` with `cartucho.players` — but `CreateGameOptions.players` is typed
 * `{ ctrl: KeyScheme }[]`, with NO `visual`. So the engine READS a field its own type does not let a
 * consumer WRITE: pass the writer alone and every click computes `proximaCorrecao(PADRAO)`, which is
 * the same second step forever. The seat below carries `visual` anyway — assignable because excess
 * property checks do not reach a value passed through a variable — and that is precisely why it must
 * be said out loud instead of enjoyed quietly.
 *
 * 📌 Either `players` grows the field it is already read for, or the ring takes the current state
 * from the writer's side. Not this repository's to decide (ADR-0068 §5).
 */
const SEAT = 0;
/**
 * ⚠️ `ctrl` IS REQUIRED AND IMMEDIATELY OVERWRITTEN, which is worth saying rather than hiding
 * behind a cast. `createGame` calls `keyboard.assignControls()` one line after it reads `players`,
 * and that replaces every seat's scheme with the real one derived from `mapeamentoDoTeclado()`.
 * So the honest value here is the engine's own «reaches nothing»: fourteen declared absences, not
 * an empty object that would make the type claim completeness it does not have.
 *
 * 📌 AND THE SEAT COUNT DOES NOT CHANGE. Without `players` the engine substitutes one seat of its
 * own (`semJogadores`), so this is the same single child it always was — measured, because a second
 * seat would pull in `setPauseActor` and a `problems` line.
 */
const REACHES_NOTHING = Object.fromEntries(
  ACTIONS.map((a) => [a, null]),
) as Record<Action, readonly string[] | null>;
const seats = [{ ctrl: REACHES_NOTHING, visual: lerVisualGuardado(SEAT) }];

/**
 * The CSS this state asks for, or nothing.
 *
 * ⚠️ THROUGH `aplicacao` AND NOT `filtroChave`, because the two axes resolve TOGETHER — that is the
 * whole of the engine's issue #104. A state carrying both a contrast theme and a correction returns
 * both halves, and reading one of them is how applying one used to erase the other.
 */
function visionCss(v: VisualState): string {
  const key = aplicacao(v).filtro;
  if (!key) return '';
  return VIZ_FILTER[key as keyof typeof VIZ_FILTER] ?? '';
}

/**
 * ⚠️ `mundo-e-menus` AND NOT `mundo`, and the two are not interchangeable. A SIMULATION belongs to
 * the world alone — the engine undoes it over the menus so a blindness simulation cannot trap a
 * child inside the thing she is trying to leave. A CORRECTION is the opposite: it is how she sees,
 * and a menu left uncorrected is a menu she cannot read.
 */
function applyVision(v: VisualState): void {
  engine.aplicarFiltroDeVisao(visionCss(v), 'mundo-e-menus');
}

/** The instance, once there is one. See the note at the top on why this lives in the shell. */
let current: RunningGame | null = null;

// 4. THE GAME'S HALF, DELEGATED. Before `boot()` returns, the mat is empty — which the contract
//    already treats as «nothing to aim at», so the title screen is a conformant state rather than a
//    special case. That is what makes answering safely possible at all.
const declaration = createWhackDeclaration({
  view: () => current?.view() ?? { category: CATEGORIES[0], tiles: [], hits: 0, focus: null },
  t: (key) => i18n.t(key),
});

// 5. THE PAUSE KEY, REGISTERED BEFORE THE ENGINE IS BUILT — and the order is the whole point.
//    ⚠️ `ui/menu-nav` registers on the window in CAPTURE and calls `stopPropagation()` on Escape.
//    Two capture listeners on one target run in REGISTRATION order, so being first means being
//    registered before `createGame`. A bubble listener opened the pause and could never close it.
window.addEventListener(
  'keydown',
  (event: KeyboardEvent) => current?.pauseKey(event),
  { capture: true },
);

// 6. ONE `createGame`, and the host half is all of it this file decides.
const engine = createGame({
  declaration,
  host: { doc, win: window, cvdHost: doc.getElementById('cvd'), a11yBarHost: engineBar },
  // ⚠️ `semVozNeural` costs something real: without a neural voice a child who does not read gets
  // the system voice, which on a school Chromebook may not exist in Portuguese. The alternative
  // drags `onnxruntime-web` in as a non-optional peer — 135 MB in every consumer's node_modules.
  declines: { semAssistenteDePad: true, semAtorDePausa: true, semVozNeural: true },
  // ⚠️ 241 MB of vision runtime, gaze and neural voices, none of which this game can read — and
  // `platform/pesados-catalogo` says the engine cannot read them yet either (issue #11).
  baixarPesados: false,
  isNavigable: () => current?.isNavigable() ?? true,
  // ⚠️ DELEGATED FOR THE SAME REASON `isNavigable` IS: `createGame` runs before the game exists,
  // and the empty table before it does is the truth — a card that opens over a title screen has
  // nothing of this game's to offer, and the engine's three items still work.
  getPauseActs: () => current?.pauseActs() ?? {},
  // ⚠️ THE ENGINE RINGS AND SAYS; THIS ONLY REMEMBERS AND APPLIES. `proximaCorrecao`, the label and
  // the `sr.icon.cvd` sentence are all `ui/pause-icons`, which is why handing the writer over deleted
  // more code than it added. There is no theme writer: high contrast means REPAINTING the mat from
  // the declared roles, and mounting ⚫ without that is ADR-0106 §5's dead button (plan item A1b).
  players: seats,
  setCorrecaoDoJogador: (i: number, correcao: Correcao) => {
    const seat = seats[i];
    if (!seat) return;
    seat.visual = { ...seat.visual, correcao };
    set(KEYS.visualP(i), JSON.stringify(seat.visual));
    applyVision(seat.visual);
  },
  preset: actionPreset((key) => i18n.t(key)),
});
if (engine.problems.length) console.warn('engine:', engine.problems.join('; '));

// ⚠️ RESTORED BEFORE THE FIRST FRAME. A correction that only takes effect after the child clicks the
// icon again is a correction she has to set on every visit.
applyVision(seats[SEAT]!.visual);

// 7. AND ONLY NOW THE GAME.
current = boot({ engine, a11yBar, i18n, region: stageWrap, world: gameRegion });

/**
 * ⚠️ THE DEBUG STEPPER IS RE-POINTED AT WHAT `boot()` RETURNED, and the reason is a mutation
 * that escaped twice. `boot()` builds the hook itself and closed it over its own object, so a
 * mutation returning a DIFFERENT object with a dead `update` left every test stepping the live
 * one — the thing a shell actually drives was exercised by nobody.
 *
 * 📌 Pointing it here is not a test convenience: it puts the stepper on exactly the path the
 * loop below uses, so what a test drives and what a child plays are the same object.
 */
const dbg = (window as unknown as { __whack?: { step: (dt?: number) => void } }).__whack;
if (dbg) dbg.step = (dt = 1) => current?.update(dt);

/**
 * 8. THE LOOP. ADR-0139 §3: a cartridge never calls `startLoop`, because six cartridges each opening
 *    their own frame callback is six loops competing for one frame.
 *
 * ⚠️ `aoFalhar` IS WHERE SPEC D16 LIVES — «one broken game must stay distinguishable from a broken
 * engine». A frame that throws stops the loop, which is right; what must not happen is it stopping
 * in SILENCE, because a blind child cannot see a frozen screen.
 */
startLoop(createFrameTicker(), (dt: number) => current?.update(dt), 2, {
  aoFalhar: (error: unknown) => {
    srAlert(i18n.t('say.crashed'));
    console.error('frame failed:', error);
  },
});

/**
 * 9. AND THE WAY OUT, which a standalone page never needs and a platform needs every time.
 *
 * ⚠️ THE TWO HALVES ARE BOTH REQUIRED AND NEITHER IMPLIES THE OTHER. `current.teardown()` gives back
 * what the GAME put in the region and revokes the listeners it registered on the window;
 * `engine.unmount()` (9.0.0) clears what the ENGINE registered for that cartridge — the keyboard and
 * pad mappings, the reach notice, the scene stack. A shell that calls one and not the other leaves
 * the half nobody can see.
 *
 * 📌 IT IS WIRED TO `pagehide` HERE ONLY SO IT IS EXERCISED AT ALL. On a page that is closing, the
 * browser reclaims everything anyway — but a `teardown()` no shell ever calls is a `teardown()` that
 * rots, and this repository is where the platform's shell is being learned.
 */
function teardown(): void {
  current?.teardown();
  current = null;
  engine.unmount();
}
// ⚠️ NOT `{ once: true }`, AND THE REASON IS WHERE THE GUARD BELONGS. Idempotence is a property
// of `teardown()` — a shell that tears down twice, or tears down a game that already threw, must
// not be the thing that fails — and putting `once` here would move that guarantee into the
// REGISTRATION, where no test can reach it and the next shell will not copy it.
window.addEventListener('pagehide', teardown);
