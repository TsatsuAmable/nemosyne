import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { NemosynePackageManager } from '../../src/session/NemosynePackage.ts';

async function openPortableCommand(page: Page, bytes: Uint8Array): Promise<void> {
  await page.evaluate(() => {
    const palette = document.querySelector('nms-command-palette') as HTMLElement & { show?: () => void };
    palette?.show?.();
  });
  const search = page.locator('nms-command-palette .search-input');
  await expect(search).toBeVisible();
  await search.fill('Open .nemosyne');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'investigation.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
}

test('desktop investigation shell completes the visible evidence and export/reopen path', async ({ page }) => {
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
  expect(artifact.suggestedFilename()).toMatch(/^nemosyne-investigation-\d{4}-\d{2}-\d{2}\.nemosyne$/);
  const artifactPath = await artifact.path();
  expect(artifactPath).not.toBeNull();
  const validPackage = new Uint8Array(await readFile(artifactPath!));
  const continuityFeedback = page.locator('#continuity-feedback');
  await expect(continuityFeedback).toContainText('Portable investigation ready');

  await openPortableCommand(page, validPackage);
  await expect(continuityFeedback).toContainText(
    /Investigation opened and verified|Verification failed/,
    { timeout: 15_000 },
  );

  const payload = NemosynePackageManager.unpack(validPackage);
  const tamperedPackage = NemosynePackageManager.pack({
    ...payload,
    manifest: {
      ...payload.manifest,
      investigationDigest: 'tampered-investigation-digest',
    },
  });
  const datasetBeforeTamper = await page.locator('#dataset-indicator').textContent();
  await openPortableCommand(page, tamperedPackage);
  await expect(continuityFeedback).toContainText('Verification failed', { timeout: 15_000 });
  expect(await page.locator('#dataset-indicator').textContent()).toBe(datasetBeforeTamper);
});
