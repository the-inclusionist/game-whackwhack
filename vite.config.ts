import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { playwright } from '@vitest/browser-playwright';
import { VitePWA } from 'vite-plugin-pwa';

// ============================ THE ENGINE COMES FROM THE REGISTRY ============================
// ⚠️ IT WAS `file:../SP-the-inclusionist-tracer` — a symlink into a sibling working tree — until the
// engine was published to npm on 2026-09-06. The dependency is now the pinned version `9.0.0`,
// resolved from the registry with an integrity hash. Its `exports` map points at COMPILED `.js`
// with sibling `.d.ts`, which is why every import here ends in `.js` and never `.ts`.
//
// Two things went away with the symlink, and both were hazards rather than conveniences. An
// `npm install` here used to re-run the ENGINE's `prepare` and rebuild `dist-pkg/` from whatever
// state another session had that tree in — which is how a contract change once arrived here
// unannounced, mid-session. And a stale pre-bundle could serve old engine code after a rebuild,
// which is what `exclude` below was for.
//
// `exclude` stays: the engine is ESM that needs no pre-bundling, and excluding it keeps the
// dependency graph honest at dev time. Its ORIGINAL reason is gone, and saying so here is cheaper
// than the next reader inferring a symlink that no longer exists.
// ============================ TWO TARGETS, ONE TREE (ADR-0140) ============================
// ⚠️ A GAME IS A STANDALONE PWA *AND* A CARTRIDGE, and both are built from this file. What differs
// is not the game — it is who calls it and what travels with it:
//
//   app (default)  `app/index.html` -> `boot/standalone.ts`, engine and Zdog BUNDLED, `dist/`
//   lib (--mode lib)  `app/js/index.ts`, engine and Zdog EXTERNAL, `dist-lib/`, no HTML
//
// 📌 EXTERNAL IS THE WHOLE POINT OF THE SECOND ONE. ADR-0117: «a cartridge declares no delivery».
// Bundling the engine into the lib would put one copy per cartridge into a platform that already
// ships it once — and a bundler would report it as this game's weight, six times over.
//
// ⚠️ AND THE GATE THAT KEEPS THIS TRUE IS CI BUILDING BOTH. A target nobody builds breaks quietly
// and stays broken until the platform tries to install it, which is the worst moment to find out.
const LIB = process.env.npm_lifecycle_event === 'build:lib';

/*
 * ========================= THE STANDALONE PWA (ADR-0140) =========================
 * ⚠️ THE RECORD DECIDED THIS AND THE DEV SAID IT PLAINLY on 2026-09-11: «the games have to work as
 * their own PWA». ADR-0117 had written «A GAME IS A CARTRIDGE, NOT A PWA» and ADR-0140 supersedes
 * exactly that clause and nothing else — because the two are answering different questions. A
 * standalone build DEPLOYED FOR CHILDREN would be a second origin, a second service worker and a
 * second set of preferences, and every word of ADR-0117 would apply to it. A standalone build that
 * exists for whoever works on this repository is not a unit of installation for anybody.
 *
 * 📌 SO IT IS A DEVELOPMENT, TEST, AUDIT AND DEMONSTRATION ROUTE, and it still has to work offline:
 * ADR-0010 pillar 1 is weak school hardware and the network that comes with it, and a demonstration
 * that needs the network is a demonstration that fails in the room it was built for.
 *
 * ⚠️ AND IT IS ABSENT FROM THE LIB TARGET, which is the other half of the same decision: «no HTML,
 * no service worker». A cartridge that installed a service worker would be claiming an origin that
 * belongs to the platform.
 */
