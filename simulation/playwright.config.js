import { defineConfig } from '@playwright/test';
import { devices } from './lib/devices.js';

export default defineConfig({
  testDir: './agents',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 4,
  timeout: 300_000, // 5 min — Slow 4G persona needs 144s+ for 27MB fetch
  reporter: [
    ['list'],
    ['json', { outputFile: './output/test-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    cwd: '..',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chef',
      testMatch: 'chef.spec.js',
      use: {
        ...devices.iPhone15Pro,
      },
    },
    {
      name: 'home-cook',
      testMatch: 'home-cook.spec.js',
      use: {
        ...devices.iPhone12,
      },
    },
    {
      name: 'curious-browser',
      testMatch: 'curious-browser.spec.js',
      use: {
        ...devices.iPhoneSE2,
      },
    },
    {
      name: 'cocktail-builder',
      testMatch: 'cocktail-builder.spec.js',
      use: {
        ...devices.iPhone13,
      },
    },
    {
      name: 'r19-insight-drawer',
      testMatch: 'r19-insight-drawer.spec.js',
      // Desktop viewport — the drawer is intentionally desktop-only.
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
