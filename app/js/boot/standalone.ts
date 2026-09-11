// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/standalone — the shell that runs this game as its own page.
//
// ========================= WHY THERE IS A SHELL AT ALL =========================
// ⚠️ THIS FILE IS TWO LINES AND THE POINT IS THAT IT EXISTS. Until now `boot/main.ts` ended with a
// bare `boot()`: importing the module started the game. ADR-0139 §2 and spec decision D14 both
// forbid that for a cartridge, and for the same reason — a module that boots on import cannot be
// one of six on a page. It cannot be instantiated twice, it cannot be torn down, and anything it
// did at import time has already happened before anyone decided it should.
//
// So the side effect moves HERE, and `main.ts` becomes something that has to be called.
//
// ========================= WHAT THIS WILL GROW INTO =========================
// 📌 ADR-0140 §2: the standalone shell is «about thirty lines» — it calls `createGame`, builds a
// `ctx`, calls the game's factory and runs the loop; the platform is simply a different shell around
// the same factory. Today `main.ts` still does all four itself, so this file only carries the call.
// The rest moves out of `main.ts` as F1 and F3 proceed, and this is where it lands.
//
// ⚠️ AND THE ORDER OF THAT MATTERS MORE THAN THE SIZE. Splitting the composition root in one step
// would mean moving the `createGame` call, the host, the `ctx` and the loop at once, through 788
// lines of closures that all see each other. One observable change at a time is what keeps the game
// working while the shape changes underneath it.

import { boot } from './main.ts';

boot();
