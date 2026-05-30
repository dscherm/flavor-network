import { defineConfig } from 'vitest/config';

// Local vitest config for the Cloud Functions package. The repo-root
// vitest config targets browser-side JS/JSX tests under src/**; this
// config narrows scope to functions' own TypeScript tests.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'lib/**'],
    environment: 'node',
  },
});
