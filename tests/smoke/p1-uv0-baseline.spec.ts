import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UV0_INVENTORY } from '../../src/validation/uv0-inventory.ts';
import type { NemosyneUv0TestHandle, Uv0RuntimeSnapshot } from '../../src/app/uv0TestHandle.ts';

/** P1-UV0 canonical visible-product baseline (Stream B3). */
const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(SPEC_DIR, 'artifacts', 'uv0-baseline');
const VIEWPORT = { width: 1280, height: 720 };
const TEST_HANDLE_URL = '/?nemosyne-uv0=1';
const TESTED_SOURCE_SHA = process.env.NEMOSYNE_TESTED_SOURCE_SHA ?? 'local-unpinned';

test.skip(
  process.env.NEMOSYNE_UV0_EVIDENCE !== '1',
  'P1-UV0 baseline requires the dedicated instrumented evidence build',
);

test.use({ viewport: VIEWPORT, deviceScaleFactor: 1 });

interface CapturedState {
  id: string;
  screenshot: string;
  screenshotBytes: number;
  asserted: boolean;
  outcome: string;
  snapshot: Uv0RuntimeSnapshot;
}

async function snapshot(page: Page): Promise<Uv0RuntimeSnapshot | null> {
  return page.evaluate(
    () => (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle }).__NEMOSYNE_UV0__?.snapshot() ?? null,
  );
}

async function pollSnapshot(
  page: Page,
  predicate: (state: Uv0RuntimeSnapshot) => boolean,
  message: string,
  timeout = 15_000,
): Promise<Uv0RuntimeSnapshot> {
  let last: Uv0RuntimeSnapshot | null = null;
  await expect
    .poll(async () => {
      last = await snapshot(page);
      return last ? predicate(last) : false;
    }, { timeout, message })
    .toBe(true);
  return last as unknown as Uv0RuntimeSnapshot;
}

async function captureState(
  page: Page,
  states: CapturedState[],
  id: string,
  outcome: string,
  state: Uv0RuntimeSnapshot,
): Promise<void> {
  const fileName = `${id}.png`;
  const target = path.join(ARTIFACTS_DIR, fileName);
  await page.screenshot({ path: target, fullPage: false });
  const screenshotBytes = (await stat(target)).size;
  expect(screenshotBytes).toBeGreaterThan(0);
  states.push({ id, screenshot: fileName, screenshotBytes, asserted: true, outcome, snapshot: state });
}

