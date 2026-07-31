import { defineConfig } from 'vitest/config';

// Local vitest config for the Cloud Functions package. The repo-root
// vitest config targets browser-side JS/JSX tests under src/**; this
// config narrows scope to functions' own TypeScript tests.
export default defineConfig({
  // Vite searches upward for a PostCSS config and finds the repo root's
  // postcss.config.js, whose tailwindcss plugin isn't installed under
  // functions/ — which aborted the whole run with "Failed to load PostCSS
  // config". These are node-side TS tests with no CSS; opt out explicitly.
  css: { postcss: {} },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'lib/**'],
    environment: 'node',
  },
});
