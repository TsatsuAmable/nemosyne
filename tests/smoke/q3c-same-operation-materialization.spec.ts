import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, type CDPSession } from '@playwright/test';
import type { ResourceEnvelopeScenarioResult } from '../../src/app/resourceEnvelopeDiagnostics.ts';
import type { AnalyticalWorkerDiagnostic } from '../../src/atlas/ports/AnalyticalExecutionPort.ts';

interface MetricSnapshot {
  [name: string]: number;
}

interface ScenarioCdpEvidence {
  before: MetricSnapshot;
  immediate: MetricSnapshot;
  retainedAfterForcedGc: MetricSnapshot;
  immediateDelta: MetricSnapshot;
  retainedDeltaAfterForcedGc: MetricSnapshot;
}

type ScenarioEvidence = ResourceEnvelopeScenarioResult & { cdp: ScenarioCdpEvidence };

const METRIC_NAMES = [
  'JSHeapUsedSize',
  'JSHeapTotalSize',
  'Nodes',
  'TaskDuration',
  'ScriptDuration',
  'LayoutDuration',
  'RecalcStyleDuration',
] as const;

async function metrics(client: CDPSession): Promise<MetricSnapshot> {
  const response = await client.send('Performance.getMetrics');
  const values = new Map(response.metrics.map((entry) => [entry.name, entry.value]));
  return Object.fromEntries(METRIC_NAMES.map((name) => [name, values.get(name) ?? Number.NaN]));
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

function rowCounts(): number[] {
  const configured = process.env.NEMOSYNE_Q3C_ROW_COUNTS ?? '1000,8000,32000';
  const parsed = configured
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000);
  if (parsed.length === 0) throw new Error('NEMOSYNE_Q3C_ROW_COUNTS resolved to no valid row counts.');
  return parsed;
}

function executionDiagnostic(scenario: ScenarioEvidence): AnalyticalWorkerDiagnostic {
  const execution = scenario.workerDiagnostics.find(
    (sample) => sample.phase === 'execution' && sample.operation === 'operation'
  );
  if (!execution) {
    throw new Error(
      `Q3C missing Worker execution diagnostic for ${scenario.rowCount}/${scenario.requestedMaterialization}.`
    );
  }
  return execution;
}

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    workflowCheckoutSha: process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_Q3C_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_Q3C_WASM_SHA256 ?? null,
  };
}

