import { test, expect, type Page } from '@playwright/test';

/**
 * UI/UX adversarial smoke for the production InvestigationShell.
 *
 * These checks intentionally target user-visible capabilities and stable
 * semantic controls. They must not preserve the retired AnalystJourneyControls
 * DOM contract merely to keep an obsolete selector green.
 */

async function waitForBoot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#telemetry')).toContainText('LAYOUT:', { timeout: 15_000 });
  await expect(page.locator('#investigation-shell')).toBeVisible({ timeout: 15_000 });
}

async function cycleDataset(page: Page): Promise<void> {
  const indicator = page.locator('#dataset-indicator');
  const before = await indicator.textContent();
  await page.locator('#action-load-sample').click();
  await expect
    .poll(async () => indicator.textContent(), { timeout: 10_000 })
    .not.toBe(before);
}

test.describe('UI/UX Adversarial Review - Core User Flows', () => {
  test('cold start exposes context and bounded actions without diagnostic chrome', async ({ page }) => {
    await waitForBoot(page);

    await expect(page.locator('#status-message')).toHaveText('Ready');
    await expect(page.locator('#dataset-indicator')).toContainText('Dataset');
    await expect(page.locator('#primary-actions > nms-button')).toHaveCount(3);
    await expect(page.locator('body canvas')).toBeVisible();
    await expect(page.locator('#telemetry')).toBeHidden();
    await expect(page.locator('#overlay')).toBeHidden();
  });

  test('dataset switching updates visible context and never strands a loading state', async ({ page }) => {
    await waitForBoot(page);
    await cycleDataset(page);
    const first = await page.locator('#dataset-indicator').textContent();
    await cycleDataset(page);
    const second = await page.locator('#dataset-indicator').textContent();
    expect(second).not.toBe(first);
    await expect(page.locator('#status-message')).not.toContainText('loading', { ignoreCase: true });
  });

  test('analysis and observation remain reachable from the primary task surface', async ({ page }) => {
    await waitForBoot(page);
    await page.locator('#action-run-analysis').click();
    await expect
      .poll(async () => page.locator('#status-message').textContent(), { timeout: 10_000 })
      .not.toBe('Ready');

    await page.locator('#action-mark-moment').click();
    await expect(page.locator('#status-message')).toContainText('Observation recorded');
  });

  test('advanced representation assessment is progressively disclosed and explicit on refusal', async ({ page }) => {
    await waitForBoot(page);
    const tools = page.locator('#investigation-shell aside details');
    await expect(tools).not.toHaveAttribute('open', '');
    await tools.locator('summary').click();
    await page.locator('#max-elements').fill('1');
    await page.locator('#assess-btn').click();

    const modal = page.locator('nms-modal[title="Representation Assessment"]');
    await expect(modal).toHaveAttribute('open', '');
    await expect(modal).toContainText('No feasible representation');
    await expect(page.locator('#status-message')).toContainText('NIL outcome recorded');
  });

  test('settings is a live presentation command rather than an unsupported application intent', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await waitForBoot(page);

    await page.locator('#settings-btn').click();
    await expect(page.locator('#status-message')).toContainText('Settings opened');
    expect(pageErrors).toEqual([]);
  });
});

test.describe('UI/UX Adversarial Review - Accessibility & Inclusive Design', () => {
  test('text scaling keeps the shell usable without horizontal document overflow', async ({ page }) => {
    await waitForBoot(page);

    for (const scale of [0.75, 1, 1.5, 2]) {
      await page.evaluate((value) => {
        document.documentElement.style.fontSize = `${16 * value}px`;
      }, scale);
      await page.waitForTimeout(100);
      await expect(page.locator('#investigation-shell')).toBeVisible();
      await expect(page.locator('#action-load-sample')).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 10);
    }
  });

  test('keyboard access reaches a real shell control and command palette', async ({ page }) => {
    await waitForBoot(page);

    await page.keyboard.press('Tab');
    await expect
      .poll(() => page.evaluate(() => document.activeElement !== document.body))
      .toBe(true);

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    const palette = page.locator('nms-command-palette');
    await expect(palette).toHaveAttribute('open', '');
    await expect(palette.locator('.search-input')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).not.toHaveAttribute('open', '');
  });

  test('reduced-motion preference suppresses modal motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await waitForBoot(page);

    const tools = page.locator('#investigation-shell aside details');
    await tools.locator('summary').click();
    await page.locator('#max-elements').fill('1');
    await page.locator('#assess-btn').click();

    const modal = page.locator('nms-modal[title="Representation Assessment"]');
    await expect(modal).toHaveAttribute('open', '');
    const motion = await modal.locator('.modal-content').evaluate((element) => {
      const style = getComputedStyle(element);
      return { animationName: style.animationName, animationDuration: style.animationDuration };
    });
    expect(motion.animationName).toBe('none');
    expect(motion.animationDuration === '0s' || motion.animationDuration === '').toBe(true);
  });

  test('critical status remains textual when color information is removed', async ({ page }) => {
    await waitForBoot(page);
    await page.addStyleTag({ content: 'html { filter: grayscale(100%); }' });
    await page.locator('#action-mark-moment').click();
    await expect(page.locator('#status-message')).toContainText('Observation recorded');
  });
});

test.describe('UI/UX Adversarial Review - Error Handling & Performance', () => {
  test('boot telemetry does not expose a raw runtime error', async ({ page }) => {
    await waitForBoot(page);
    const telemetry = (await page.locator('#telemetry').textContent()) ?? '';
    expect(telemetry).not.toMatch(/(?:TICK )?ERROR:/i);
  });

  test('repeated dataset cycling keeps one shell and one set of primary controls', async ({ page }) => {
    await waitForBoot(page);
    for (let i = 0; i < 5; i += 1) await cycleDataset(page);
    await expect(page.locator('#investigation-shell')).toHaveCount(1);
    await expect(page.locator('#primary-actions > nms-button')).toHaveCount(3);
  });

  test('60 animation frames continue to arrive during an ordinary shell session', async ({ page }) => {
    await waitForBoot(page);
    const frameTimes = await page.evaluate(() => new Promise<number[]>((resolve) => {
      const times: number[] = [];
      let previous = performance.now();
      const tick = (now: number) => {
        times.push(now - previous);
        previous = now;
        if (times.length < 60) requestAnimationFrame(tick);
        else resolve(times);
      };
      requestAnimationFrame(tick);
    }));
    expect(frameTimes).toHaveLength(60);
    expect(frameTimes.every(Number.isFinite)).toBe(true);
  });
});
