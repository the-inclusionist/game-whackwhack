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

const INK = hex('#1A1206');
const LIT = hex('#F2D479');
const GROUND = hex('#0B0F14');

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
