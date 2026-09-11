// SPDX-License-Identifier: AGPL-3.0-or-later
// axe over the BUILT bundle, served on a port — the half of pillar 2 that Vitest cannot reach.
//
// ========================= WHY THIS EXISTS =========================
// ⚠️ THE CI HANDED THIS GAME AN ADDRESS AND NOTHING READ IT. The reusable workflow builds the game,
// serves `dist/` on a port, and passes the address as `AXE_URL`. This repository's `test:a11y` did
// not read that variable: it boots `boot/main` inside Vitest, which is stronger in one way — it can
// drive the game into BOTH of its states — and weaker in another, because it audits the MODULE
// GRAPH and not the minified bundle a child actually downloads.
//
// The markup half of that gap was already closed: `tests/a11y.browser.test.ts` reads
// `app/index.html` with `?raw` rather than imitating it. This closes the other half, and it closes
// it without losing what the Vitest run has — it drives the built page into the running state too,
// rather than auditing the title screen and calling it a game.
//
// ⚠️ A MISSING `AXE_URL` IS ANNOUNCED, NEVER SWALLOWED. Locally there is no server and this is a
// no-op, which is correct; what is not correct is a no-op that looks like a pass. The banner says
// which of the two happened, every time, so a workflow that stops passing the address says so in
// its own log instead of going quietly green.
//
// Run: `AXE_URL=http://localhost:8199 node tests/axe-url.mjs`

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

/** The tags this game claims. AAA is aspirational and is not asserted — see docs/. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const url = process.env.AXE_URL;
if (!url) {
  console.log('axe-url: AXE_URL is not set — the BUILT BUNDLE was not audited.');
  console.log('axe-url: the module-graph audit in tests/a11y.browser.test.ts still ran.');
  process.exit(0);
}

/**
 * ⚠️ `?debug=true` IS WHAT MAKES THE SECOND STATE REACHABLE. `boot/main` exposes `__whack.step`
 * only under that flag, and without it a hidden or throttled tab advances no frames at all — the
 * page would be audited with twenty empty cells and would pass for the wrong reason.
 */
function withDebug(address) {
  const u = new URL(address);
  u.searchParams.set('debug', 'true');
  return u.toString();
}

const AXE_SOURCE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

/** One line per violation, with the node that caused it — a bare count is unfixable. */
function describeAll(violations) {
  return violations
    .map((v) => `${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.html).join('\n    ')}`)
    .join('\n');
}

async function audit(page, label) {
  const violations = await page.evaluate(
    ([tags]) =>
      window.axe
        .run({ include: [['#game-region']] }, { runOnly: { type: 'tag', values: tags } })
        .then((r) => r.violations),
    [TAGS],
  );
  if (violations.length) {
    console.error(`axe-url: ${label} — ${violations.length} violation(s)`);
    console.error(describeAll(violations));
    return false;
  }
  console.log(`axe-url: ${label} — clean`);
  return true;
}

const browser = await chromium.launch();
let ok = true;
try {
  const page = await browser.newPage();
  await page.goto(withDebug(url), { waitUntil: 'load' });
  // ⚠️ `attached` AND NOT `visible`, and the difference is the design. The grid mirror is the
  // board a SCREEN READER navigates — twenty real buttons, visually hidden behind the canvas —
  // so waiting for it to be visible waits forever for something that must never be.
  await page.waitForSelector('#game-region .grid-mirror button', { state: 'attached' });
  await page.addScriptTag({ content: AXE_SOURCE });

  // ⚠️ THE SCOPE IS THE SAME AS THE VITEST RUN'S, on purpose. Two audits of the same game that
  // disagreed about what they cover would be two numbers nobody could compare.
  ok = (await audit(page, 'built bundle, title screen')) && ok;

  /**
   * ⚠️ NOT `page.click`, AND THE REASON IS A FEATURE. Playwright waits for an element to be
   * "stable" — to stop moving — and this title floats on purpose: the logo and the neon word
   * under it drift continuously, so the button never settles and the click times out after
   * thirty seconds. Dispatching the click is what the game actually listens for, and it is
   * what `tests/a11y.browser.test.ts` does for the same button.
   */
  await page.evaluate(() => document.querySelector('.title-play').click());
  // Frames by hand: a headless page can be throttled, and an audit of a mat where nothing ever lit
  // is an audit of the empty state wearing the running state's name.
  await page.evaluate(() => {
    for (let i = 0; i < 40; i++) window.__whack.step(1);
  });
  const lit = await page.evaluate(
    () => [...document.querySelectorAll('.grid-mirror button')]
      .filter((b) => !/vazia|empty|vac/i.test(b.getAttribute('aria-label') ?? '')).length,
  );
  if (lit === 0) {
    console.error('axe-url: no tile is lit after 40 frames — the running state was not reached');
    ok = false;
  }
  ok = (await audit(page, 'built bundle, round running')) && ok;
} finally {
  await browser.close();
}

process.exit(ok ? 0 : 1);
