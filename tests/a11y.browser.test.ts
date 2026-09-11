// SPDX-License-Identifier: AGPL-3.0-or-later
// axe-core over the real game, in both of the states it has.
//
// ========================= WHY THIS BOOTS THE WHOLE GAME =========================
// Every other browser test here builds one module and asserts on it, which is right for a module
// and useless for this. An accessibility audit is about the DOCUMENT: a duplicate id, a control
// with no accessible name, a live region nested inside another one — none of those are properties
// of a module, they are properties of what the modules produce TOGETHER. So this file writes the
// markup `boot/main` requires and imports it, which is the only test in the suite that runs the
// composition root.
//
// ⚠️ IT IS SCOPED TO `#game-region`, deliberately and not to soften it. The vitest harness page is
// not `app/index.html` — it has no `lang`, no `<main>`, no `<h1>` of its own — so a document-wide
// run would report the harness and not the game. `docs/` says where the document-level rules are
// checked instead; the game's own tree is what this file owns.
//
// ========================= WHAT IT CANNOT SEE =========================
// axe is a static check. It cannot tell that a tile has a five-second deadline, that a colour
// pair fails under deuteranopia, or that an announcement arrives twice. Those are
// tests/palette.node.test.ts, tests/announce.node.test.ts and the mutation harness. Passing here
// is a floor, and `docs/` says so rather than this suite implying otherwise.

import { beforeAll, describe, expect, it } from 'vitest';
import axe from 'axe-core';
import indexHtml from '../app/index.html?raw';
import '../app/css/style.css';

/**
 * The REAL markup, read out of `app/index.html`.
 *
 * ⚠️ IT WAS A COPY OF IT, TYPED HERE, and a copy is a second source of truth that agrees only
 * until someone edits one of them. The MARCAÇÃO EXIGIDA in that file -- `#game-region`,
 * `#sr-status`, `#sr-alert` -- is exactly what `createGame` checks for, so an audit of a hand-typed
 * imitation would keep passing after the shipped page lost one of them.
 *
 * `?raw` is Vite's, so the file is read at build time and this stays a browser test with no `fs`.
 * The module script is stripped: `boot/main` is imported below by name, and leaving a second
 * `<script src>` in would boot the game twice.
 */
function scaffold(): void {
  const body = indexHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!body) throw new Error('a11y: could not find a <body> in app/index.html');
  document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');
  if (!document.getElementById('game-region')) {
    throw new Error('a11y: app/index.html no longer carries #game-region');
  }
}

/** The tags this game claims. AAA is aspirational and marked honestly in docs/, not asserted. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function audit(): Promise<axe.Result[]> {
  const results = await axe.run(
    { include: [['#game-region']] } as unknown as axe.ElementContext,
    { runOnly: { type: 'tag', values: TAGS } },
  );
  return results.violations;
}

/** One line per violation, with the node that caused it — a bare count is unfixable. */
const describeAll = (violations: axe.Result[]): string =>
  violations.map((v) => `${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.html).join('\n    ')}`).join('\n');

beforeAll(async () => {
  scaffold();
  // ⚠️ THE DEBUG HOOK, AND IT IS NOT A CONVENIENCE. `boot/main` exposes `window.__whack` only
  // when `?debug` is in the URL, and it reads `location.search` at import time — so this line has
  // to come first. Without it the hook is `undefined`, and every `debug?.step(1)` below is a
  // no-op that LOOKS like advancing the game: the block that audits "the mat once a round is
  // running" was auditing twenty empty cells, and passing, because forty optional calls did
  // nothing at all. That is why the calls below are not optional any more.
  history.replaceState(null, '', `${location.pathname}?debug=true`);
  // Imported for its SIDE EFFECT: `boot/main` calls `boot()` at module scope, so this line is
  // what starts the game. It is inside `beforeAll` rather than at the top of the file because the
  // markup above has to exist first — `boot` throws on a missing `#game-region`, by design.
  await import('../app/js/boot/main.ts');
  await document.fonts.ready;
});

