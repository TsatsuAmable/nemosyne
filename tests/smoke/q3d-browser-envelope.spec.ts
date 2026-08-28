import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { BrowserEnvelopeStageSample } from '../../src/app/browserEnvelopeDiagnostics.ts';

function rowCounts(): number[] {
  const configured = process.env.NEMOSYNE_Q3D_ROW_COUNTS ?? '1000,8000,32000';
  const parsed = configured
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000);
  if (parsed.length === 0) throw new Error('NEMOSYNE_Q3D_ROW_COUNTS resolved to no valid row counts.');
  return parsed;
}

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    workflowCheckoutSha: process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_Q3D_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_Q3D_WASM_SHA256 ?? null,
  };
}

function firstStage(stages: readonly BrowserEnvelopeStageSample[], name: string) {
  return stages.find((stage) => stage.name === name);
}

function totalStageMs(stages: readonly BrowserEnvelopeStageSample[], name: string): number {
  return stages
    .filter((stage) => stage.name === name)
    .reduce((sum, stage) => sum + stage.durationMs, 0);
}

function countStages(stages: readonly BrowserEnvelopeStageSample[], name: string): number {
  return stages.filter((stage) => stage.name === name).length;
}

function withinRoot(
  stages: readonly BrowserEnvelopeStageSample[],
  root: BrowserEnvelopeStageSample
): BrowserEnvelopeStageSample[] {
  const end = root.startOffsetMs + root.durationMs;
  return stages
    .filter(
      (stage) =>
        stage.startOffsetMs + 0.5 >= root.startOffsetMs &&
        stage.startOffsetMs + stage.durationMs <= end + 0.5
    )
    .sort((a, b) => a.startOffsetMs - b.startOffsetMs || a.durationMs - b.durationMs);
}

