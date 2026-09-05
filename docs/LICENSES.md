# Licences and ownership

Mirrors `docs/LICENSES.md` in the engine. Read that one first; this file records only what is
specific to this game.

## 1. Ownership is the Municipality's, not the developer's

Software produced in the exercise of a public servant's duties belongs to the employer
(**Lei nº 9.609/1998, art. 4º**). Publication under the AGPL is therefore the subject of a
*request* — an act of the Executive — and not a decision of whoever wrote the code.

The package scope is `@the-inclusionist`, which names the container rather than the owner
(**ADR-0071**): a Prefeitura's name published by a servant *before* the act would be a public claim
on someone else's name. Ownership is declared **inside** — here, in `LICENSE`, and in the records —
which is exactly what this section is doing.

For the same reason no source file carries a copyright notice. The one-line
`// SPDX-License-Identifier: AGPL-3.0-or-later` header states the licence and asserts nothing about
who holds it.

## 2. Three regimes, not one

| What | Regime |
|---|---|
| Code | **AGPL-3.0-or-later** |
| Own art | **NOT FOSS** — author's right (Lei 9.610/1998), restricted use |
| Third-party content | its original licence, preserved |

The art is deliberately not FOSS: the requirement is that the characters never appear in adult
products, and a field-of-use restriction is incompatible with FOSS by construction (freedom 0, OSI
criterion 6).

⚠️ **This game currently ships no art at all.** Every tile, every digit and every mole is procedural
Zdog geometry generated from data in `app/js/render/`. There is no sprite directory, and none of the
engine's `app/public/assets/` is copied in. If that ever changes, this table starts applying.

## 3. Why AGPL and not GPL

The GPL binds whoever *conveys*, and running a service is not conveying. A supplier hosting the
classroom as a service would owe its source to nobody. **Section 13 of the AGPL** closes that.
See the engine's ADR-0064.

## 4. The original: si-em/whackwhack

This game is a **reimplementation from the rules**, not a port, and that is a legal necessity rather
than a preference.

<https://github.com/si-em/whackwhack> — by Simon Riisnæs Emmen — **ships no licence at all**.
Verified three ways on 2026-09-05: `"license": null` from the GitHub API, no `LICENSE`/`COPYING`
anywhere in the full tree, and no licence section in the README. The `package.json` carries neither
a `license` nor an `author` field. Absent a licence the default applies: **all rights reserved**.
Publishing on GitHub grants only what GitHub's Terms of Service grant — viewing and forking within
GitHub — and nothing more.

So the line drawn here is the one copyright itself draws, between **idea and expression**:

| Reused | Not reused |
|---|---|
| The rules: what lights, what ends a round | The 49 KB inline title SVG |
| The balance curve (`docs/GAME-RULES.md`) | The SCSS, the BEM class names, the palette |
| The 5×4 mat and the tilted board | The Vue components and their structure |
| The DDR framing as a genre reference | The favicon and PWA icon set |

A balance curve is a functional fact, and facts are not protected by copyright; the title artwork is
an artistic work, and the component tree is expression. **Not one byte of the original is in this
repository.** The rules were read, described in `docs/GAME-RULES.md`, and implemented from that
description.

Credit is given in `docs/CREDITS.md` as inspiration and a feature-parity reference — the same
treatment the chess game gives `juliangarnier/3D-Hartwig-chess-set`. Courtesy, not a licence
obligation.

## 5. Dependencies

| Package | Licence |
|---|---|
| `@the-inclusionist/engine` | AGPL-3.0-or-later — same owner |
| `zdog` | MIT © 2020 Metafizzy |
| `pixi.js` | MIT |

`pixi.js` is pinned to **7.4.2**, the exact version the engine uses. Two copies of PixiJS on one page
is a bug, not a fallback.
