import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { NemosynePackageManager } from '../../src/session/NemosynePackage.ts';

async function openReplayCommand(page: Page): Promise<void> {
  await page.evaluate(() => {
    const palette = document.querySelector('nms-command-palette') as HTMLElement & { show?: () => void };
    palette?.show?.();
  });
  const search = page.locator('nms-command-palette .search-input');
  await expect(search).toBeVisible();
  await search.fill('Replay investigation');
  await page.keyboard.press('Enter');
}

test('desktop investigation shell completes the visible evidence and export/replay path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#investigation-shell')).toBeVisible();
  await expect(page.locator('#status-message')).toHaveText('Ready');

  const initialDataset = await page.locator('#dataset-indicator').textContent();
  await page.locator('#action-load-sample').click();
  await expect
    .poll(async () => page.locator('#dataset-indicator').textContent(), { timeout: 10_000 })
    .not.toBe(initialDataset);

  const tools = page.locator('#investigation-shell aside details').filter({ hasText: 'More tools' });
  await tools.locator('summary').click();
  await expect(tools).toHaveAttribute('open', '');
  await page.locator('#max-elements').fill('1');
  await page.locator('#assess-btn').click();
  const assessment = page.locator('nms-modal[title="Representation Assessment"]');
  await expect(assessment).toHaveAttribute('open', '');
  await expect(assessment).toContainText('No feasible representation');
  await expect(page.locator('#status-message')).toContainText('NIL outcome recorded');
  await page.keyboard.press('Escape');

  await page.locator('#action-run-analysis').click();
  await expect
    .poll(async () => page.locator('#status-message').textContent(), { timeout: 10_000 })
    .not.toBe('Ready');

  await page.locator('#action-mark-moment').click();
  await expect(page.locator('#status-message')).toContainText('Observation recorded');

  const download = page.waitForEvent('download');
  await page.locator('#export-btn').click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toBe('nemosyne-investigation.nemosyne');
  const artifactPath = await artifact.path();
  expect(artifactPath).not.toBeNull();
  const validPackage = new Uint8Array(await readFile(artifactPath!));
  await expect(page.locator('#status-message')).toContainText('Investigation exported');

  await openReplayCommand(page);
  const replayModal = page.locator('nms-modal[title="Replay Investigation"]');
  await expect(replayModal).toHaveAttribute('open', '');
  const packageInput = replayModal.locator('#package-input');
  const replayButton = replayModal.locator('#replay-btn');
  const replayStatus = replayModal.locator('#replay-status');

  await packageInput.setInputFiles({
    name: 'verified.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(validPackage),
  });
  await expect(replayButton).toBeEnabled();
  await replayButton.click();
  await expect(replayStatus).toContainText(/Replay verified|Replay verification failed/, { timeout: 15_000 });

  const payload = NemosynePackageManager.unpack(validPackage);
  const tamperedPackage = NemosynePackageManager.pack({
    ...payload,
    manifest: {
      ...payload.manifest,
      investigationDigest: 'tampered-investigation-digest',
    },
  });
  await packageInput.setInputFiles({
    name: 'tampered.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(tamperedPackage),
  });
  await replayButton.click();
  await expect(replayStatus).toContainText('Replay verification failed', { timeout: 15_000 });
  await expect(replayStatus).toContainText('Source investigation unchanged');
});
