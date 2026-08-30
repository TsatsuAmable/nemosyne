import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UV0_INVENTORY } from '../../src/validation/uv0-inventory.ts';
import type { NemosyneUv0TestHandle, Uv0RuntimeSnapshot } from '../../src/app/uv0TestHandle.ts';

/**
 * P1-UV0 canonical visible-product baseline (Stream B3).
 *
 * This spec runs only in the dedicated instrumented evidence job. Ordinary
 * production smoke deliberately skips it so the normal production bundle can
 * prove that UV0 instrumentation is absent.
 */

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(SPEC_DIR, 'artifacts', 'uv0-baseline');
const VIEWPORT = { width: 1280, height: 720 };
const DEVICE_SCALE_FACTOR = 1;
const TEST_HANDLE_URL = '/?nemosyne-uv0=1';
const TESTED_SOURCE_SHA = process.env.NEMOSYNE_TESTED_SOURCE_SHA ?? 'local-unpinned';

test.skip(
  process.env.NEMOSYNE_UV0_EVIDENCE !== '1',
  'P1-UV0 baseline requires the dedicated instrumented evidence build',
);

interface CapturedState {
  id: string;
  screenshot: string;
  screenshotBytes: number;
  asserted: boolean;
  outcome: string;
  snapshot: Uv0RuntimeSnapshot;
}

let capturedStates: CapturedState[] = [];
let pageErrors: string[] = [];
let consoleErrors: string[] = [];

test.use({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR });

async function snapshot(page: Page): Promise<Uv0RuntimeSnapshot | null> {
  return page.evaluate(
    () => (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle }).__NEMOSYNE_UV0__?.snapshot() ?? null,
  );
}

async function pollSnapshot(
  page: Page,
  predicate: (s: Uv0RuntimeSnapshot) => boolean,
  message: string,
  timeout = 15_000,
): Promise<Uv0RuntimeSnapshot> {
  let last: Uv0RuntimeSnapshot | null = null;
  await expect
    .poll(
      async () => {
        last = await snapshot(page);
        return last ? predicate(last) : false;
      },
      { timeout, message },
    )
    .toBe(true);
  return last as unknown as Uv0RuntimeSnapshot;
}

async function captureState(
  page: Page,
  id: string,
  asserted: boolean,
  outcome: string,
  state: Uv0RuntimeSnapshot,
): Promise<void> {
  const fileName = `${id}.png`;
  const target = path.join(ARTIFACTS_DIR, fileName);
  await page.screenshot({ path: target, fullPage: false });
  const screenshotBytes = (await stat(target)).size;
  expect(screenshotBytes, `${fileName} must be a non-empty evidence artifact`).toBeGreaterThan(0);
  capturedStates.push({ id, screenshot: fileName, screenshotBytes, asserted, outcome, snapshot: state });
}

