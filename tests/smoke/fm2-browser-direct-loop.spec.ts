import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync, zipSync } from 'fflate';
import { NemosynePackageManager } from '../../src/session/NemosynePackage.ts';
import type { NemosyneSessionJSON } from '../../src/session/NemosyneSession.ts';

async function openPortableThroughVisibleShell(page: Page, bytes: Uint8Array): Promise<void> {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#continuity-open-package').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'fm2-direct-loop.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
}

test('normal Chromium completes the governed FM2 direct loop and replays its saved carrier', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#investigation-shell')).toBeVisible();
  await expect(page.locator('#status-message')).toHaveText('Ready');

  await page.locator('#action-load-sample').click();
  await expect(page.locator('#status-message')).toContainText('Loaded', { timeout: 15_000 });

  await page.locator('#investigation-notice').fill('The observed distribution has a long upper tail.');
  await page.locator('#investigation-notice-save').click();
  await expect(page.locator('#investigation-feedback')).toContainText('Notice saved');
  await page.locator('#investigation-question').fill('Does the distribution support a direct bounded view?');
  await page.locator('#investigation-question-save').click();
  await expect(page.locator('#investigation-feedback')).toContainText('Research question saved');
  await page.locator('#investigation-hypothesis').fill('A governed direct distribution can preserve the observed tail.');
  await page.locator('#investigation-hypothesis-save').click();
  await expect(page.locator('#investigation-feedback')).toContainText('Hypothesis saved');

  const reviewRail = page.locator('#desktop-review-recovery-rail');
  await reviewRail.locator('summary').click();
  await expect(reviewRail).toHaveAttribute('open', '');
  const compile = page.locator('#review-direct-compile');
  await expect(compile).toBeEnabled();
  await expect(page.locator('#review-direct-disclosures'))
    .toHaveText('Direct-loop disclosure · no governed compilation; no representation promoted.');
  await compile.click();
  await expect(page.locator('#review-direct-action-state'))
    .toContainText('Governed direct compilation ready', { timeout: 20_000 });
  await expect(page.locator('#review-direct-disclosures'))
    .toContainText('0 conjectural elements');
  await expect(page.locator('#review-direct-critique')).toBeEnabled();

  await page.locator('#review-direct-target').selectOption({ index: 0 });
  await page.locator('#review-direct-phenomenon').selectOption({ index: 0 });
  await page.locator('#review-direct-note').fill('The direct view needs a constrained comparison before adoption.');
  await page.locator('#review-direct-critique').click();
  await expect(page.locator('#review-direct-action-state'))
    .toContainText('Attributable critique recorded', { timeout: 15_000 });
  await expect(page.locator('#review-direct-critique-id').locator('option')).toHaveCount(1);
  await page.locator('#review-direct-critique-id').selectOption({ index: 0 });
  await page.locator('#review-direct-prefer').click();
  await expect(page.locator('#review-direct-action-state'))
    .toContainText('Reproducible alternative linked to critique; active decision unchanged', { timeout: 15_000 });
  await expect(page.locator('#review-direct-action-state')).not.toContainText('promoted');
  await expect(page.locator('#review-direct-alternatives')).toContainText('1 recorded');
  await expect(page.locator('#review-direct-history')).toContainText('feedback');
  await expect(page.locator('#review-direct-variants')).toHaveText('Compiled direct variants · none recorded');

  // Visible intent turnover must revoke every action against the previously
  // compiled context, including critique, preference and new lineage creation.
  await page.locator('#investigation-question').fill('Does the changed framing still support the direct view?');
  await page.locator('#investigation-question-save').click();
  await expect(page.locator('#investigation-feedback')).toContainText('Research question saved');
  await page.locator('#investigation-hypothesis').fill('The changed framing requires a fresh direct compilation.');
  await page.locator('#investigation-hypothesis-save').click();
  await expect(page.locator('#investigation-feedback')).toContainText('Hypothesis saved');
  await expect(page.locator('#review-direct-action-state'))
    .toContainText('no governed direct compilation', { timeout: 15_000 });
  await expect(page.locator('#review-direct-critique')).toHaveAttribute('disabled', '');
  await expect(page.locator('#review-direct-prefer')).toHaveAttribute('disabled', '');
  await page.locator('#review-direct-critique').click({ force: true });
  await page.locator('#review-direct-prefer').click({ force: true });
  await expect(page.locator('#review-direct-alternatives')).toContainText('1 recorded');

  await page.locator('#continuity-checkpoint').click();
  await expect(page.locator('#continuity-feedback')).toContainText('Checkpoint created', { timeout: 15_000 });

  const downloading = page.waitForEvent('download');
  await page.locator('#continuity-export-package').click();
  const download = await downloading;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const packageBytes = new Uint8Array(await readFile(downloadPath!));
  const payload = NemosynePackageManager.unpack(packageBytes);
  expect(payload.manifest.formatVersion).toBe(2);
  expect(payload.directDistributionBytes).toBeDefined();
  expect(payload.manifest.directDistributionDigest).toMatch(/^[a-f0-9]{64}$/);
  const directCarrier = JSON.parse(strFromU8(payload.directDistributionBytes!)) as {
    binding: {
      consumerId: string;
      receiptId: string;
      sourceDigest: string;
    };
  };
  expect(directCarrier.binding.consumerId).toBe('nemosyne:consumer/direct-distribution/v1');
  expect(directCarrier.binding.receiptId).toMatch(/^direct-distribution:[a-f0-9]{64}$/);
  expect(directCarrier.binding.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
  const savedSnapshot = JSON.parse(
    strFromU8(payload.extraFiles!['continuity/session-v2.json']!),
  ) as NemosyneSessionJSON;
  expect(typeof savedSnapshot.directDistributionSnapshot).toBe('string');
  expect(typeof savedSnapshot.formaInvestigationSnapshot).toBe('string');
  const savedForma = JSON.parse(
    Buffer.from(savedSnapshot.formaInvestigationSnapshot!, 'base64').toString('utf8'),
  ) as {
    directFeedbackLinks?: unknown[];
  };
  expect(savedForma.directFeedbackLinks).toHaveLength(1);
  await expect(page.locator('#continuity-feedback')).toContainText('Portable investigation ready');

  await page.locator('#continuity-save-now').click();
  await expect(page.locator('#continuity-feedback')).toContainText('Investigation saved locally');

  const savedDatasetLabel = await page.locator('#dataset-indicator').textContent();
  await page.locator('#action-load-sample').click();
  await expect(page.locator('#dataset-indicator')).not.toHaveText(savedDatasetLabel!, { timeout: 15_000 });
  await expect(page.locator('#review-direct-action-state'))
    .toContainText('no governed direct compilation');
  await expect(page.locator('#review-direct-critique')).toHaveAttribute('disabled', '');
  await expect(page.locator('#review-direct-prefer')).toHaveAttribute('disabled', '');
  await expect(page.locator('#review-direct-alternatives'))
    .toHaveText('Direct-loop alternatives · none recorded');

  await page.locator('#continuity-restore-checkpoint').click();
  await expect(page.locator('#continuity-feedback')).toContainText('Checkpoint restored', { timeout: 15_000 });
  await expect(page.locator('#review-direct-action-state'))
    .toContainText('no governed direct compilation');
  await expect(page.locator('#review-direct-critique')).toHaveAttribute('disabled', '');
  await expect(page.locator('#review-direct-prefer')).toHaveAttribute('disabled', '');
  await expect(page.locator('#review-direct-alternatives'))
    .toContainText('1 recorded');

  await openPortableThroughVisibleShell(page, packageBytes);
  await expect(page.locator('#continuity-feedback'))
    .toContainText('Replay verified', { timeout: 20_000 });
  await expect(page.locator('#continuity-feedback'))
    .toContainText('direct distribution attested');
  await expect(page.locator('#continuity-feedback'))
    .toContainText(`consumer ${directCarrier.binding.consumerId}`);
  await expect(page.locator('#continuity-feedback'))
    .toContainText(`receipt ${directCarrier.binding.receiptId}`);
  await expect(page.locator('#continuity-feedback'))
    .toContainText(`source ${directCarrier.binding.sourceDigest}`);
  await expect(page.locator('#continuity-feedback'))
    .toContainText('Investigation opened and resumable');
  await expect(page.locator('#review-direct-action-state'))
    .toContainText('no governed direct compilation');
  await expect(page.locator('#review-direct-critique')).toHaveAttribute('disabled', '');
  await expect(page.locator('#review-direct-prefer')).toHaveAttribute('disabled', '');
  await expect(page.locator('#review-direct-alternatives'))
    .toContainText('1 recorded');

  const tamperedFiles = unzipSync(packageBytes);
  const tamperedCarrier = tamperedFiles['investigation/direct-distribution.json'];
  expect(tamperedCarrier).toBeDefined();
  tamperedCarrier![0] ^= 1;
  tamperedFiles['investigation/direct-distribution.json'] = tamperedCarrier!;
  await openPortableThroughVisibleShell(page, zipSync(tamperedFiles));
  await expect(page.locator('#continuity-feedback')).toContainText(/Verification failed|digest mismatch/, { timeout: 20_000 });
  await expect(page.locator('#continuity-feedback')).not.toContainText('Investigation opened');
  await expect(page.locator('#review-direct-action-state'))
    .toContainText('no governed direct compilation');
});
