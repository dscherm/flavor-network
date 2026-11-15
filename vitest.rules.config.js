import { defineConfig } from 'vitest/config';

// Firestore rules tests. They need the Firestore emulator, so they are NOT part of `npm run gate`
// (the default vitest config only includes src/**). Run them with `npm run test:rules`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
