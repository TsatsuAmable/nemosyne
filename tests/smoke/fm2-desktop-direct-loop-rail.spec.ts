import { test, expect } from '@playwright/test';

test('desktop Review & Recovery renders direct-loop provenance without fabricated alternatives or device claims', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#investigation-shell')).toBeVisible();
  await expect(page.locator('#status-message')).toHaveText('Ready');

  const rail = page.locator('#desktop-review-recovery-rail');
  await expect(rail).toHaveCount(1);
  await rail.locator('summary').click();
  await expect(rail).toHaveAttribute('open', '');
  await expect(page.locator('#review-direct-alternatives'))
    .toHaveText('Direct-loop alternatives · none recorded');
  await expect(page.locator('#review-direct-history'))
    .toHaveText('Direct-loop history · no critique-to-alternative branches');
  await expect(page.locator('#review-direct-variants'))
    .toHaveText('Compiled direct variants · none recorded');

  // A real normal-shell analysis is not evidence that FM2 produced an
  // alternative. The rail must not infer a direct branch from legacy Moneta.
  await page.locator('#action-load-sample').click();
  await page.locator('#action-run-analysis').click();
  await expect(page.locator('#status-message')).toContainText('Evidence ready', { timeout: 15_000 });
  await expect(page.locator('#review-direct-alternatives'))
    .toHaveText('Direct-loop alternatives · none recorded');
  await expect(page.locator('#review-direct-history'))
    .toHaveText('Direct-loop history · no critique-to-alternative branches');
  await expect(page.locator('#review-direct-variants'))
    .toHaveText('Compiled direct variants · none recorded');

  // Existing data-first review still operates in the same surface: no new
  // floating panel and no control that can promote an unverified variant.
  await expect(page.locator('#review-representation')).toContainText('Representation ·');
  await expect(page.locator('#review-alternatives')).toContainText('Alternatives ·');
  await expect(page.locator('#review-commit-remediation')).toHaveAttribute('disabled', '');
});
