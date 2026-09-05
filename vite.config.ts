import { defineConfig } from 'vitest/config'; // not 'vite': vitest/config is what types the `test` field
import { playwright } from '@vitest/browser-playwright';

// ============================ THE ENGINE IS A LINKED DEPENDENCY ============================
// `file:../SP-the-inclusionist-tracer` makes npm symlink the engine into node_modules, and the
// engine's `prepare` script builds `dist-pkg/` on install. So the `exports` map resolves to
// COMPILED `.js` with sibling `.d.ts` — which is why every import here ends in `.js`, never `.ts`.
//
// `exclude` keeps Vite from pre-bundling the linked package. It matters because the symlinked
// tree is edited in place during development: pre-bundling would freeze a copy and quietly serve
// stale engine code after the engine is rebuilt.
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