test('Q3C isolates compact versus full result materialization for the same Rust sort', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(
    process.env.NEMOSYNE_Q3C_RESOURCE_PROBE !== '1',
    'Q3C same-operation resource envelope only runs in its isolated evidence pilot.'
  );

  await mkdir('q3c-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_RESOURCE_ENVELOPE__?.schemaVersion ?? null),
      { timeout: 15_000, message: 'Q3C instrumented resource hook is installed' }
    )
    .toBe(1);

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('HeapProfiler.enable');

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const scenarios: ScenarioEvidence[] = [];
  const configuredRowCounts = rowCounts();

  for (const rowCount of configuredRowCounts) {
    for (const materialization of ['compact', 'full'] as const) {
      await client.send('HeapProfiler.collectGarbage');
      const before = await metrics(client);

      const scenario = await page.evaluate(
        async (input) => {
          const hook = window.__NEMOSYNE_RESOURCE_ENVELOPE__;
          if (!hook) throw new Error('Q3C resource hook is unavailable.');
          return hook.runScenario(input);
        },
        { rowCount, operation: 'sort' as const, materialization }
      );

      const immediate = await metrics(client);
      await client.send('HeapProfiler.collectGarbage');
      const retained = await metrics(client);

      expect(scenario.executionMode).toBe('worker');
      expect(scenario.operation).toBe('sort');
      expect(scenario.requestedMaterialization).toBe(materialization);
      expect(scenario.datasetVersionAfter).toBe(scenario.datasetVersionBefore + 1);
      expect(scenario.datasetFingerprintBefore).toMatch(/^[0-9a-f]{64}$/);
      expect(scenario.datasetFingerprintAfter).toMatch(/^[0-9a-f]{64}$/);
      expect(scenario.inputJsonBytesEstimate).toBeGreaterThan(0);
      expect(scenario.outputJsonBytesEstimate).toBeGreaterThan(0);
      expect(scenario.timingMs.operationEndToEnd).toBeGreaterThan(0);
      expect(scenario.timingMs.operationToRenderedFrames).toBeGreaterThanOrEqual(
        scenario.timingMs.operationEndToEnd
      );

      const registration = scenario.workerDiagnostics.find((sample) => sample.phase === 'registration');
      const execution = executionDiagnostic({
        ...scenario,
        cdp: {
          before,
          immediate,
          retainedAfterForcedGc: retained,
          immediateDelta: delta(immediate, before),
          retainedDeltaAfterForcedGc: delta(retained, before),
        },
      });
      expect(registration, 'real Worker registration diagnostic exists').toBeTruthy();
      expect(execution.resultKind).toBe(materialization === 'compact' ? 'row-view' : 'dataset');
      expect(execution.operationName).toBe('sort');
      expect(execution.rowCount).toBe(rowCount);
      expect(execution.columnCount).toBeGreaterThan(0);
      expect(execution.timingMs.kernel).toBeGreaterThanOrEqual(0);
      expect(execution.timingMs.materialize).toBeGreaterThanOrEqual(0);
      expect(execution.wasmBytes.afterMaterialize).not.toBeNull();

      scenarios.push({
        ...scenario,
        cdp: {
          before,
          immediate,
          retainedAfterForcedGc: retained,
          immediateDelta: delta(immediate, before),
          retainedDeltaAfterForcedGc: delta(retained, before),
        },
      });

      await writeFile(
        'q3c-results/same-operation-materialization.partial.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            classification: 'diagnostic-only-partial',
            source: sourceMetadata(),
            environment: { userAgent, physicalQuestEvidence: false },
            completedScenarios: scenarios,
          },
          null,
          2
        )}\n`,
        'utf8'
      );
    }
  }

  const comparisons = configuredRowCounts.map((rowCount) => {
    const compact = scenarios.find(
      (scenario) =>
        scenario.rowCount === rowCount && scenario.requestedMaterialization === 'compact'
    );
    const full = scenarios.find(
      (scenario) => scenario.rowCount === rowCount && scenario.requestedMaterialization === 'full'
    );
    if (!compact || !full) throw new Error(`Q3C missing compact/full pair for ${rowCount} rows.`);

    expect(full.datasetFingerprintBefore).toBe(compact.datasetFingerprintBefore);
    expect(full.datasetFingerprintAfter).toBe(compact.datasetFingerprintAfter);
    expect(full.outputJsonBytesEstimate).toBe(compact.outputJsonBytesEstimate);

    const compactExecution = executionDiagnostic(compact);
    const fullExecution = executionDiagnostic(full);
    return {
      rowCount,
      inputFingerprint: compact.datasetFingerprintBefore,
      outputFingerprint: compact.datasetFingerprintAfter,
      compactResultKind: compactExecution.resultKind,
      fullResultKind: fullExecution.resultKind,
      fullVsCompactKernelRatio:
        (fullExecution.timingMs.kernel ?? 0) / Math.max(compactExecution.timingMs.kernel ?? 0, 0.001),
      fullVsCompactWorkerMaterializeRatio:
        (fullExecution.timingMs.materialize ?? 0) /
        Math.max(compactExecution.timingMs.materialize ?? 0, 0.001),
      fullVsCompactWorkerTotalRatio:
        fullExecution.timingMs.total / Math.max(compactExecution.timingMs.total, 0.001),
      fullVsCompactEndToEndRatio:
        full.timingMs.operationEndToEnd / Math.max(compact.timingMs.operationEndToEnd, 0.001),
      fullVsCompactRenderedRatio:
        full.timingMs.operationToRenderedFrames /
        Math.max(compact.timingMs.operationToRenderedFrames, 0.001),
      compactWorkerWasmGrowthBytes:
        (compactExecution.wasmBytes.afterMaterialize ?? 0) - (compactExecution.wasmBytes.before ?? 0),
      fullWorkerWasmGrowthBytes:
        (fullExecution.wasmBytes.afterMaterialize ?? 0) - (fullExecution.wasmBytes.before ?? 0),
      compactRetainedPageHeapDeltaBytes: compact.cdp.retainedDeltaAfterForcedGc.JSHeapUsedSize,
      fullRetainedPageHeapDeltaBytes: full.cdp.retainedDeltaAfterForcedGc.JSHeapUsedSize,
      compactTaskDurationDeltaSec: compact.cdp.immediateDelta.TaskDuration,
      fullTaskDurationDeltaSec: full.cdp.immediateDelta.TaskDuration,
    };
  });

  const report = {
    schemaVersion: 1,
    classification: 'synthetic-ci-same-operation-resource-evidence',
    experiment: {
      operation: 'sort',
      independentVariable: 'worker-result-materialization',
      modes: ['row-view-if-lossless', 'full-dataset'],
    },
    source: sourceMetadata(),
    environment: {
      userAgent,
      xrActive: false,
      physicalQuestEvidence: false,
      cdpForcedGcScope: 'page-main-isolate-only',
      workerWasmMemorySource: 'instrumented-worker-memory-buffer',
    },
    scenarios,
    comparisons,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.workflowCheckoutSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile(
    'q3c-results/same-operation-materialization.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  console.log('[Q3C] same-operation materialization summary', JSON.stringify(comparisons, null, 2));
});
