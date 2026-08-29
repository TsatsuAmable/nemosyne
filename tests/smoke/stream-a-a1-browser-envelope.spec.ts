import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, type CDPSession } from '@playwright/test';
import type { BrowserEnvelopeStageSample } from '../../src/app/browserEnvelopeDiagnostics.ts';
import type { AnalyticalWorkerDiagnostic } from '../../src/atlas/ports/AnalyticalExecutionPort.ts';

interface MetricSnapshot {
  [name: string]: number;
}

const METRIC_NAMES = [
  'JSHeapUsedSize',
  'JSHeapTotalSize',
  'Nodes',
  'TaskDuration',
  'ScriptDuration',
  'LayoutDuration',
  'RecalcStyleDuration',
] as const;

function rowCounts(): number[] {
  const configured = process.env.NEMOSYNE_A1_ROW_COUNTS ?? '1000,8000,32000';
  const values = configured
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000);
  if (values.length === 0) throw new Error('NEMOSYNE_A1_ROW_COUNTS resolved to no valid values.');
  return values;
}

async function metrics(client: CDPSession): Promise<MetricSnapshot> {
  const response = await client.send('Performance.getMetrics');
  const byName = new Map(response.metrics.map((entry) => [entry.name, entry.value]));
  return Object.fromEntries(METRIC_NAMES.map((name) => [name, byName.get(name) ?? Number.NaN]));
}

function delta(after: MetricSnapshot, before: MetricSnapshot): MetricSnapshot {
  return Object.fromEntries(
    METRIC_NAMES.map((name) => [
      name,
      Number.isFinite(after[name]) && Number.isFinite(before[name])
        ? after[name] - before[name]
        : Number.NaN,
    ])
  );
}

function firstStage(stages: readonly BrowserEnvelopeStageSample[], name: string) {
  return stages.find((stage) => stage.name === name);
}

function countStages(stages: readonly BrowserEnvelopeStageSample[], name: string): number {
  return stages.filter((stage) => stage.name === name).length;
}

function totalStageMs(stages: readonly BrowserEnvelopeStageSample[], name: string): number {
  return stages
    .filter((stage) => stage.name === name)
    .reduce((sum, stage) => sum + stage.durationMs, 0);
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

function executionDiagnostic(samples: readonly AnalyticalWorkerDiagnostic[]): AnalyticalWorkerDiagnostic {
  const sample = [...samples]
    .reverse()
    .find((entry) => entry.phase === 'execution' && entry.operation === 'operation');
  if (!sample) throw new Error('A1 missing Worker execution diagnostic.');
  return sample;
}

function registrationDiagnostic(samples: readonly AnalyticalWorkerDiagnostic[]): AnalyticalWorkerDiagnostic {
  const sample = [...samples].reverse().find((entry) => entry.phase === 'registration');
  if (!sample) throw new Error('A1 missing Worker registration diagnostic.');
  return sample;
}

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    workflowCheckoutSha: process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_A1_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_A1_WASM_SHA256 ?? null,
  };
}

