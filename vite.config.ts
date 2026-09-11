import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { playwright } from '@vitest/browser-playwright';

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
export default defineConfig({
  root: 'app',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
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
