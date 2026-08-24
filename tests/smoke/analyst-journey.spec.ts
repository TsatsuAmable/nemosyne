import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { NemosynePackageManager } from '../../src/session/NemosynePackage.ts';

test('desktop analyst controls complete the visible evidence and export path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#analyst-journey-controls')).toBeVisible();
  await expect(page.locator('#analyst-journey-status')).toHaveText('Ready');
  await expect(page.locator('#analyst-replay-package')).toBeDisabled();

  await page.locator('#analyst-load-sample').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Loaded');
  await expect(page.locator('#analyst-representation-outcome')).toContainText('Moneta selected');

  await page.locator('#analyst-max-elements').fill('1');
  await page.locator('#analyst-assess-representation').click();
  await expect(page.locator('#analyst-representation-outcome')).toContainText(
    'NIL: no feasible representation',
  );
  await expect(page.locator('#analyst-journey-status')).toContainText('NIL outcome recorded');

  await page.locator('#analyst-run-analysis').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Evidence ready');

  await page.locator('#analyst-mark-moment').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Observation recorded');

  const download = page.waitForEvent('download');
  await page.locator('#analyst-export-package').click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toBe('nemosyne-investigation.nemosyne');
  const artifactPath = await artifact.path();
  expect(artifactPath).not.toBeNull();
  const validPackage = new Uint8Array(await readFile(artifactPath!));
  await expect(page.locator('#analyst-journey-status')).toContainText('Investigation exported');
  await expect(page.locator('#analyst-replay-package')).toBeEnabled();

  await page.locator('#analyst-replay-package').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Replay verified');

  const payload = NemosynePackageManager.unpack(validPackage);
  const tamperedPackage = NemosynePackageManager.pack({
    ...payload,
    manifest: {
      ...payload.manifest,
      investigationDigest: 'tampered-investigation-digest',
    },
  });
  await page.locator('#analyst-package-input').setInputFiles({
    name: 'tampered.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(tamperedPackage),
  });
  await expect(page.locator('#analyst-journey-status')).toContainText('Investigation selected');
  await page.locator('#analyst-replay-package').click();
  await expect(page.locator('#analyst-journey-status')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#analyst-journey-status')).toContainText(
    'Replay verification failed',
  );
  await expect(page.locator('#analyst-journey-status')).toContainText(
    'Source investigation unchanged',
  );

  await page.locator('#analyst-package-input').setInputFiles({
    name: 'verified.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(validPackage),
  });
  await page.locator('#analyst-replay-package').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Replay verified');
});
