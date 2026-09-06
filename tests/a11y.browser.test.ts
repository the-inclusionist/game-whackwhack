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
    for (let i = 0; i < 40; i++) debug?.step(1);
  });

  it('has no violations while playing', async () => {
    const violations = await audit();
    expect(describeAll(violations), 'axe found violations').toBe('');
  });

  it('really is playing, so the assertion above audited the board', () => {
    expect(document.querySelector('.screen')).toBeNull();
    expect(document.querySelector('.hud-live')).not.toBeNull();
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
