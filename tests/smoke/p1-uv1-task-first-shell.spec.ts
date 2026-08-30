import { test, expect } from '@playwright/test';

test.describe('P1-UV1 task-first production shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#investigation-shell')).toBeVisible({ timeout: 15_000 });
  });

  test('fresh boot makes investigation context and bounded tasks primary', async ({ page }) => {
    const shell = page.locator('#investigation-shell');
    await expect(page.locator('#dataset-indicator')).toContainText('Dataset');
    await expect(shell.locator('#primary-actions > nms-button')).toHaveCount(3);
    await expect(shell.locator('#primary-actions')).toContainText('Explore another dataset');
    await expect(shell.locator('#primary-actions')).toContainText('Find anomalies');
    await expect(shell.locator('#primary-actions')).toContainText('Record observation');

    await expect(page.locator('#nemosyne-loader')).toBeHidden();
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#telemetry')).toBeHidden();
    await expect(shell.locator('aside details')).not.toHaveAttribute('open', '');
  });

  test('dataset cycling is an explicit task and investigation context remains live', async ({ page }) => {
    const indicator = page.locator('#dataset-indicator');
    const before = await indicator.textContent();

    await page.locator('#action-load-sample').click();
    await expect
      .poll(async () => indicator.textContent(), {
        timeout: 10_000,
        message: 'dataset indicator reflects the semantic dataset-cycle intent',
      })
      .not.toBe(before);

    await expect(page.locator('#nemosyne-loader')).toBeHidden();
    await expect(page.locator('#status-message')).not.toContainText('loading', { ignoreCase: true });
    await expect(page.locator('body canvas')).toBeVisible();
  });
});
