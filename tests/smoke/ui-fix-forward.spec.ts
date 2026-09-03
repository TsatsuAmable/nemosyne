import { test, expect, type Page } from '@playwright/test';

async function waitForShell(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#investigation-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('body canvas').first()).toBeVisible({ timeout: 15_000 });
}

test.describe('post-UI fix-forward falsifiers', () => {
  test('empty investigation shell canvas region does not intercept Three.js pointer delivery', async ({ page }) => {
    await waitForShell(page);

    const canvas = page.locator('body canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const position = {
      x: Math.min(box.width - 1, Math.max(320, box.width * 0.65)),
      y: Math.min(box.height - 1, box.height * 0.5),
    };

    // `trial` performs Playwright's real pointer actionability/hit-target check
    // without mutating the scene. This fails if a transparent shell layer sits
    // above the Three.js canvas at the chosen central workspace point.
    await canvas.click({ position, trial: true });
  });

  test('command palette reopening starts from a fresh empty query and full command set', async ({ page }) => {
    await waitForShell(page);

    const shortcut = process.platform === 'darwin' ? 'Meta+K' : 'Control+K';
    await page.keyboard.press(shortcut);

    const palette = page.locator('nms-command-palette');
    await expect(palette).toHaveAttribute('open', '');
    const input = palette.locator('.search-input');
    await input.fill('open .nemosyne');
    await expect(palette).toContainText('Open .nemosyne');
    await expect(palette).not.toContainText('Explore another dataset');

    await page.keyboard.press('Escape');
    await expect(palette).not.toHaveAttribute('open', '');

    await page.keyboard.press(shortcut);
    await expect(palette).toHaveAttribute('open', '');
    await expect(palette.locator('.search-input')).toHaveValue('');
    await expect(palette).toContainText('Open .nemosyne');
    await expect(palette).toContainText('Explore another dataset');
    await expect(palette).toContainText('Find anomalies');
  });
});
