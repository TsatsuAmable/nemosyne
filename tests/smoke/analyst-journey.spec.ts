import { test, expect } from '@playwright/test';

test('desktop analyst controls complete the visible evidence and export path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#analyst-journey-controls')).toBeVisible();
  await expect(page.locator('#analyst-journey-status')).toHaveText('Ready');

  await page.locator('#analyst-load-sample').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Loaded');

  await page.locator('#analyst-run-analysis').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Evidence ready');

  await page.locator('#analyst-mark-moment').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Observation recorded');

  const download = page.waitForEvent('download');
  await page.locator('#analyst-export-package').click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toBe('nemosyne-investigation.nemosyne');
  await expect(page.locator('#analyst-journey-status')).toContainText('Investigation exported');
});
