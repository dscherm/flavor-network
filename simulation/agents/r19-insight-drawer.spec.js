/**
 * R19 Phase 1A + 4 E2E — InsightChip + InsightDrawer.
 *
 * Loads the Network tab, applies an Aroma filter, then exercises:
 *   1. InsightChip surfaces below the filter stack (R19-1).
 *   2. The `?` toggle opens the InsightDrawer (R19-5).
 *   3. All 5 sections render with the active filter state.
 *   4. The toggle closes the drawer on second click.
 *
 * Desktop viewport (1280x800) — the drawer is desktop-only by design.
 */

import { test, expect } from '@playwright/test';
import { bypassStartPage, advancePastLanding } from '../lib/metrics.js';

test.use({ viewport: { width: 1280, height: 800 } });

test('R19 — InsightChip + InsightDrawer surface with an active filter', async ({ page }) => {
  // Pre-seed flags (incl. flavor-tour-complete) so the Walkthrough
  // backdrop doesn't intercept the FilterPillRow clicks.
  await bypassStartPage(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await advancePastLanding(page, 'pairing');

  // Wait for the FilterPillRow to mount once the data finishes loading.
  const aromaPill = page.getByRole('checkbox', { name: /^Aroma$/i }).first();
  await aromaPill.waitFor({ state: 'visible', timeout: 120_000 });

  // --- Activate Aroma filter ---
  await aromaPill.click();

  // --- InsightChip (R19-1) should appear below the filter stack ---
  const insightChip = page.getByRole('note', { name: 'Layout insight' });
  await expect(insightChip).toBeVisible({ timeout: 10_000 });

  // --- Open the drawer (R19-5) ---
  const toggle = page.getByTestId('insight-drawer-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  const drawer = page.getByTestId('insight-drawer');
  await expect(drawer).toBeVisible();

  // --- All five sections render ---
  await expect(page.getByTestId('section-composition')).toBeVisible();
  await expect(page.getByTestId('section-bucket-dist')).toBeVisible();
  await expect(page.getByTestId('section-pull')).toBeVisible();
  await expect(page.getByTestId('section-cluster-matrix')).toBeVisible();
  await expect(page.getByTestId('section-suggested')).toBeVisible();

  // Composition section names the active filter chain.
  await expect(page.getByTestId('section-composition')).toContainText(/Aroma/);

  // --- Close the drawer ---
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(drawer).not.toBeVisible();
});