test('Q3D decomposes the post-RF059 browser operation envelope', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(
    process.env.NEMOSYNE_Q3D_BROWSER_PROBE !== '1',
    'Q3D browser envelope only runs in its isolated evidence pilot.'
  );

  await mkdir('q3d-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          resource: window.__NEMOSYNE_RESOURCE_ENVELOPE__?.schemaVersion ?? null,
          browser: window.__NEMOSYNE_BROWSER_ENVELOPE__?.schemaVersion ?? null,
        })),
      { timeout: 15_000, message: 'Q3D instrumented resource and browser hooks are installed' }
    )
    .toEqual({ resource: 1, browser: 1 });

  const scenarios = [];
  for (const rowCount of rowCounts()) {
    const result = await page.evaluate(async (count) => {
      const resource = window.__NEMOSYNE_RESOURCE_ENVELOPE__;
      const browser = window.__NEMOSYNE_BROWSER_ENVELOPE__;
      if (!resource || !browser) throw new Error('Q3D diagnostic hooks are unavailable.');
      browser.startCapture();
      try {
        const scenario = await resource.runScenario({
          rowCount: count,
          operation: 'sort',
          materialization: 'compact',
        });
        const capture = browser.stopCapture();
        return { scenario, capture };
      } catch (error) {
        try {
          browser.stopCapture();
        } catch {
          // preserve the original failure
        }
        throw error;
      }
    }, rowCount);

    const root = firstStage(result.capture.stages, 'controller.applyAsync');
    expect(root, `${rowCount}: controller stage exists`).toBeTruthy();
    const operationStages = withinRoot(result.capture.stages, root!);
    const atlas = firstStage(operationStages, 'atlas.applyAnalysisAsync');
    const worker = firstStage(operationStages, 'workerPort.execute.operation');
    const commit = firstStage(operationStages, 'analytical.commitKernelResult');
    const visual = firstStage(operationStages, 'controller.applyVisual');
    const operationEvent = firstStage(operationStages, 'event.operation:applied');
    const autosaveEvent = firstStage(operationStages, 'event.session:autosave-request');
    const spatialInvalidation = firstStage(operationStages, 'input.invalidateSpatialAcceleration');

    expect(atlas, `${rowCount}: Atlas stage exists`).toBeTruthy();
    expect(worker, `${rowCount}: Worker round-trip stage exists`).toBeTruthy();
    expect(commit, `${rowCount}: durable analytical commit stage exists`).toBeTruthy();
    expect(visual, `${rowCount}: visual stage exists`).toBeTruthy();
    expect(operationEvent, `${rowCount}: operation event stage exists`).toBeTruthy();
    expect(autosaveEvent, `${rowCount}: autosave request stage exists`).toBeTruthy();
    expect(spatialInvalidation, `${rowCount}: spatial invalidation stage exists`).toBeTruthy();

    expect(result.scenario.executionMode).toBe('worker');
    expect(result.scenario.operation).toBe('sort');
    expect(result.scenario.requestedMaterialization).toBe('compact');
    expect(result.scenario.expectedWorkerResultKind).toBe('row-view');
    expect(result.scenario.datasetFingerprintBefore).toMatch(/^[0-9a-f]{64}$/);
    expect(result.scenario.datasetFingerprintAfter).toMatch(/^[0-9a-f]{64}$/);
    expect(Math.abs(root!.durationMs - result.scenario.timingMs.operationEndToEnd)).toBeLessThan(25);

    const rootEnd = root!.startOffsetMs + root!.durationMs;
    const atlasEnd = atlas!.startOffsetMs + atlas!.durationMs;
    const decomposition = {
      controllerTotalMs: root!.durationMs,
      controllerPreAtlasMs: Math.max(0, atlas!.startOffsetMs - root!.startOffsetMs),
      atlasTotalMs: atlas!.durationMs,
      workerPortRoundTripMs: worker!.durationMs,
      atlasPostWorkerMs: Math.max(0, atlas!.durationMs - worker!.durationMs),
      commitKernelResultMs: commit!.durationMs,
      controllerPostAtlasMs: Math.max(0, rootEnd - atlasEnd),
      visualApplyMs: visual!.durationMs,
      operationEventMs: operationEvent!.durationMs,
      autosaveRequestEventMs: autosaveEvent!.durationMs,
      spatialInvalidationMs: spatialInvalidation!.durationMs,
      datasetCloneTotalMs: totalStageMs(operationStages, 'dataset.clone'),
      datasetCloneCount: countStages(operationStages, 'dataset.clone'),
      datasetToJsonTotalMs: totalStageMs(operationStages, 'dataset.toJSON'),
      datasetToJsonCount: countStages(operationStages, 'dataset.toJSON'),
      renderSettlementAfterControllerMs: Math.max(
        0,
        result.scenario.timingMs.operationToRenderedFrames - result.scenario.timingMs.operationEndToEnd
      ),
    };

    scenarios.push({
      rowCount,
      scenario: result.scenario,
      decomposition,
      operationStages,
    });

    await writeFile(
      'q3d-results/browser-envelope.partial.json',
      `${JSON.stringify(
        {
          schemaVersion: 1,
          classification: 'diagnostic-only-partial',
          source: sourceMetadata(),
          completedScenarios: scenarios,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  }

  const report = {
    schemaVersion: 1,
    classification: 'synthetic-ci-browser-envelope-decomposition',
    experiment: {
      operation: 'sort',
      materialization: 'compact-row-view',
      purpose: 'decompose post-RF059 browser-side latency without changing production semantics',
    },
    source: sourceMetadata(),
    environment: {
      physicalQuestEvidence: false,
      datasetClass: 'deterministic synthetic tabular',
      traceOrScreenshotRetained: false,
    },
    scenarios,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.workflowCheckoutSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile('q3d-results/browser-envelope.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    '[Q3D] browser envelope decomposition',
    JSON.stringify(scenarios.map(({ rowCount, decomposition }) => ({ rowCount, ...decomposition })), null, 2)
  );
});