describe('[Interface] axe itself is running, and would report a violation', () => {
  // ⚠️ A GREEN AUDIT AND A DEAD AUDIT LOOK IDENTICAL. `axe.run` with a scope that matches nothing,
  // a `runOnly` tag list with a typo in it, or a rule set that excluded everything would all
  // report zero violations — and this file would pass for the rest of the project's life while
  // checking nothing. So it is shown a broken node first.
  it('reports an image with no alternative text', async () => {
    const region = document.getElementById('game-region')!;
    const broken = document.createElement('img');
    broken.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    region.appendChild(broken);
    try {
      const violations = await audit();
      expect(violations.map((v) => v.id)).toContain('image-alt');
    } finally {
      broken.remove();
    }
  });

  it('reports a control with no accessible name', async () => {
    // A second, different rule: one broken rule id would not prove the tag list is right.
    const region = document.getElementById('game-region')!;
    const nameless = document.createElement('button');
    region.appendChild(nameless);
    try {
      const violations = await audit();
      expect(violations.length).toBeGreaterThan(0);
    } finally {
      nameless.remove();
    }
  });

  it('goes back to clean once the broken nodes are gone', async () => {
    // And the teardown works, or every test after the two above would be auditing wreckage.
    expect(describeAll(await audit())).toBe('');
  });
});

describe('[Interface] the title screen passes axe', () => {
  it('has no violations while the choices are up', async () => {
    const violations = await audit();
    expect(describeAll(violations), 'axe found violations').toBe('');
  });

  it('really is the title screen, so the assertion above audited something', async () => {
    // ⚠️ A scope that matched nothing would report zero violations and look identical to a pass.
    expect(document.querySelector('.screen--title')).not.toBeNull();
    expect(document.querySelectorAll('.grid-mirror button')).toHaveLength(20);
    expect(document.querySelector('.hud-options')).not.toBeNull();
  });
});

describe('[Interface] the mat passes axe once a round is running', () => {
  beforeAll(async () => {
    (document.querySelector('.title-play') as HTMLButtonElement).click();
    // A few frames, so tiles are actually up and the mirror is labelled for a live board rather
    // than for twenty empty cells.
    const debug = (window as unknown as { __whack?: { step(dt: number): void } }).__whack;
    expect(debug, 'the debug hook is off, so no frame below actually ran').toBeDefined();
    for (let i = 0; i < 40; i++) debug!.step(1);
  });

  it('has no violations while playing', async () => {
    const violations = await audit();
    expect(describeAll(violations), 'axe found violations').toBe('');
  });

  it('really is playing, so the assertion above audited the board', () => {
    expect(document.querySelector('.screen')).toBeNull();
    expect(document.querySelector('.hud-live')).not.toBeNull();
    // ⚠️ AND A TILE IS ACTUALLY LIT. Without this the block passes over an empty mat, which is
    // exactly what it did while the stepper was a no-op — a live board and a dead one audit the
    // same when nothing is on either.
    const lit = [...document.querySelectorAll('.grid-mirror button')]
      .filter((b) => !/vazia|empty|vac/i.test(b.getAttribute('aria-label') ?? ''));
    expect(lit.length, 'no tile is lit, so the audit above saw an empty mat').toBeGreaterThan(0);
  });
});

describe('[Right] the two live regions are exactly the ones the engine asked for', () => {
  it('has one polite and one assertive, both outside the region', () => {
    // ⚠️ Nested live regions are the classic way to get every announcement twice, and axe does
    // not check for it. `#sr-status` and `#sr-alert` are siblings of `#stage-wrap`, and the only
    // live region INSIDE the game is the option panel's — which fires on a click and never on a
    // frame. Three would mean one of them is announcing something twice.
    expect(document.getElementById('sr-status')?.getAttribute('aria-live')).toBe('polite');
    expect(document.getElementById('sr-alert')?.getAttribute('aria-live')).toBe('assertive');
    for (const id of ['sr-status', 'sr-alert']) {
      expect(document.getElementById(id)?.closest('#game-region')).toBeNull();
    }
  });

  it('has no live region nested inside another', () => {
    for (const live of document.querySelectorAll('[aria-live]')) {
      expect(live.parentElement?.closest('[aria-live]'), live.outerHTML).toBeFalsy();
    }
  });
});