test('P1-UV0 baseline: canonical states captured with state assertions', async ({ page }) => {
  const capturedStates: CapturedState[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  await mkdir(ARTIFACTS_DIR, { recursive: true });

  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!text.startsWith('Failed to load resource: the server responded with a status of')) {
      consoleErrors.push(text);
    }
  });

  await page.goto(TEST_HANDLE_URL);
  const telemetry = page.locator('#telemetry');
  await expect(telemetry).toContainText('LAYOUT:', { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { __NEMOSYNE_UV0__?: unknown }).__NEMOSYNE_UV0__))
    .toBe('object');

  // S1 — fresh boot.
  await expect(page.locator('#investigation-shell')).toBeVisible();
  await expect(page.locator('#status-message')).toHaveText('Ready');
  await expect(page.locator('#dataset-indicator')).toContainText('Supply Chain Hierarchy');
  const s1 = await pollSnapshot(
    page,
    (state) => state.datasetName !== null && state.palaceNodeCount > 0,
    'fresh boot has a dataset and rendered palace',
  );
  expect(s1.settingsPanelVisible).toBe(false);
  expect(UV0_INVENTORY.find((entry) => entry.id === 'settings-panel')?.visibleAtBoot).toBe(false);
  await captureState(page, capturedStates, '01-fresh-boot', 'dataset loaded and representation rendered', s1);

  // S2 — focused observation through the production selection path.
  expect(await page.evaluate(() =>
    (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle }).__NEMOSYNE_UV0__?.selectNode(0) ?? false,
  )).toBe(true);
  await pollSnapshot(
    page,
    (state) => state.taskSurfaceVisible === true && state.activePanelBudgetCount === 1,
    'contextual task surface occupies one panel-budget slot',
  );
  await page.evaluate(() => {
    (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle }).__NEMOSYNE_UV0__?.inspectSelected();
  });
  const s2 = await pollSnapshot(
    page,
    (state) => state.inspectorVisible === true && state.taskSurfaceVisible === false,
    'inspector replaces contextual task surface',
  );
  await captureState(page, capturedStates, '02-focused-observation', 'one inspector surface visible', s2);

  // S3 — Moneta explicit refusal. Modal content is light DOM projected through
  // the component slot, so evidence asserts the rendered host rather than the
  // implementation-private shadow .body wrapper.
  const tools = page.locator('#investigation-shell aside details').filter({ hasText: 'More tools' });
  await tools.locator('summary').click();
  await page.locator('#max-elements').fill('1');
  await page.locator('#assess-btn').click();
  const assessment = page.locator('nms-modal[title="Representation Assessment"]');
  await expect(assessment).toHaveAttribute('open', '');
  await expect(assessment).toContainText('No feasible representation', { timeout: 15_000 });
  await expect(page.locator('#status-message')).toContainText('NIL outcome recorded');
  const s3 = await pollSnapshot(
    page,
    (state) => state.outcomeKind === 'nil' && state.nilCount >= 1,
    'Moneta refusal recorded in authoritative session state',
  );
  await captureState(page, capturedStates, '03-nil', `NIL recorded (nilCount=${s3.nilCount})`, s3);
  await page.keyboard.press('Escape');

  // S4 — evidence + observation.
  await page.locator('#action-run-analysis').click();
  await pollSnapshot(page, (state) => state.evidenceCount > 0, 'analysis evidence recorded');
  await page.locator('#action-mark-moment').click();
  await expect(page.locator('#status-message')).toContainText('Observation recorded');
  const s4 = await pollSnapshot(
    page,
    (state) => state.evidenceCount > 0 && state.observationCount >= 1,
    'analysis evidence and observation recorded',
  );
  await captureState(
    page,
    capturedStates,
    '04-evidence',
    `evidence=${s4.evidenceCount} observations=${s4.observationCount}`,
    s4,
  );

  // S5 — portable export + verified reopen through the actual command-palette route.
  const download = page.waitForEvent('download');
  await page.locator('#export-btn').click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toMatch(/^nemosyne-investigation-\d{4}-\d{2}-\d{2}\.nemosyne$/);
  const artifactPath = await artifact.path();
  expect(artifactPath).not.toBeNull();
  const packageBytes = await readFile(artifactPath!);

  await page.evaluate(() => {
    const palette = document.querySelector('nms-command-palette') as HTMLElement & { show?: () => void };
    palette?.show?.();
  });
  const paletteSearch = page.locator('nms-command-palette .search-input');
  await paletteSearch.fill('Open .nemosyne');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'verified.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(packageBytes),
  });

  const continuityFeedback = page.locator('#continuity-feedback');
  const s5 = (await snapshot(page)) as Uv0RuntimeSnapshot;
  let s5Outcome: string;
  if (s5.kernelAvailable === false) {
    await expect(continuityFeedback).toContainText('Verification failed', { timeout: 15_000 });
    s5Outcome = 'kernel-unavailable: portable reopen not baselined in this environment';
  } else {
    await expect(continuityFeedback).toContainText('Investigation opened and verified', { timeout: 15_000 });
    s5Outcome = 'portable-reopen-verified';
  }
  await captureState(page, capturedStates, '05-replay', s5Outcome, s5);

  expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `unexpected console.error: ${consoleErrors.join(' | ')}`).toEqual([]);
  expect(capturedStates).toHaveLength(5);

  await writeFile(path.join(ARTIFACTS_DIR, 'run-inventory.json'), `${JSON.stringify({
    schema: 'nemosyne/p1-uv0-baseline-run',
    schemaVersion: 2,
    testedSourceSha: TESTED_SOURCE_SHA,
    ciMergeSha: process.env.GITHUB_SHA ?? null,
    capturedAt: new Date().toISOString(),
    viewport: { ...VIEWPORT, deviceScaleFactor: 1 },
    kernelAvailable: s5.kernelAvailable,
    states: capturedStates,
    inventory: UV0_INVENTORY.map((entry) => ({
      id: entry.id,
      name: entry.name,
      classification: entry.classification,
      referenceFrame: entry.referenceFrame,
      visibleAtBoot: entry.visibleAtBoot,
      source: entry.source,
    })),
  }, null, 2)}\n`);
});