const PWA = LIB ? [] : [VitePWA({
  registerType: 'autoUpdate',
  workbox: { globPatterns: ['**/*.{js,css,html,woff2}'] },
  /*
   * ⚠️ EVERY FIELD BELOW IS DECLARED BECAUSE ABSENCE IS NOT SILENCE. The plugin fills what a
   * manifest omits, and the platformer measured what it fills with: `"lang":"en"` and `"scope":"/"`.
   * Not declaring is letting somebody else decide, and both of those defaults are wrong here.
   */
  manifest: {
    name: 'WhackWhack Schoolution',
    short_name: 'WhackWhack',
    /*
     * THE PRODUCT IS IN BRAZILIAN PORTUGUESE, and this is the field assistive technology reads to
     * pick a voice. With `en` a screen reader announces «Colete: números pares» with English
     * phonemes to a child who is learning to read — which is this game's child exactly.
     */
    lang: 'pt-BR',
    dir: 'ltr',
    /*
     * RELATIVE, never `/`. The plugin's default claims the WHOLE ORIGIN, so anything else served on
     * the same domain falls under this service worker. Under ADR-0117 the origin belongs to the
     * platform and not to one of six games, so claiming it is the wrong statement even while
     * nothing else is there. `./` resolves against the manifest and follows wherever it is served.
     */
    scope: './',
    /*
     * THE IDENTITY, so the browser knows a fresh install is the SAME application. Without it the
     * identity is the `start_url`, and changing that one day would put a second installation beside
     * the one a child already had, with her scores on the other side of it.
     */
    id: './',
    /*
     * ⚠️ AND `start_url` TOO, WHICH THE PLUGIN LEFT AT `/` — measured in the generated manifest, not
     * assumed. It is the same claim on the whole origin that `scope` was talked out of two fields
     * up, and leaving one of the pair pointing at the root while the other is relative is worse
     * than either alone: the browser would open a URL outside the scope it was just given.
     */
    start_url: './',
    /*
     * IN PORTUGUESE FOR THE SAME REASON AS `lang`. It comes from `package.json`'s `description`
     * otherwise — English, as the convention for ARTEFACTS requires — and it shows up in the
     * device's application list, which is PRODUCT and not artefact.
     */
    description: 'Um jogo de martelar em que a criança colhe só o que está CERTO entre as lajes '
      + 'acesas: pares, múltiplos de 3, múltiplos de 4. Feito para quem joga com leitor de tela, '
      + 'só com o teclado, ou com o tempo que precisar.',
    display: 'standalone',
    // 📏 The ground the whole palette was measured against (`render/palette.ts`), not a colour
    // chosen here: the browser paints this behind the game while it loads, and any other value
    // would be a flash of a colour this game does not use.
    background_color: '#1C041B',
    theme_color: '#1C041B',
  },
})];

export default defineConfig({
  root: 'app',
  plugins: PWA,
  build: LIB
    ? {
      outDir: '../dist-lib',
      emptyOutDir: true,
      target: 'es2022',
      lib: { entry: 'js/index.ts', formats: ['es'], fileName: () => 'index.js' },
      rollupOptions: {
        // ⚠️ A PREFIX MATCH, not the bare name: this game imports `@the-inclusionist/engine`,
        // `.../core/rng.js`, `.../render/viz-axes.js` and five more deep paths. Listing only the
        // root would externalise one of nine and bundle the rest without a word.
        external: [/^@the-inclusionist\/engine/, 'zdog'],
      },
    }
    : { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  optimizeDeps: {
    exclude: ['@the-inclusionist/engine'],
    // Zdog is CommonJS, so it must be pre-bundled. Naming it here stops Vitest's browser mode
    // from discovering it mid-run and reloading the page under a suite that is already going.
    include: ['zdog'],
  },

  test: {
    projects: [
      {
        // Pure logic: the category predicates, wave composition, the timing curve, the defeat
        // modes, the declaration. Everything here must run without a DOM — which is also the
        // pressure that keeps `rules/` free of the renderer.
        test: {
          name: 'node',
          root: import.meta.dirname,
          // Forward slashes on purpose: a path built with join() on Windows yields backslashes,
          // the glob then matches ZERO files, and the suite passes by finding nothing to run.
          include: ['tests/**/*.node.test.{js,ts}'],
          environment: 'node',
        },
      },
      {
        // Anything that needs a real canvas or a real focus ring: the Zdog surface, the Pixi
        // composite, the DOM grid mirror, keyboard navigation, aria-live announcements.
        test: {
          name: 'browser',
          root: import.meta.dirname,
          include: ['tests/**/*.browser.test.{js,ts}'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
