import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './agents',
  testMatch: 'cluster-screenshot.spec.js',
  timeout: 180_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    cwd: '..',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