test('P1-UV0 baseline: canonical states captured with state assertions', async ({ page }) => {
  capturedStates = [];
  pageErrors = [];
  consoleErrors = [];
  await mkdir(ARTIFACTS_DIR, { recursive: true });

  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.startsWith('Failed to load resource: the server responded with a status of')) return;
    consoleErrors.push(text);
  });

  await page.goto(TEST_HANDLE_URL);

  const telemetry = page.locator('#telemetry');
  await expect
    .poll(async () => (await telemetry.textContent()) ?? '', {
      timeout: 15_000,
      message: '#telemetry reached the per-frame form (boot + first render tick)',
    })
    .toContain('LAYOUT:');

  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof (window as unknown as { __NEMOSYNE_UV0__?: unknown }).__NEMOSYNE_UV0__ ===
            'object',
        ),
      { timeout: 15_000, message: 'instrumented UV0 test handle installed' },
    )
    .toBe(true);

  // S1 fresh boot / loaded representation. The modern InvestigationShell is
  // the canonical analyst chrome; UV0 evidence must not pin retired journey
  // controls back into the product contract.
  await expect(page.locator('#investigation-shell')).toBeVisible();
  await expect(page.locator('#status-message')).toHaveText('Ready');
  await expect(page.locator('#dataset-indicator')).toContainText('Supply Chain Hierarchy');
  const bootTelemetry = (await telemetry.textContent()) ?? '';
  expect(bootTelemetry).toContain('GEOM:');
  expect(bootTelemetry).toContain('BEHAVIOR:');
  expect(bootTelemetry.startsWith('ERROR:'), `telemetry was: ${bootTelemetry}`).toBe(false);
  expect(bootTelemetry.trim()).not.toBe('initializing…');

  const s1 = await pollSnapshot(
    page,
    (s) => s.datasetName !== null && s.palaceNodeCount > 0,
    'fresh-boot: dataset loaded and palace built',
  );
  expect(s1.datasetName).toBe('Supply Chain Hierarchy');
  expect(s1.palaceNodeCount).toBeGreaterThan(0);
  expect(s1.settingsPanelVisible).toBe(false);
  expect(UV0_INVENTORY.find((entry) => entry.id === 'settings-panel')?.visibleAtBoot).toBe(false);
  await captureState(page, '01-fresh-boot', true, 'supply-chain loaded, ≥1 frame rendered', s1);

  // S2 focused observation.
  const selected = await page.evaluate(() =>
    (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle }).__NEMOSYNE_UV0__?.selectNode(0) ?? false,
  );
  expect(selected, 'node select dispatched through real _showDataCard path').toBe(true);
  const s2a = await pollSnapshot(
    page,
    (s) =>
      s.taskSurfaceVisible === true &&
      s.taskSurfaceDistanceToSelection !== null &&
      s.activePanelBudgetCount === 1,
    'focused-observation: object-attached contextual task surface visible in inspector budget slot',
  );
  expect(s2a.taskSurfaceDistanceToSelection).not.toBeNull();
  expect(s2a.taskSurfaceDistanceToSelection!).toBeGreaterThan(0.1);
  expect(s2a.taskSurfaceDistanceToSelection!).toBeLessThan(0.4);
  expect(s2a.activePanelBudgetCount).toBe(1);

  await page.evaluate(() =>
    (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle }).__NEMOSYNE_UV0__?.inspectSelected(),
  );
  const s2b = await pollSnapshot(
    page,
    (s) => s.inspectorVisible === true && s.taskSurfaceVisible === false,
    'focused-observation: inspector replaces contextual rail after Inspect verb',
  );
  expect(s2b.activePanelBudgetCount).toBe(1);
  await captureState(page, '02-focused-observation', true, 'object-attached task rail replaced by one inspector surface', s2b);

  // S3 Moneta decision / NIL. Advanced representation controls remain behind
  // progressive disclosure in the modern shell.
  const tools = page.locator('aside details');
  await tools.locator('summary').click();
  await expect(tools).toHaveAttribute('open', '');
  await page.locator('#max-elements').fill('1');
  await page.locator('#assess-btn').click();
  await expect(
    page.locator('nms-modal[title="Representation Assessment"] .body'),
  ).toContainText('No feasible representation', { timeout: 15_000 });
  await expect(page.locator('#status-message')).toContainText('NIL outcome recorded');
  const s3 = await pollSnapshot(
    page,
    (s) => s.outcomeKind === 'nil' && s.nilCount >= 1,
    'NIL: Moneta refusal recorded in the session ledger',
  );
  await captureState(page, '03-nil', true, `NIL recorded (nilCount=${s3.nilCount})`, s3);

  // S4 evidence / hypothesis state. Analysis completion is asserted against the
  // authoritative ledger rather than a retired status-copy contract.
  await page.locator('#action-run-analysis').click();
  await pollSnapshot(
    page,
    (s) => s.evidenceCount > 0,
    'evidence: analysis result present in the authoritative ledger',
  );
  await page.locator('#action-mark-moment').click();
  await expect(page.locator('#status-message')).toContainText('Observation recorded');
  const s4 = await pollSnapshot(
    page,
    (s) => s.evidenceCount > 0 && s.observationCount >= 1,
    'evidence: analysis result and observation present in the authoritative ledger',
  );
  await captureState(page, '04-evidence', true, `evidence=${s4.evidenceCount} observations=${s4.observationCount}`, s4);

  // S5 saved / replay state.
  const download = page.waitForEvent('download');
  await page.locator('#export-btn').click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toBe('nemosyne-investigation.nemosyne');
  const artifactPath = await artifact.path();
  expect(artifactPath).not.toBeNull();
  const packageBytes = await readFile(artifactPath!);
  await expect(page.locator('#status-message')).toContainText('Investigation exported');

  // Replay is intentionally an advanced command-palette route. Open the real
  // component directly so this evidence test validates command execution without
  // coupling to platform-specific modifier-key semantics.
  await page.evaluate(() => {
    const palette = document.querySelector('nms-command-palette') as HTMLElement & { show?: () => void };
    palette?.show?.();
  });
  const paletteSearch = page.locator('nms-command-palette .search-input');
  await expect(paletteSearch).toBeVisible();
  await paletteSearch.fill('Replay investigation');
  await page.keyboard.press('Enter');

  const replayModal = page.locator('nms-modal[title="Replay Investigation"]');
  await expect(replayModal).toBeVisible();
  await replayModal.locator('#package-input').setInputFiles({
    name: 'verified.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(packageBytes),
  });
  await replayModal.locator('#replay-btn').click();

  const s5 = (await snapshot(page)) as Uv0RuntimeSnapshot;
  let s5Outcome: string;
  if (s5.kernelAvailable === false) {
    await expect(replayModal.locator('#replay-status')).toContainText('Replay verification failed', {
      timeout: 15_000,
    });
    s5Outcome = 'kernel-unavailable: replay not baselined in this environment';
  } else {
    await expect(replayModal.locator('#replay-status')).toContainText('Replay verified', {
      timeout: 15_000,
    });
    s5Outcome = 'replay-verified';
  }
  await captureState(page, '05-replay', true, s5Outcome, s5);

  expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `unexpected console.error: ${consoleErrors.join(' | ')}`).toEqual([]);
  expect(capturedStates).toHaveLength(5);
  expect(capturedStates.every((state) => state.screenshotBytes > 0)).toBe(true);

  const runInventory = {
    schema: 'nemosyne/p1-uv0-baseline-run',
    schemaVersion: 2,
    testedSourceSha: TESTED_SOURCE_SHA,
    ciMergeSha: process.env.GITHUB_SHA ?? null,
    capturedAt: new Date().toISOString(),
    viewport: { ...VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR },
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
  };
  await writeFile(
    path.join(ARTIFACTS_DIR, 'run-inventory.json'),
    `${JSON.stringify(runInventory, null, 2)}\n`,
  );
  console.log(`[P1-UV0] baseline artifacts written to ${ARTIFACTS_DIR}`);
});