test('A1 measures the real browser -> Worker -> WASM -> presentation envelope', async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(
    process.env.NEMOSYNE_A1_BROWSER_PROBE !== '1',
    'A1 resource envelope only runs in its isolated exact-head evidence workflow.'
  );

  await mkdir('stream-a-a1-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () =>
        page.evaluate(() => ({
          resource: window.__NEMOSYNE_RESOURCE_ENVELOPE__?.schemaVersion ?? null,
          browser: window.__NEMOSYNE_BROWSER_ENVELOPE__?.schemaVersion ?? null,
        })),
      { timeout: 15_000, message: 'A1 resource and browser diagnostic hooks are installed' }
    )
    .toEqual({ resource: 1, browser: 1 });

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('HeapProfiler.enable');
  const userAgent = await page.evaluate(() => navigator.userAgent);
  const scenarios = [];

  for (const rowCount of rowCounts()) {
    await client.send('HeapProfiler.collectGarbage');
    const before = await metrics(client);

    const result = await page.evaluate(async (count) => {
      const resource = window.__NEMOSYNE_RESOURCE_ENVELOPE__;
      const browser = window.__NEMOSYNE_BROWSER_ENVELOPE__;
      if (!resource || !browser) throw new Error('A1 diagnostic hooks are unavailable.');

      const statsBefore = browser.derivedStats();
      browser.startCapture();
      try {
        const scenario = await resource.runScenario({
          rowCount: count,
          operation: 'sort',
          materialization: 'compact',
        });
        const mutationReturnedAt = performance.now();
        await browser.waitForDerivedIdle();
        const derivedSettledAt = performance.now();
        const statsAfter = browser.derivedStats();
        return {
          scenario,
          capture: browser.stopCapture(),
          statsBefore,
          statsAfter,
          derivedSettlementAfterMutationMs: derivedSettledAt - mutationReturnedAt,
        };
      } catch (error) {
        try {
          browser.stopCapture();
        } catch {
          // Preserve the original failure.
        }
        throw error;
      }
    }, rowCount);

    const immediate = await metrics(client);
    await client.send('HeapProfiler.collectGarbage');
    const retained = await metrics(client);

    const root = firstStage(result.capture.stages, 'controller.applyAsync');
    expect(root, `${rowCount}: controller stage exists`).toBeTruthy();
    const operationStages = withinRoot(result.capture.stages, root!);
    const atlas = firstStage(operationStages, 'atlas.applyAnalysisAsync');
    const workerPort = firstStage(operationStages, 'workerPort.execute.operation');
    const commit = firstStage(operationStages, 'analytical.commitKernelResult');
    const visual = firstStage(operationStages, 'controller.applyVisual');
    const operationEvent = firstStage(operationStages, 'event.operation:applied');

    expect(atlas, `${rowCount}: Atlas stage exists`).toBeTruthy();
    expect(workerPort, `${rowCount}: Worker round-trip stage exists`).toBeTruthy();
    expect(commit, `${rowCount}: analytical commit stage exists`).toBeTruthy();
    expect(visual, `${rowCount}: visual stage exists`).toBeTruthy();
    expect(operationEvent, `${rowCount}: operation event stage exists`).toBeTruthy();

    const registration = registrationDiagnostic(result.scenario.workerDiagnostics);
    const execution = executionDiagnostic(result.scenario.workerDiagnostics);

    expect(result.scenario.executionMode).toBe('worker');
    expect(result.scenario.operation).toBe('sort');
    expect(result.scenario.requestedMaterialization).toBe('compact');
    expect(result.scenario.expectedWorkerResultKind).toBe('row-view');
    expect(execution.resultKind).toBe('row-view');
    expect(result.scenario.datasetVersionAfter).toBe(result.scenario.datasetVersionBefore + 1);
    expect(result.scenario.datasetFingerprintBefore).toMatch(/^[0-9a-f]{64}$/);
    expect(result.scenario.datasetFingerprintAfter).toMatch(/^[0-9a-f]{64}$/);
    expect(execution.wasmBytes.afterMaterialize).not.toBeNull();
    expect(execution.timingMs.kernel).toBeGreaterThanOrEqual(0);
    expect(execution.timingMs.materialize).toBeGreaterThanOrEqual(0);

    const requestedDelta = result.statsAfter.requested - result.statsBefore.requested;
    const completedDelta = result.statsAfter.completed - result.statsBefore.completed;
    const refusedDelta = result.statsAfter.refused - result.statsBefore.refused;
    const failedDelta = result.statsAfter.failed - result.statsBefore.failed;
    const staleDelta =
      result.statsAfter.staleBeforeCompute - result.statsBefore.staleBeforeCompute +
      result.statsAfter.staleAfterCompute - result.statsBefore.staleAfterCompute;

    expect(requestedDelta, `${rowCount}: one automatic derived generation`).toBe(1);
    expect(failedDelta, `${rowCount}: no generic derived failure`).toBe(0);
    expect(staleDelta, `${rowCount}: no deterministic stale settlement`).toBe(0);
    expect(completedDelta + refusedDelta, `${rowCount}: explicit derived terminal state`).toBe(1);

    const rootEnd = root!.startOffsetMs + root!.durationMs;
    const atlasEnd = atlas!.startOffsetMs + atlas!.durationMs;
    const scenario = {
      workload: {
        rowCount,
        columnCount: 5,
        numericDimensions: 4,
        operation: 'sort',
        materialization: 'compact-row-view',
      },
      identity: {
        datasetVersionBefore: result.scenario.datasetVersionBefore,
        datasetVersionAfter: result.scenario.datasetVersionAfter,
        datasetFingerprintBefore: result.scenario.datasetFingerprintBefore,
        datasetFingerprintAfter: result.scenario.datasetFingerprintAfter,
      },
      transport: {
        registrationScientificJsonBytesProxy: result.scenario.inputJsonBytesEstimate,
        outputScientificJsonBytesProxy: result.scenario.outputJsonBytesEstimate,
        workerResultKind: execution.resultKind,
        exactStructuredCloneBytesMeasured: false,
      },
      worker: {
        registrationTotalMs: registration.timingMs.total,
        executionTotalMs: execution.timingMs.total,
        bridgeReadyMs: execution.timingMs.bridgeReady ?? null,
        kernelMs: execution.timingMs.kernel ?? null,
        materializeMs: execution.timingMs.materialize ?? null,
        wasmBytes: execution.wasmBytes,
        hostBufferAllocations: execution.hostBufferAllocations,
      },
      browser: {
        controllerTotalMs: root!.durationMs,
        controllerPreAtlasMs: Math.max(0, atlas!.startOffsetMs - root!.startOffsetMs),
        atlasTotalMs: atlas!.durationMs,
        workerPortRoundTripMs: workerPort!.durationMs,
        atlasPostWorkerMs: Math.max(0, atlas!.durationMs - workerPort!.durationMs),
        commitKernelResultMs: commit!.durationMs,
        controllerPostAtlasMs: Math.max(0, rootEnd - atlasEnd),
        visualApplyMs: visual!.durationMs,
        operationEventMs: operationEvent!.durationMs,
        datasetCloneCount: countStages(operationStages, 'dataset.clone'),
        datasetCloneTotalMs: totalStageMs(operationStages, 'dataset.clone'),
        datasetToJsonCount: countStages(operationStages, 'dataset.toJSON'),
        datasetToJsonTotalMs: totalStageMs(operationStages, 'dataset.toJSON'),
        renderSettlementAfterControllerMs: Math.max(
          0,
          result.scenario.timingMs.operationToRenderedFrames - result.scenario.timingMs.operationEndToEnd
        ),
        derivedSettlementAfterMutationMs: result.derivedSettlementAfterMutationMs,
        derivedTerminal: completedDelta === 1 ? 'completed' : 'refused',
      },
      mainPage: {
        immediate: delta(immediate, before),
        retainedAfterForcedGc: delta(retained, before),
        forcedGcScope: 'page-main-isolate-only',
      },
      scene: result.scenario.scene,
    };

    scenarios.push(scenario);
    await writeFile(
      'stream-a-a1-results/a1-envelope.partial.json',
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
    classification: 'stream-a-a1-synthetic-browser-resource-evidence',
    source: sourceMetadata(),
    environment: {
      userAgent,
      physicalQuestEvidence: false,
      datasetClass: 'deterministic synthetic tabular',
      workerGcMeasured: false,
      processRssMeasuredInBrowser: false,
      exactStructuredCloneBytesMeasured: false,
      traceOrScreenshotRetained: false,
    },
    scenarios,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.workflowCheckoutSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile(
    'stream-a-a1-results/a1-browser-worker-wasm-envelope.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  console.log('[Stream A A1] browser/Worker/WASM envelope', JSON.stringify(scenarios, null, 2));
});
