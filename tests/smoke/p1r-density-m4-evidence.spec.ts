import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

function rowCounts(): number[] {
  const configured = process.env.NEMOSYNE_DENSITY_M4_ROW_COUNTS ?? '1000,8000,32000';
  const values = configured
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value >= 50 && value <= 100_000);
  if (values.length === 0) {
    throw new Error('NEMOSYNE_DENSITY_M4_ROW_COUNTS has no valid values.');
  }
  return values;
}

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    checkoutHeadSha: process.env.NEMOSYNE_CHECKOUT_HEAD_SHA ?? null,
    workflowEventSha: process.env.NEMOSYNE_WORKFLOW_EVENT_SHA ?? process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_DENSITY_M4_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_DENSITY_M4_WASM_SHA256 ?? null,
  };
}

function assertReadyDensityScenario(
  scenario: Awaited<
    ReturnType<NonNullable<Window['__NEMOSYNE_RESOURCE_ENVELOPE__']>['runDensityScenario']>
  >,
  rowCount: number,
  shape: 'multimodal' | 'sparse' | 'uniform' | 'constant'
): void {
  expect(scenario.sourceRowCount).toBe(rowCount);
  expect(scenario.shape).toBe(shape);
  expect(scenario.measureFieldX).toBe('x');
  expect(scenario.measureFieldY).toBe('y');
  expect(scenario.candidateId).toBe('DENSITY_FIELD');
  expect(scenario.initialStatus).toBe('PENDING');
  expect(scenario.finalStatus).toBe('READY');
  expect(scenario.statusSurface).toEqual({
    pendingWasVisible: true,
    readySurfaceRemoved: true,
  });

  expect(scenario.datasetFingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(scenario.envelope.datasetFingerprint).toBe(scenario.datasetFingerprint);
  expect(scenario.envelope.candidateId).toBe('DENSITY_FIELD');
  expect(scenario.envelope.representationFamily).toBe('DENSITY');
  expect(scenario.envelope.provenance.decisionId).toBe(scenario.decisionId);
  expect(scenario.envelope.result.status).toBe('READY');
  if (scenario.envelope.result.status !== 'READY') throw new Error('unreachable refusal');
  expect(scenario.envelope.result.payload.kind).toBe('BINNED_DENSITY');
  if (scenario.envelope.result.payload.kind !== 'BINNED_DENSITY') {
    throw new Error('Density M4 received the wrong READY payload kind.');
  }

  const density = scenario.envelope.result.payload.data;
  expect(density.measureFieldX).toBe('x');
  expect(density.measureFieldY).toBe('y');
  expect(density.binsX).toBe(10);
  expect(density.binsY).toBe(10);
  expect(density.grid).toHaveLength(100);
  expect(density.counts.sourceCount).toBe(rowCount);
  expect(density.counts.validCount).toBe(rowCount);
  expect(density.counts.excludedCount).toBe(0);
  expect(density.grid.reduce((sum, cell) => sum + cell.count, 0)).toBe(rowCount);

  expect(scenario.envelope.resource.sourceRowCount).toBe(rowCount);
  expect(scenario.envelope.resource.elementCount).toBe(100);
  expect(scenario.envelope.resource.elementCount).toBeLessThanOrEqual(
    scenario.envelope.resource.maxElementCount
  );
  expect(scenario.envelope.resource.maxElementCount).toBeLessThanOrEqual(400);
  expect(scenario.payloadJsonBytesProxy).toBeGreaterThan(0);

  expect(scenario.artifact.analyticalMeshCount).toBe(100);
  expect(scenario.artifact.occupiedCellCount + scenario.artifact.zeroCellCount).toBe(100);
  expect(scenario.artifact.maxCellCount).toBeGreaterThan(0);
  expect(new Set(scenario.artifact.semanticIds).size).toBe(100);
  expect(scenario.artifact.representationKinds).toEqual(Array(100).fill('DENSITY_FIELD'));

  expect(scenario.perceptualBinding.artifactId).toBe(scenario.artifact.artifactId);
  expect(scenario.perceptualBinding.datasetFingerprint).toBe(scenario.datasetFingerprint);
  expect(scenario.perceptualBinding.candidateId).toBe('DENSITY_FIELD');
  expect(scenario.perceptualBinding.payloadKind).toBe('BINNED_DENSITY');
  expect(scenario.perceptualBinding.decisionId).toBe(scenario.decisionId);
  expect(scenario.perceptualBinding.evidence.source).toBe('measured');
  expect(scenario.perceptualBinding.evidence.measured?.viewpointEnvelope).toHaveLength(9);

  const workerExecution = scenario.workerDiagnostics.find(
    (sample) =>
      sample.phase === 'execution' &&
      sample.operation === 'semanticEmbodiment' &&
      sample.operationName === 'DENSITY_FIELD'
  );
  expect(workerExecution).toBeTruthy();
  expect(workerExecution?.resultKind).toBe('scalar');
  expect(scenario.workerExecution.kernelMs).not.toBeNull();
  expect(scenario.workerExecution.kernelMs ?? -1).toBeGreaterThanOrEqual(0);
  if (
    scenario.workerExecution.wasmBytesBefore !== null &&
    scenario.workerExecution.wasmBytesAfterKernel !== null
  ) {
    expect(scenario.workerExecution.wasmBytesAfterKernel).toBeGreaterThanOrEqual(
      scenario.workerExecution.wasmBytesBefore
    );
  }
  if (
    scenario.workerExecution.wasmBytesAfterKernel !== null &&
    scenario.workerExecution.wasmBytesAfterMaterialize !== null
  ) {
    expect(scenario.workerExecution.wasmBytesAfterMaterialize).toBeGreaterThanOrEqual(
      scenario.workerExecution.wasmBytesAfterKernel
    );
  }

  expect(scenario.timingMs.requestToReady).toBeGreaterThanOrEqual(0);
  expect(scenario.timingMs.readyToRenderedFrames).toBeGreaterThanOrEqual(0);
  expect(scenario.scene.renderCallsLastFrame).toBeGreaterThan(0);
}

test('R2C M4 proves bounded visible density across scale and semantic shapes', async ({ page }) => {
  test.setTimeout(300_000);
  test.skip(
    process.env.NEMOSYNE_DENSITY_M4_BROWSER_PROBE !== '1',
    'Density M4 evidence runs only in its isolated exact-head workflow.'
  );

  await mkdir('p1r-density-m4-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_RESOURCE_ENVELOPE__?.schemaVersion ?? null),
      { timeout: 15_000, message: 'Density M4 production evidence hook is installed' }
    )
    .toBe(1);

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const scaleScenarios = [];
  for (const rowCount of rowCounts()) {
    const scenario = await page.evaluate(async (count) => {
      const hook = window.__NEMOSYNE_RESOURCE_ENVELOPE__;
      if (!hook) throw new Error('Density M4 production evidence hook is unavailable.');
      return hook.runDensityScenario({ rowCount: count, shape: 'multimodal' });
    }, rowCount);

    assertReadyDensityScenario(scenario, rowCount, 'multimodal');
    await expect(page.locator('#dataset-indicator')).toContainText(
      `p1r-density-m4-multimodal-${rowCount}`
    );
    const shellDatasetContext = await page.locator('#dataset-indicator').textContent();
    scaleScenarios.push({ ...scenario, shellDatasetContext });

    await writeFile(
      'p1r-density-m4-results/m4-density.partial.json',
      `${JSON.stringify(
        {
          schemaVersion: 1,
          classification: 'diagnostic-only-partial',
          source: sourceMetadata(),
          completedScaleScenarios: scaleScenarios,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  }

  expect(new Set(scaleScenarios.map((scenario) => scenario.artifact.analyticalMeshCount))).toEqual(
    new Set([100])
  );
  expect(new Set(scaleScenarios.map((scenario) => scenario.envelope.resource.elementCount))).toEqual(
    new Set([100])
  );
  const payloadSizes = scaleScenarios.map((scenario) => scenario.payloadJsonBytesProxy);
  expect(Math.max(...payloadSizes) - Math.min(...payloadSizes)).toBeLessThan(1024);

  await page.screenshot({
    path: 'p1r-density-m4-results/m4-density-multimodal.png',
    fullPage: true,
  });

  const shapeScenarios = [];
  for (const shape of ['sparse', 'uniform', 'constant'] as const) {
    const scenario = await page.evaluate(
      async ({ selectedShape }) => {
        const hook = window.__NEMOSYNE_RESOURCE_ENVELOPE__;
        if (!hook) throw new Error('Density M4 production evidence hook is unavailable.');
        return hook.runDensityScenario({ rowCount: 1000, shape: selectedShape });
      },
      { selectedShape: shape }
    );
    assertReadyDensityScenario(scenario, 1000, shape);
    shapeScenarios.push(scenario);
    await page.screenshot({
      path: `p1r-density-m4-results/m4-density-${shape}.png`,
      fullPage: true,
    });
  }

  const sparse = shapeScenarios.find((scenario) => scenario.shape === 'sparse');
  const uniform = shapeScenarios.find((scenario) => scenario.shape === 'uniform');
  const constant = shapeScenarios.find((scenario) => scenario.shape === 'constant');
  expect(sparse).toBeTruthy();
  expect(uniform).toBeTruthy();
  expect(constant).toBeTruthy();
  expect(sparse?.artifact.occupiedCellCount).toBe(4);
  expect(uniform?.artifact.occupiedCellCount ?? 0).toBeGreaterThan(
    sparse?.artifact.occupiedCellCount ?? 0
  );
  expect(constant?.artifact.occupiedCellCount).toBe(1);
  expect(constant?.artifact.zeroCellCount).toBe(99);
  expect(constant?.artifact.maxCellCount).toBe(1000);
  if (!constant || constant.envelope.result.status !== 'READY') {
    throw new Error('Density M4 constant scenario was not READY.');
  }
  if (constant.envelope.result.payload.kind !== 'BINNED_DENSITY') {
    throw new Error('Density M4 constant scenario had the wrong payload.');
  }
  const constantDensity = constant.envelope.result.payload.data;
  const nonZeroCells = constantDensity.grid.filter((cell) => cell.count > 0);
  expect(nonZeroCells).toHaveLength(1);
  expect(nonZeroCells[0]).toMatchObject({
    xIndex: constantDensity.binsX - 1,
    yIndex: constantDensity.binsY - 1,
    count: 1000,
  });

  const report = {
    schemaVersion: 1,
    classification: 'p1r-density-m4-synthetic-browser-evidence',
    source: sourceMetadata(),
    environment: {
      userAgent,
      datasetClass:
        'deterministic synthetic bivariate multimodal/sparse/uniform/constant fixtures with distractor measure',
      physicalQuestEvidence: false,
      payloadBytesAreJsonProxy: true,
      workerWasmBytesAreLinearMemoryObservationsNotTransientAllocationPeaks: true,
      exactTransientRustPairVectorPeakMeasured: false,
      sceneRenderCountersAreLastWholeSceneFrame: true,
      screenshotRetained: true,
    },
    scaleScenarios,
    shapeScenarios,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.checkoutHeadSha).toBe(report.source.sourceHeadSha);
  expect(report.source.workflowEventSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile(
    'p1r-density-m4-results/m4-browser-density-evidence.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  console.log('[P1-R2C M4] density evidence', JSON.stringify(report, null, 2));
});
