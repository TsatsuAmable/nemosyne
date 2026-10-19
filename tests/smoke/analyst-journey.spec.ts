import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AtlasCore } from '../../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../../src/data/Dataset.ts';
import { NemosyneSession, type NemosyneSessionJSON } from '../../src/session/NemosyneSession.ts';
import * as bridge from '../../src/wasm/RuntimeBridge.ts';
import { NemosynePackageManager } from '../../src/session/NemosynePackage.ts';

async function openPortableCommand(page: Page, bytes: Uint8Array): Promise<void> {
  await page.evaluate(() => {
    const palette = document.querySelector('nms-command-palette') as HTMLElement & { show?: () => void };
    palette?.show?.();
  });
  const search = page.locator('nms-command-palette .search-input');
  await expect(search).toBeVisible();
  await search.fill('Open .nemosyne');
  const command = page.locator('nms-command-palette .command-item[data-command-id="replay"]');
  await expect(command).toBeVisible();
  const chooserPromise = page.waitForEvent('filechooser');
  await command.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'investigation.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
}

async function exportedState(page: Page) {
  const downloading = page.waitForEvent('download');
  await page.locator('#export-btn').click();
  const download = await downloading;
  const file = await download.path();
  expect(file).not.toBeNull();
  const payload = NemosynePackageManager.unpack(new Uint8Array(await readFile(file!)));
  const snapshot = JSON.parse(strFromU8(payload.extraFiles!['continuity/session-v2.json']!)) as Partial<NemosyneSessionJSON>;
  // Save time changes on every export; investigation content must not.
  delete snapshot.savedAt;
  return {
    datasetFingerprint: payload.manifest.datasetFingerprint,
    investigationDigest: payload.manifest.investigationDigest,
    commandLog: Array.from(payload.commandLogBytes),
    snapshot,
  };
}

function restoredSnapshot(snapshot: Partial<NemosyneSessionJSON>) {
  // This cached history projection regenerates its frame creation times.
  // Durable ledger timestamps and every analytical identity remain exact.
  return {
    ...snapshot,
    analysisHistory: {
      ...snapshot.analysisHistory,
      frames: snapshot.analysisHistory!.frames.map(({ timestamp: _timestamp, ...frame }) => frame),
    },
  };
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
  await expect(page.locator('#status-message')).toContainText('Evidence ready', { timeout: 10_000 });

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

  const savedState = await exportedState(page);
  const savedDatasetLabel = await page.locator('#dataset-indicator').textContent();
  await page.locator('#action-load-sample').click();
  await expect(page.locator('#dataset-indicator')).not.toHaveText(savedDatasetLabel!, { timeout: 10_000 });
  const changedState = await exportedState(page);
  expect(changedState.datasetFingerprint).not.toBe(savedState.datasetFingerprint);
  expect(changedState.investigationDigest).not.toBe(savedState.investigationDigest);
  await openPortableCommand(page, validPackage);
  await expect(continuityFeedback).toContainText(
    'Investigation opened and resumable',
    { timeout: 15_000 },
  );

  const payload = NemosynePackageManager.unpack(validPackage);
  expect(payload.manifest.formatVersion).toBe(2);
  expect(payload.evidenceReceiptBytes).toBeUndefined();
  const reopened = await exportedState(page);
  expect(reopened.datasetFingerprint).toBe(payload.manifest.datasetFingerprint);
  expect(reopened.investigationDigest).toBe(payload.manifest.investigationDigest);
  expect(reopened.commandLog).toEqual(Array.from(payload.commandLogBytes));
  expect(restoredSnapshot(reopened.snapshot)).toEqual(restoredSnapshot(savedState.snapshot));
  const tamperedPackage = NemosynePackageManager.pack({
    ...payload,
    manifest: {
      ...payload.manifest,
      investigationDigest: 'tampered-investigation-digest',
    },
  });
  const datasetBeforeTamper = await page.locator('#dataset-indicator').textContent();
  const beforeTamper = await exportedState(page);
  await openPortableCommand(page, tamperedPackage);
  await expect(continuityFeedback).toContainText('Verification failed', { timeout: 15_000 });
  expect(await page.locator('#dataset-indicator').textContent()).toBe(datasetBeforeTamper);
  expect(await exportedState(page)).toEqual(beforeTamper);

  const previousKernelPackage = NemosynePackageManager.pack({
    ...payload,
    manifest: { ...payload.manifest, kernelVersion: '0.2.0' },
  });
  await openPortableCommand(page, previousKernelPackage);
  await expect(continuityFeedback).toContainText('Kernel version mismatch', { timeout: 15_000 });
  await expect(continuityFeedback).not.toContainText('Investigation opened');
  expect(await exportedState(page)).toEqual(beforeTamper);
});

// A real Rust-issued archive verifies through the visible browser command.
// It intentionally has no resumable workspace: V3 continuity is a separate contract.
test('browser reports governed consumer-policy verification and refuses missing uses', async ({ page }) => {
  // The smoke CI downloads only dist. Initialize the fixture from that exact
  // production artifact, never an incidental checkout wasm/pkg build.
  const sourceDirectory = process.cwd();
  try {
    process.chdir(path.resolve(sourceDirectory, 'dist'));
    await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
  } finally {
    process.chdir(sourceDirectory);
  }
  const atlas = new AtlasCore({ kernel: bridge });
  atlas.loadDataset(new Dataset('governed-browser-fixture', [
    { name: 'x', type: ColumnType.NUMERIC },
    { name: 'y', type: ColumnType.NUMERIC },
  ], [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 9 }]));
  let bytes: Uint8Array;
  try {
    bytes = await new NemosyneSession({ atlas }).exportPortablePackage({}, undefined, { governedEvidence: true });
  } finally {
    atlas.dispose();
  }
  const payload = NemosynePackageManager.unpack(bytes);
  expect(payload.manifest.formatVersion).toBe(3);
  expect(payload.evidenceReceiptBytes).toBeDefined();
  const envelope = JSON.parse(strFromU8(payload.evidenceReceiptBytes!));
  expect(envelope.bundle.receipts.length).toBeGreaterThan(0);
  expect(envelope.uses.length).toBeGreaterThan(0);

  await page.goto('/');
  await expect(page.locator('#status-message')).toHaveText('Ready');
  const datasetBefore = await page.locator('#dataset-indicator').textContent();
  const beforeImport = await exportedState(page);
  await openPortableCommand(page, bytes);
  const feedback = page.locator('#continuity-feedback');
  await expect(feedback).toContainText('governed evidence verified under the consumer policy', { timeout: 15_000 });
  await expect(feedback).toContainText('no resumable workspace state');
  await expect(page.locator('#dataset-indicator')).toHaveText(datasetBefore!);

  expect(await exportedState(page)).toEqual(beforeImport);

  // Update the entry checksum so the real policy binder, not ZIP integrity, refuses.
  const files = unzipSync(bytes);
  envelope.uses = [];
  files['investigation/evidence-receipts.json'] = strToU8(JSON.stringify(envelope));
  const manifest = JSON.parse(strFromU8(files['manifest.json']!));
  manifest.evidenceReceiptDigest = createHash('sha256').update(files['investigation/evidence-receipts.json']!).digest('hex');
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  await openPortableCommand(page, zipSync(files));
  await expect(feedback).toContainText('Verification failed', { timeout: 15_000 });
  await expect(feedback).toContainText('same governed consumer set');
  await expect(feedback).not.toContainText('governed evidence verified');
  expect(await exportedState(page)).toEqual(beforeImport);
  await expect(page.locator('#dataset-indicator')).toHaveText(datasetBefore!);
});