describe('[Right] the canvas is decoration and the mirror is the board', () => {
  it('hides the canvas from the accessibility tree', () => {
    // The canvas cannot be navigated, named or read. The twenty buttons beside it can, and they
    // are what a screen reader finds — which is only true while the canvas says it is not there.
    expect(document.getElementById('board-canvas')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('gives every mirror button an accessible name', () => {
    // axe checks this too; it is repeated here because the failure is the one that would make the
    // whole grid useless, and a named assertion says which of the twenty is wrong.
    for (const button of document.querySelectorAll('.grid-mirror button')) {
      expect(button.getAttribute('aria-label')?.trim(), button.outerHTML).toBeTruthy();
    }
  });
});

describe('[Right] the engine finds everything it needs in this document', () => {
  it('reports no problems at all', () => {
    // ⚠️ `problems` IS THE ENGINE TELLING THE CONSUMER WHAT THE CHILD WILL NOT HAVE, and until
    // this test existed it went to `console.warn` and nowhere else. It carried two entries for
    // weeks: no accessibility bar on the first screen ("sem ela a criança não alcança modo cego,
    // TTS, alto contraste nem Libras antes de começar") and no answer about the neural voice.
    // Both are answered now — one by mounting the bar, one by declaring the decline — and a list
    // nobody asserts on is a list that fills up again.
    const engine = (window as unknown as { __whack?: { engine: { problems: readonly string[] } } })
      .__whack?.engine;
    expect(engine, 'the debug hook is off, so this asserted nothing').toBeDefined();
    expect(engine!.problems.join('\n'), 'the engine is missing something').toBe('');
  });
});

// ========================= THE PAUSE AND THE BAR, WHICH THE ENGINE MOUNTS =========================
// ⚠️ THESE ARE HERE AND NOT IN A FILE OF THEIR OWN because they are the only two pieces of this
// game that no module produces: `createGame` writes them into the document at boot, and they exist
// only in a tree where the composition root has actually run. This is the one file where it has.
//
// Engine 8.0.0 removed `declines.semMenuDePausa` (ADR-0120), so both arrive whether or not a game
// asks. What the game still owns is WHERE they sit and WHEN the card opens, and every assertion
// below is about that half.

/**
 * ⚠️ DISPATCHED ON THE REGION AND NOT ON THE WINDOW, and the difference is the whole test.
 *
 * 📏 A mutation escaped here. `window.dispatchEvent` gives the event no propagation PATH: when the
 * target IS the window, a capture listener and a bubble listener on that same window both fire,
 * because `stopPropagation` stops the event reaching OTHER nodes and not other listeners on the
 * node it is already at. So the phase stopped mattering, and the run with `{ capture: true }`
 * removed — the very bug that shut a child inside the pause card — passed.
 *
 * A real keydown starts at the focused element, deep inside `#game-region`, and climbs. Starting
 * it there is what makes `ui/menu-nav`'s capture listener sit BETWEEN the origin and this file.
 */
const esc = (): void => {
  const from = document.getElementById('game-region') ?? document.body;
  from.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
};
const pauseCard = (): HTMLElement | null => document.getElementById('vp-pause-0');

describe('[Right] the accessibility bar is reachable before the first round', () => {
  it('is filled by the engine and lives in the HUD column', () => {
    // ⚠️ THE ENGINE WROTE THE BUTTONS, so an empty host is the failure this catches: `createGame`
    // finds the element, or it puts a line in `problems` and says nothing else. Seven icons is
    // what a game that declares `seguraTeclas: false` gets — the latching icon is deliberately
    // NOT among them, because nothing in this game is held.
    const bar = document.getElementById('a11y-bar');
    expect(bar, 'the bar host is missing from the document').not.toBeNull();
    expect(bar!.querySelectorAll('.pi-btn').length).toBeGreaterThan(0);
    expect(bar!.closest('.hud'), 'the bar must be in the HUD column').not.toBeNull();
  });

  it('offers no latching control, because this game holds no key', () => {
    // The other half of `seguraTeclas(): false`. A control that does nothing is the dead button
    // ADR-0106 §5 forbids, and the engine only mounts it for a game that says it holds something.
    const bar = document.getElementById('a11y-bar')!;
    expect(bar.querySelector('[data-pi="altmove"]')).toBeNull();
  });

  it('gives every icon a 44 px target, which is where WCAG 2.5.5 starts', () => {
    // The floor. Without the engine's sheet at all, these same buttons computed to 33 px, because
    // `.pi-btn` is sized with `var(--tap)` and the variable was undefined.
    for (const icon of document.querySelectorAll('#a11y-bar .pi-btn')) {
      const box = icon.getBoundingClientRect();
      expect(Math.round(box.width), icon.outerHTML).toBeGreaterThanOrEqual(44);
      expect(Math.round(box.height), icon.outerHTML).toBeGreaterThanOrEqual(44);
    }
  });

  it('keeps the 44 px even when the engine asks for 88, because the column is narrow', () => {
    /**
     * ⚠️ THE CEILING, AND IT HAS TO BE STAGED. `--tap` is the engine's PREFERRED size and
     * `ui/layout` grows it with the canvas — `22 x k`, so 88 px at a 4x upscale. This harness
     * renders at a scale where it never leaves the 44 px floor, so a test that only measured what
     * it found here could not tell the override apart from its absence: the mutation that deletes
     * `#a11y-bar { --tap: 44px }` escaped exactly that way.
     *
     * So the scale is staged rather than waited for. Measured in a real browser at 1280x720 with
     * the override gone: seven 88 px buttons is 662 px of bar in a 352 px column, which took the
     * HUD's scrollbar with it and pushed the difficulty cycler off the top.
     *
     * ⚠️ AND IT IS STAGED ON `#game-region`, WHICH IS WHERE THE ENGINE PUTS IT — `ui/layout` does
     * `gr.style.setProperty('--tap', 22 * k + 'px')`, INLINE, on the region. Staging it on `:root`
     * instead changes nothing at all, because the region's inline value shadows the root for its
     * whole subtree; the first version of this test did exactly that and the mutation escaped it
     * a second time.
     */
    const root = document.getElementById('game-region')!;
    const before = root.style.getPropertyValue('--tap');
    root.style.setProperty('--tap', '88px');
    try {
      for (const icon of document.querySelectorAll('#a11y-bar .pi-btn')) {
        const box = icon.getBoundingClientRect();
        expect(Math.round(box.width), icon.outerHTML).toBe(44);
      }
    } finally {
      if (before) root.style.setProperty('--tap', before);
      else root.style.removeProperty('--tap');
    }
  });

  it('names every icon, because an unnamed one is unreachable by a screen reader', () => {
    for (const icon of document.querySelectorAll('#a11y-bar .pi-btn')) {
      expect(icon.getAttribute('aria-label')?.trim(), icon.outerHTML).toBeTruthy();
    }
  });
});

describe('[Right] Escape opens the pause and Escape closes it again', () => {
  it('starts hidden, because a pause opens rather than being open', () => {
    expect(pauseCard(), 'the engine did not mount a pause card').not.toBeNull();
    expect(pauseCard()!.hidden).toBe(true);
  });

  it('opens on Escape and closes on the next one', () => {
    // ⚠️ THE CLOSE IS THE HALF THAT BROKE. `ui/menu-nav` listens on the window in CAPTURE and calls
    // `stopPropagation()` on Escape, so the first version of this — a bubble listener on
    // `#game-region` — opened the card and could never close it: the child was shut inside. The
    // fix is registration ORDER, and this test is what would notice it being undone.
    esc();
    expect(pauseCard()!.hidden, 'Escape did not open the pause').toBe(false);
    esc();
    expect(pauseCard()!.hidden, 'Escape did not close the pause').toBe(true);
  });

  it('offers a way out that is not a key', () => {
    // ⚠️ A CHILD ON A TOUCH SCREEN HAS NO ESCAPE. `createGame` gives a consumer no way to supply
    // the `resume` action, so the engine's §5 filter hides "Continuar" as a dead button — which is
    // correct of it and leaves a trap. `boot/main` supplies the action; delete both the day
    // `CreateGameOptions` takes pause actions.
    esc();
    const resume = pauseCard()!.querySelector<HTMLElement>('[data-act="resume"]');
    expect(resume, 'the engine no longer ships a resume item').not.toBeNull();
    expect(resume!.hidden, 'the resume item is hidden, so the pause is a trap').toBe(false);
    resume!.click();
    expect(pauseCard()!.hidden, 'clicking Continuar did not close the pause').toBe(true);
  });

  it('stops the clock while it is open, and starts it again after', () => {
    // The whole point of a pause. A round that kept expiring tiles behind the card would charge a
    // child for the seconds she spent turning the contrast up.
    const debug = (window as unknown as { __whack?: { step(dt: number): void } }).__whack!;
    const labels = (): string =>
      [...document.querySelectorAll('.grid-mirror button')].map((b) => b.getAttribute('aria-label')).join('|');

    esc();
    const frozen = labels();
    for (let i = 0; i < 600; i++) debug.step(1);
    expect(labels(), 'the mat moved while the game was paused').toBe(frozen);

    esc();
    for (let i = 0; i < 600; i++) debug.step(1);
    expect(labels(), 'the mat did not move again after the pause closed').not.toBe(frozen);
  });
});
