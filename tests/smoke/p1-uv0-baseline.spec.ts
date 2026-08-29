import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UV0_INVENTORY } from '../../src/validation/uv0-inventory.ts';
import type { NemosyneUv0TestHandle, Uv0RuntimeSnapshot } from '../../src/app/uv0TestHandle.ts';

/**
 * P1-UV0 canonical visible-product baseline (Stream B3).
 *
 * This is the first deterministic screenshot/inventory pipeline for the
 * production build. It boots `dist/` in real headless Chromium (WebGL2 via
 * SwiftShader) exactly like the existing load/analyst-journey smokes, then
 * walks five canonical investigation states:
 *
 *   S1 fresh-boot/loaded   (World constructor auto-loads supply-chain)
 *   S2 focused-observation (node selected → contextual task surface + inspector)
 *   S3 Moneta decision/NIL (assess with max-elements=1)
 *   S4 evidence            (run analysis + mark moment → ledger populated)
 *   S5 saved/replay        (export .nemosyne → replay)
 *
 * Every state is ASSERTED before its screenshot is taken; screenshots are
 * evidence artifacts only and are written to a gitignored artifacts directory
 * (renderer variance across CI runners must never break the gate). A run JSON
 * is written alongside linking each screenshot to its asserted state and to the
 * canonical inventory ids from src/validation/uv0-inventory.ts, so B4/B5 can
 * diff the baseline mechanically.
 *
 * State reachability notes:
 * - S2 uses the `?nemosyne-uv0=1` test-only handle to dispatch the REAL
 *   `_showDataCard`/`onInspect` production handlers deterministically (the
 *   raycast hover mechanics are exercised by the unit surface).
 * - S3/S4/S5 depend on the analytical kernel, which the CI production-build
 *   job ships (`npm run wasm && vite build`). If a local worktree has no
 *   compatible kernel, S5 is recorded as `kernel-unavailable` instead of
 *   failing (the mission rule: record as not-yet-baselined rather than force).
 */

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = path.join(SPEC_DIR, 'artifacts', 'uv0-baseline');
const VIEWPORT = { width: 1280, height: 720 };
const DEVICE_SCALE_FACTOR = 1;
const TEST_HANDLE_URL = '/?nemosyne-uv0=1';

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
  let screenshotBytes = 0;
  try {
    await page.screenshot({ path: target, fullPage: false });
    screenshotBytes = (await stat(target)).size;
  } catch (error) {
    // Screenshots are evidence artifacts, not the gate. A capture failure is
    // recorded in the run JSON but must not fail the state-asserted baseline.
    outcome = `${outcome} (screenshot failed: ${error instanceof Error ? error.message : String(error)})`;
  }
  capturedStates.push({ id, screenshot: fileName, screenshotBytes, asserted, outcome, snapshot: state });
}

test('P1-UV0 baseline: canonical states captured with state assertions', async ({ page }) => {
  // Per-run state isolation: Playwright may retry this test in the same worker
  // (CI retries: 1), so module-level collectors must not leak across attempts.
  capturedStates = [];
  pageErrors = [];
  consoleErrors = [];

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
      { timeout: 15_000, message: 'test handle installed via ?nemosyne-uv0=1' },
    )
    .toBe(true);

  // ---------------- S1 fresh boot / loaded representation ----------------
  await expect(page.locator('#analyst-journey-controls')).toBeVisible();
  await expect(page.locator('#analyst-journey-status')).toHaveText('Ready');
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
  await captureState(page, '01-fresh-boot', true, 'supply-chain loaded, ≥1 frame rendered', s1);

  // ---------------- S2 focused observation (node selected) ----------------
  const selected = await page.evaluate(() =>
    (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle }).__NEMOSYNE_UV0__?.selectNode(0) ?? false,
  );
  expect(selected, 'node select dispatched through real _showDataCard path').toBe(true);
  await pollSnapshot(
    page,
    (s) => s.taskSurfaceVisible === true,
    'focused-observation: contextual task surface visible after node select',
  );
  await page.evaluate(() =>
    (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle }).__NEMOSYNE_UV0__?.inspectSelected(),
  );
  const s2b = await pollSnapshot(
    page,
    (s) => s.inspectorVisible === true,
    'focused-observation: inspector visible after Inspect verb',
  );
  await captureState(page, '02-focused-observation', true, 'node selected; task surface + inspector visible', s2b);

  // ---------------- S3 Moneta decision / NIL ----------------
  await page.locator('#analyst-max-elements').fill('1');
  await page.locator('#analyst-assess-representation').click();
  await expect(page.locator('#analyst-representation-outcome')).toContainText(
    'NIL: no feasible representation',
    { timeout: 15_000 },
  );
  await expect(page.locator('#analyst-journey-status')).toContainText('NIL outcome recorded');
  const s3 = await pollSnapshot(
    page,
    (s) => s.outcomeKind === 'nil' && s.nilCount >= 1,
    'NIL: Moneta refusal recorded in the session ledger',
  );
  await captureState(page, '03-nil', true, `NIL recorded (nilCount=${s3.nilCount})`, s3);

  // ---------------- S4 evidence / hypothesis state ----------------
  await page.locator('#analyst-run-analysis').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Evidence ready', {
    timeout: 15_000,
  });
  await page.locator('#analyst-mark-moment').click();
  await expect(page.locator('#analyst-journey-status')).toContainText('Observation recorded');
  const s4 = await pollSnapshot(
    page,
    (s) => s.evidenceCount > 0 && s.observationCount >= 1,
    'evidence: analysis result and observation present in the authoritative ledger',
  );
  await captureState(page, '04-evidence', true, `evidence=${s4.evidenceCount} observations=${s4.observationCount}`, s4);

  // ---------------- S5 saved / replay state (kernel-dependent) ----------------
  const download = page.waitForEvent('download');
  await page.locator('#analyst-export-package').click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toBe('nemosyne-investigation.nemosyne');
  const artifactPath = await artifact.path();
  expect(artifactPath).not.toBeNull();
  const packageBytes = await readFile(artifactPath!);
  await expect(page.locator('#analyst-journey-status')).toContainText('Investigation exported');
  await page.locator('#analyst-package-input').setInputFiles({
    name: 'verified.nemosyne',
    mimeType: 'application/zip',
    buffer: Buffer.from(packageBytes),
  });
  await page.locator('#analyst-replay-package').click();

  const s5 = (await snapshot(page)) as unknown as Uv0RuntimeSnapshot;
  let s5Outcome: string;
  if (s5.kernelAvailable === false) {
    // No analytical kernel in this environment → replay is not reachable.
    // Record it as not-yet-baselined (mission rule) instead of forcing.
    await expect(page.locator('#analyst-journey-status')).toContainText('Replay verification failed', {
      timeout: 15_000,
    });
    s5Outcome = 'kernel-unavailable: replay not baselined in this environment';
  } else {
    await expect(page.locator('#analyst-journey-status')).toContainText('Replay verified', {
      timeout: 15_000,
    });
    s5Outcome = 'replay-verified';
  }
  await captureState(page, '05-replay', true, s5Outcome, s5);

  // ---------------- Gate: no uncaught errors during the run ----------------
  expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `unexpected console.error: ${consoleErrors.join(' | ')}`).toEqual([]);

  // ---------------- Run JSON links screenshots ↔ states ↔ inventory ----------------
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  const runInventory = {
    schema: 'nemosyne/p1-uv0-baseline-run',
    schemaVersion: 1,
    baseSha: '81ec16b',
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