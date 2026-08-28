import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, type CDPSession } from '@playwright/test';

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
  const configured = process.env.NEMOSYNE_Q3B_ROW_COUNTS ?? '1000,8000,32000';
  const parsed = configured
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 100_000);
  if (parsed.length === 0) throw new Error('NEMOSYNE_Q3B_ROW_COUNTS resolved to no valid row counts.');
  return parsed;
}

test('Q3B measures the real Worker + WASM compact/full resource envelope', async ({ page }) => {
  test.skip(
    process.env.NEMOSYNE_Q3B_RESOURCE_PROBE !== '1',
    'Q3B resource envelope only runs in the isolated evidence pilot.'
  );

  await page.goto('/');
  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_RESOURCE_ENVELOPE__?.schemaVersion ?? null),
      { timeout: 15_000, message: 'Q3B instrumented resource hook is installed' }
    )
    .toBe(1);

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('HeapProfiler.enable');

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const scenarios: Array<Record<string, unknown>> = [];

  for (const rowCount of rowCounts()) {
    for (const operation of ['sort', 'anomaly'] as const) {
      await client.send('HeapProfiler.collectGarbage');
      const before = await metrics(client);

      const scenario = await page.evaluate(
        async (input) => {
          const hook = window.__NEMOSYNE_RESOURCE_ENVELOPE__;
          if (!hook) throw new Error('Q3B resource hook is unavailable.');
          return hook.runScenario(input);
        },
        { rowCount, operation }
      );

      const immediate = await metrics(client);
      await client.send('HeapProfiler.collectGarbage');
      const retained = await metrics(client);

      expect(scenario.executionMode).toBe('worker');
      expect(scenario.datasetVersionAfter).toBe(scenario.datasetVersionBefore + 1);
      expect(scenario.inputJsonBytesEstimate).toBeGreaterThan(0);
      expect(scenario.outputJsonBytesEstimate).toBeGreaterThan(0);
      expect(scenario.timingMs.operationEndToEnd).toBeGreaterThan(0);
      expect(scenario.timingMs.operationToRenderedFrames).toBeGreaterThanOrEqual(
        scenario.timingMs.operationEndToEnd
      );

      const registration = scenario.workerDiagnostics.find((sample) => sample.phase === 'registration');
      const execution = scenario.workerDiagnostics.find(
        (sample) => sample.phase === 'execution' && sample.operation === 'operation'
      );
      expect(registration, 'real Worker registration diagnostic exists').toBeTruthy();
      expect(execution, 'real Worker execution diagnostic exists').toBeTruthy();
      expect(execution?.resultKind).toBe(operation === 'sort' ? 'row-view' : 'dataset');
      expect(execution?.rowCount).toBe(rowCount);
      expect(execution?.columnCount).toBeGreaterThan(0);
      expect(execution?.timingMs.kernel).toBeGreaterThanOrEqual(0);
      expect(execution?.timingMs.materialize).toBeGreaterThanOrEqual(0);
      expect(execution?.wasmBytes.afterMaterialize).not.toBeNull();

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
    }
  }

  const comparisons = rowCounts().map((rowCount) => {
    const compact = scenarios.find(
      (scenario) => scenario.rowCount === rowCount && scenario.operation === 'sort'
    ) as Record<string, any> | undefined;
    const full = scenarios.find(
      (scenario) => scenario.rowCount === rowCount && scenario.operation === 'anomaly'
    ) as Record<string, any> | undefined;
    if (!compact || !full) throw new Error(`Q3B missing compact/full pair for ${rowCount} rows.`);

    const compactExecution = compact.workerDiagnostics.find(
      (sample: Record<string, any>) => sample.phase === 'execution'
    );
    const fullExecution = full.workerDiagnostics.find(
      (sample: Record<string, any>) => sample.phase === 'execution'
    );
    return {
      rowCount,
      fullVsCompactEndToEndRatio:
        full.timingMs.operationEndToEnd / Math.max(compact.timingMs.operationEndToEnd, 0.001),
      fullVsCompactWorkerMaterializeRatio:
        fullExecution.timingMs.materialize / Math.max(compactExecution.timingMs.materialize, 0.001),
      compactResultKind: compactExecution.resultKind,
      fullResultKind: fullExecution.resultKind,
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
    classification: 'synthetic-ci-resource-evidence',
    source: {
      sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
      workflowCheckoutSha: process.env.GITHUB_SHA ?? null,
      productionBundleSha256: process.env.NEMOSYNE_Q3B_BUNDLE_SHA256 ?? null,
      wasmSha256: process.env.NEMOSYNE_Q3B_WASM_SHA256 ?? null,
    },
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

  await mkdir('q3b-results', { recursive: true });
  await writeFile('q3b-results/resource-envelope.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('[Q3B] resource envelope summary', JSON.stringify(comparisons, null, 2));
});
