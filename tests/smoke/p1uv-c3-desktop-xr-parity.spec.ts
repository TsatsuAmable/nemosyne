import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { NemosyneUv0TestHandle, Uv0RuntimeSnapshot } from '../../src/app/uv0TestHandle.ts';
import { INVESTIGATOR_TASKS } from '../../src/app/intents/InvestigatorTaskIntent.ts';

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    checkoutHeadSha: process.env.NEMOSYNE_CHECKOUT_HEAD_SHA ?? null,
    workflowEventSha: process.env.NEMOSYNE_WORKFLOW_EVENT_SHA ?? process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_C3_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_C3_WASM_SHA256 ?? null,
  };
}

async function runtimeSnapshot(page: import('@playwright/test').Page): Promise<Uv0RuntimeSnapshot> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
      .__NEMOSYNE_UV0__;
    if (!hook) throw new Error('UV0 product evidence handle unavailable.');
    return hook.snapshot();
  });
}

async function selectNodeAndWaitForProjection(page: import('@playwright/test').Page): Promise<void> {
  const selected = await page.evaluate(() => {
    const hook = (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
      .__NEMOSYNE_UV0__;
    if (!hook) throw new Error('UV0 product evidence handle unavailable.');
    return hook.selectNode(0);
  });
  expect(selected).toBe(true);
  // No synthetic pointer/focus event is sent here. C3 must update the desktop
  // projection from the authoritative RepresentationSurface selection signal.
  await expect(page.locator('#desktop-selection-context')).toContainText('Selected ·');
}

test('P1-UV C3 proves desktop selected-object tasks share the production investigation path', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(
    process.env.NEMOSYNE_C3_BROWSER_PROBE !== '1',
    'C3 product evidence runs only in its isolated exact-head workflow.',
  );

  await mkdir('p1uv-c3-results', { recursive: true });
  await page.goto('/?nemosyne-uv0=1');
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as unknown as { __NEMOSYNE_UV0__?: NemosyneUv0TestHandle })
              .__NEMOSYNE_UV0__ != null,
        ),
      { timeout: 15_000, message: 'UV0 exact product-path evidence handle is installed' },
    )
    .toBe(true);

  const initial = await runtimeSnapshot(page);
  expect(initial.palaceNodeCount).toBeGreaterThan(0);
  expect(initial.kernelAvailable).toBe(true);

  await selectNodeAndWaitForProjection(page);
  for (const task of INVESTIGATOR_TASKS) {
    const button = page.locator(`#desktop-task-${task.id}`);
    await expect(button).toHaveText(task.label);
  }
  await page.screenshot({ path: 'p1uv-c3-results/c3-selected-task-parity.png', fullPage: true });

  const beforeRecord = await runtimeSnapshot(page);
  await page.locator('#desktop-task-record').click();
  await expect
    .poll(async () => (await runtimeSnapshot(page)).observationCount, { timeout: 10_000 })
    .toBeGreaterThan(beforeRecord.observationCount);
  const afterRecord = await runtimeSnapshot(page);
  expect(afterRecord.taskSurfaceVisible).toBe(false);
  await expect(page.locator('#desktop-selection-context')).toContainText('Select a data object');

  await selectNodeAndWaitForProjection(page);
  await page.locator('#desktop-task-inspect').click();
  await expect
    .poll(async () => (await runtimeSnapshot(page)).inspectorVisible, { timeout: 10_000 })
    .toBe(true);
  const afterInspect = await runtimeSnapshot(page);
  expect(afterInspect.taskSurfaceVisible).toBe(false);
  await page.screenshot({ path: 'p1uv-c3-results/c3-desktop-inspect.png', fullPage: true });

  // A dataset rebuild must invalidate both the XR contextual selection and its
  // desktop projection. This proves the desktop rail cannot retain a stale row.
  await selectNodeAndWaitForProjection(page);
  const selectedDataset = (await runtimeSnapshot(page)).datasetName;
  await page.locator('#action-load-sample').click();
  await expect
    .poll(async () => (await runtimeSnapshot(page)).datasetName, { timeout: 20_000 })
    .not.toBe(selectedDataset);
  await expect(page.locator('#desktop-selection-context')).toContainText('Select a data object');
  for (const task of INVESTIGATOR_TASKS) {
    await expect(page.locator(`#desktop-task-${task.id}`)).toHaveAttribute('disabled', '');
  }
  const afterDatasetChange = await runtimeSnapshot(page);
  expect(afterDatasetChange.taskSurfaceVisible).toBe(false);

  const report = {
    schemaVersion: 1,
    classification: 'p1uv-c3-desktop-xr-parity-production-browser-evidence',
    source: sourceMetadata(),
    claims: {
      physicalQuestEvidence: false,
      analyticalAuthorityChanged: false,
      newSelectionAuthorityAdded: false,
      desktopUsesCanonicalTaskVocabulary: true,
      desktopSelectionUsesAuthoritativeSurfaceSignal: true,
      desktopRecordUsesAuthoritativeEvidenceOwner: true,
      desktopInspectUsesExistingInspectorOwner: true,
      selectionInvalidatedAcrossDatasetRebuild: true,
      screenshotsRetained: true,
    },
    tasks: INVESTIGATOR_TASKS,
    initial,
    afterRecord,
    afterInspect,
    afterDatasetChange,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.checkoutHeadSha).toBe(report.source.sourceHeadSha);
  expect(report.source.workflowEventSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile(
    'p1uv-c3-results/c3-desktop-xr-parity.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
});
