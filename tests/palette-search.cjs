// SPDX-License-Identifier: AGPL-3.0-or-later
// Searches for an unlit-tile colour that clears every floor, in normal vision AND under the three
// colour-vision matrices. Not shipped and not a test: it is the tool that produced the numbers in
// render/palette.ts, kept so the next person can re-run it instead of trusting the table.
//
//   node tests/palette-search.cjs

const CVD = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuter: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900],
};

const hex = (h) => [(parseInt(h.slice(1), 16) >> 16) & 255, (parseInt(h.slice(1), 16) >> 8) & 255, parseInt(h.slice(1), 16) & 255];
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function lum(rgb) {
  const ch = rgb.map((v) => {
    const s = clamp(v) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function apply(m, rgb) {
  return [
    m[0] * rgb[0] + m[1] * rgb[1] + m[2] * rgb[2],
    m[3] * rgb[0] + m[4] * rgb[1] + m[5] * rgb[2],
    m[6] * rgb[0] + m[7] * rgb[1] + m[8] * rgb[2],
  ];
}
/** Worst ratio across normal vision and the three simulations. */
function worst(a, b) {
  let w = ratio(a, b);
  for (const k of Object.keys(CVD)) w = Math.min(w, ratio(apply(CVD[k], a), apply(CVD[k], b)));
  return w;
}

// ⚠️ THESE WERE TYPED HERE AND HAD ROTTED. This file kept `#0B0F14` / `#F2D479` — an EARLIER
// palette, from before the Dev's purple ground — for long enough that re-running it, which is the
// entire reason it is kept, would have measured a game that no longer exists. Same defect as a
// mutation anchor matching nothing: a tool nobody re-runs cannot tell you it has gone stale.
//
// So it READS them now. `render/palette.ts` is the source, it is a `.ts` this `.cjs` cannot import,
// and a regex over three named exports is the smallest thing that cannot drift.
function fromPalette(name) {
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'app', 'js', 'render', 'palette.ts'), 'utf8',
  );
  const found = new RegExp('export const ' + name + " = '(#[0-9A-Fa-f]{6})'").exec(src);
  if (!found) throw new Error('palette.ts no longer exports ' + name + ' as a hex literal');
  return found[1];
}

const INK = hex(fromPalette('INK'));
const LIT = hex(fromPalette('TILE_LIT'));
const GROUND = hex(fromPalette('GROUND'));

// Blue-grey family, so the mat stays cool against the warm lit tile: hue is a second channel on
// top of the luminance one, which costs nothing and helps anyone who has both.
const candidates = [];
for (let r = 60; r <= 160; r += 4) {
  for (let g = r; g <= Math.min(200, r + 30); g += 4) {
    for (let b = g; b <= Math.min(220, g + 40); b += 4) {
      candidates.push([r, g, b]);
    }
  }
}

const FLOOR = 3.0;      // WCAG 1.4.11, non-text contrast
const ok = [];
for (const mat of candidates) {
  const vsGround = worst(mat, GROUND);
  const vsLit = worst(LIT, mat);
  if (vsGround < FLOOR || vsLit < FLOOR) continue;
  // Prefer the candidate that is most BALANCED: a mat that screams against the ground while
  // barely separating from the lit tile has spent its whole budget on the wrong distinction.
  ok.push({ mat, vsGround, vsLit, balance: Math.min(vsGround, vsLit) });
}

ok.sort((a, b) => b.balance - a.balance);
console.log('candidates clearing ' + FLOOR + ':1 on both, worst-case across normal + 3 CVD modes:', ok.length);
console.log();
for (const c of ok.slice(0, 8)) {
  console.log(
    toHex(c.mat).padEnd(9),
    'vs ground ' + c.vsGround.toFixed(2).padStart(5),
    ' lit vs it ' + c.vsLit.toFixed(2).padStart(5),
    ' weakest link ' + c.balance.toFixed(2),
  );
}

const best = ok[0];
if (best) {
  console.log();
  console.log('--- full table for ' + toHex(best.mat) + ' ---');
  const rows = [['mode', 'ink/lit', 'lit/unlit', 'unlit/ground']];
  for (const k of ['normal', 'protan', 'deuter', 'tritan']) {
    const m = k === 'normal' ? null : CVD[k];
    const f = (c) => (m ? apply(m, c) : c);
    rows.push([k,
      ratio(f(INK), f(LIT)).toFixed(2),
      ratio(f(LIT), f(best.mat)).toFixed(2),
      ratio(f(best.mat), f(GROUND)).toFixed(2)]);
  }
  for (const r of rows) console.log(r[0].padEnd(8), r[1].padStart(8), r[2].padStart(10), r[3].padStart(13));
}

// ========================= AND THE QUESTION A SEARCH CANNOT ANSWER =========================
// ⚠️ THE ENGINE OFFERS THREE HIGH-CONTRAST LEVELS NAMED AFTER RATIOS — `hc3`, `hc45`, `hc7` — and
// whether this mat can reach them is arithmetic, not taste. It is printed beside the search because
// otherwise the search gets run three times to discover it the slow way.
//
// The mat is three stacked surfaces: ground, unlit tile, lit tile. Write their luminances
// Lg < Li < Ll. Then
//
//     ratio(unlit, ground) x ratio(lit, unlit)
//       = ((Li+.05)/(Lg+.05)) x ((Ll+.05)/(Li+.05))
//       = (Ll+.05)/(Lg+.05)
//       = ratio(lit, ground)
//
// The middle term cancels. The product of the two steps is ALWAYS the whole climb, wherever the
// middle surface sits — and the whole climb is capped at 21, white on black.
//
// So asking both steps to clear N asks the climb to be at least N squared, and the cap decides it.
// Nothing about hue, and nothing a search could find.
const CLIMB = ratio(LIT, GROUND);
console.log();
console.log('--- can this mat reach the engine\'s contrast levels? ---');
console.log('climb (lit vs ground):', CLIMB.toFixed(2), '  ceiling (white on black): 21.00');
for (const [name, floor] of [['hc3', 3], ['hc45', 4.5], ['hc7', 7]]) {
  const needed = floor * floor;
  const verdict = needed > 21 ? 'IMPOSSIBLE for any palette'
    : needed > CLIMB ? 'needs a darker ground or a brighter lit tile'
      : 'already met by the shipped palette';
  console.log(name.padEnd(5), 'both steps at', String(floor).padStart(3),
    '-> climb >=', needed.toFixed(2).padStart(6), ' ', verdict);
}
console.log();
console.log('A level the climb cannot carry is not a level to abandon: it is a level whose');
console.log('distinction has to move OFF luminance -- an outline, a fill pattern -- because the two');
console.log('steps compete for one budget and the budget is fixed.');

// ========================= AND WHAT hc45 WOULD ACTUALLY COST =========================
// ⚠️ THE ARITHMETIC ABOVE IS NORMAL VISION, AND THE FLOOR IS THE WORST CASE ACROSS FOUR. That gap is
// not academic: a ground of #110018 gives a climb of exactly 20.25 — the number hc45 needs on paper
// — and NO unlit tile clears 4.5 on both sides once the three matrices are applied. The paper said
// yes and the measurement said no, which is the whole reason this file searches instead of solving.
//
// So the honest form of the question is not "is hc45 possible" but "what does it cost the ground",
// and that has a measured answer.
const HC45 = 4.5;
console.log();
console.log('--- what hc45 costs the ground (worst case across normal + 3 CVD modes) ---');
for (const gh of ['#1C041B', '#160317', '#110018', '#0E0013', '#0A000E', '#000000']) {
  const g = hex(gh);
  let best = null;
  for (let r = 0; r <= 255; r += 3) {
    for (let gg = 0; gg <= 255; gg += 3) {
      for (let b = 0; b <= 255; b += 3) {
        const mat = [r, gg, b];
        const vsGround = worst(mat, g);
        if (vsGround < HC45) continue;
        const vsLit = worst(LIT, mat);
        if (vsLit < HC45) continue;
        const balance = Math.min(vsGround, vsLit);
        if (!best || balance > best.balance) best = { mat, vsGround, vsLit, balance };
      }
    }
  }
  const climb = ratio(LIT, g).toFixed(2).padStart(5);
  console.log(
    gh, 'climb', climb, '->',
    best
      ? 'mat ' + toHex(best.mat) + '  vs ground ' + best.vsGround.toFixed(2)
        + '  lit vs it ' + best.vsLit.toFixed(2)
      : 'NO unlit tile clears ' + HC45 + ' on both sides',
  );
}
console.log();
console.log('Read that column downwards: the purple ground does not have to GO, it has to get about');
console.log('twice as dark. #1C041B carries 2.2x the luminance hc45 can afford; #0E0013 is the first');
console.log('that works, and it is still purple. On pure black the mat can even keep a tint (#7B6F99),');
console.log('which is the opposite of what "high contrast means grey" would predict.');
