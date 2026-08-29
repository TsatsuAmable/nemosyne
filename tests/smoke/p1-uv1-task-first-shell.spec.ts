import { test, expect } from '@playwright/test';

test.describe('P1-UV1 task-first production shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#analyst-journey-controls')).toBeVisible({ timeout: 15_000 });
  });

  test('fresh boot makes investigation context and bounded tasks primary', async ({ page }) => {
    const shell = page.locator('#analyst-journey-controls');
    await expect(shell).toHaveAttribute('data-shell', 'task-first');
    await expect(page.locator('#analyst-workspace-context')).toContainText('Dataset');
    await expect(page.locator('#analyst-primary-tasks button')).toHaveCount(3);
    await expect(page.locator('#analyst-primary-tasks')).toContainText('Explore another dataset');
    await expect(page.locator('#analyst-primary-tasks')).toContainText('Find anomalies');
    await expect(page.locator('#analyst-primary-tasks')).toContainText('Record observation');

    await expect(page.locator('#nemosyne-loader')).toBeHidden();
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#telemetry')).toBeHidden();
    await expect(page.locator('#analyst-investigation-tools')).not.toHaveAttribute('open', '');
  });

  test('dataset chooser is summoned on demand and the semantic journey remains live', async ({ page }) => {
    await page.locator('#analyst-choose-data').click();
    await expect(page.locator('#nemosyne-loader')).toBeVisible();
    await expect(page.locator('#analyst-journey-status')).toContainText('Dataset chooser opened');

    await page.locator('#analyst-choose-data').click();
    await expect(page.locator('#nemosyne-loader')).toBeHidden();

    const before = await page.locator('#analyst-workspace-context').textContent();
    await page.locator('#analyst-load-sample').click();
    await expect(page.locator('#analyst-journey-status')).toContainText('Loaded', { timeout: 10_000 });
    await expect(page.locator('#analyst-representation-outcome')).toContainText('Moneta selected');
    const after = await page.locator('#analyst-workspace-context').textContent();
    expect(after).not.toBe(before);
  });
});
