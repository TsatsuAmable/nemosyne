import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { ClusterEmbodimentEnvelopeV1 } from '../../src/moneta/representation/ClusterEmbodimentPayload.ts';
import type { ClusterEvidenceShape } from '../../src/app/clusterEvidenceDiagnostics.ts';

function rowCounts(): number[] {
  const configured = process.env.NEMOSYNE_CLUSTER_C4_ROW_COUNTS ?? '1000,8000,32000';
  const values = configured
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value >= 256 && value <= 100_000);
  if (values.length === 0) {
    throw new Error('NEMOSYNE_CLUSTER_C4_ROW_COUNTS has no valid values.');
  }
  return values;
}

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    checkoutHeadSha: process.env.NEMOSYNE_CHECKOUT_HEAD_SHA ?? null,
    workflowEventSha: process.env.NEMOSYNE_WORKFLOW_EVENT_SHA ?? process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_CLUSTER_C4_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_CLUSTER_C4_WASM_SHA256 ?? null,
  };
}

function expectedClusterCount(shape: ClusterEvidenceShape): number {
  if (shape === 'one-cluster') return 1;
  if (shape === 'near-bound') return 240;
  if (shape === 'overlap') return 4;
  return 8;
}

function overlapPairCount(envelope: ClusterEmbodimentEnvelopeV1): number {
  if (envelope.result.status !== 'READY') return 0;
  const spatial = envelope.result.payload.data.regions.filter(
    (region) => region.spatialSummary !== null
  );
  let overlaps = 0;
  for (let left = 0; left < spatial.length; left += 1) {
    for (let right = left + 1; right < spatial.length; right += 1) {
      const a = spatial[left].spatialSummary?.axes;
      const b = spatial[right].spatialSummary?.axes;
      if (!a || !b || a.length !== b.length) continue;
      const overlapsEveryAxis = a.every(
        (axis, index) => axis.min <= b[index].max && b[index].min <= axis.max
      );
      if (overlapsEveryAxis) overlaps += 1;
    }
  }
  return overlaps;
}

function assertReadyClusterScenario(
  scenario: Awaited<
    ReturnType<NonNullable<Window['__NEMOSYNE_RESOURCE_ENVELOPE__']>['runClusterScenario']>
  >,
  rowCount: number,
  shape: ClusterEvidenceShape
): void {
  expect(scenario.sourceRowCount).toBe(rowCount);
  expect(scenario.shape).toBe(shape);
  expect(scenario.partitionField).toBe('cohort');
  expect(scenario.coordinateFields).toEqual(['x', 'y']);
  expect(scenario.candidateId).toBe('CLUSTER_REGIONS');
  expect(scenario.initialStatus).toBe('PENDING');
  expect(scenario.finalStatus).toBe('READY');
  expect(scenario.statusSurface).toEqual({
    pendingWasVisible: true,
    readySurfaceRemoved: true,
  });

  expect(scenario.datasetFingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(scenario.envelope.datasetFingerprint).toBe(scenario.datasetFingerprint);
  expect(scenario.envelope.candidateId).toBe('CLUSTER_REGIONS');
  expect(scenario.envelope.representationFamily).toBe('CLUSTER');
  expect(scenario.envelope.provenance.decisionId).toBe(scenario.decisionId);
  expect(scenario.envelope.result.status).toBe('READY');
  if (scenario.envelope.result.status !== 'READY') throw new Error('unreachable refusal');
  expect(scenario.envelope.result.payload.kind).toBe('CLUSTER_REGIONS');
  if (scenario.envelope.result.payload.kind !== 'CLUSTER_REGIONS') {
    throw new Error('Cluster C4 received the wrong READY payload kind.');
  }

  const payload = scenario.envelope.result.payload.data;
  const expectedRegions = expectedClusterCount(shape);
  expect(payload.partitionField).toBe('cohort');
  expect(payload.coordinateFields).toEqual(['x', 'y']);
  expect(payload.regions).toHaveLength(expectedRegions);
  expect(payload.counts.sourceCount).toBe(rowCount);
  expect(payload.counts.assignedCount + payload.counts.unassignedCount).toBe(rowCount);
  expect(payload.counts.coordinateValidCount + payload.counts.coordinateExcludedCount).toBe(
    payload.counts.assignedCount
  );
  expect(payload.regions.reduce((sum, region) => sum + region.assignedCount, 0)).toBe(
    payload.counts.assignedCount
  );
  expect(
    payload.regions.reduce((sum, region) => sum + region.coordinateValidCount, 0)
  ).toBe(payload.counts.coordinateValidCount);

  expect(scenario.envelope.resource.sourceRowCount).toBe(rowCount);
  expect(scenario.envelope.resource.elementCount).toBe(expectedRegions);
  expect(scenario.envelope.resource.elementCount).toBeLessThanOrEqual(256);
  expect(scenario.envelope.resource.elementCount).toBeLessThanOrEqual(
    scenario.envelope.resource.maxElementCount
  );
  expect(scenario.payloadJsonBytesProxy).toBeGreaterThan(0);

  const spatialRegions = payload.regions.filter((region) => region.spatialSummary !== null);
  expect(scenario.artifact.semanticRegionCount).toBe(expectedRegions);
  expect(scenario.artifact.spatialRegionCount).toBe(spatialRegions.length);
  expect(scenario.artifact.unavailableSpatialRegionCount).toBe(
    expectedRegions - spatialRegions.length
  );
  expect(scenario.artifact.interactionProxyCount).toBe(spatialRegions.length);
  expect(scenario.artifact.renderedBatchCount).toBe(2);
  expect(scenario.artifact.candidateLocalDrawCalls).toBe(2);
  expect(scenario.artifact.centroidSurfacePresent).toBe(true);
  expect(scenario.artifact.boundsSurfacePresent).toBe(true);
  expect(new Set(scenario.artifact.semanticIds).size).toBe(spatialRegions.length);
  expect(scenario.artifact.representationKinds).toEqual(
    Array(spatialRegions.length).fill('CLUSTER_REGIONS')
  );
  expect(scenario.artifact.presentationSemantics).toBe(
    'centroid-and-descriptive-axis-aligned-min-max-bounds'
  );
  expect(scenario.artifact.supportBoundaryClaim).toBe(false);
  expect(JSON.stringify(payload.regions)).not.toContain('separationMargin');
  expect(JSON.stringify(payload.regions)).not.toContain('supportBoundaryClaim');
  expect(JSON.stringify(payload.regions)).not.toContain('confidenceRegion');
  expect(JSON.stringify(scenario.envelope)).not.toContain('p1r-cluster-c4-');

  expect(scenario.perceptualBinding.artifactId).toBe(scenario.artifact.artifactId);
  expect(scenario.perceptualBinding.datasetFingerprint).toBe(scenario.datasetFingerprint);
  expect(scenario.perceptualBinding.candidateId).toBe('CLUSTER_REGIONS');
  expect(scenario.perceptualBinding.payloadKind).toBe('CLUSTER_REGIONS');
  expect(scenario.perceptualBinding.decisionId).toBe(scenario.decisionId);
  expect(scenario.perceptualBinding.evidence.source).toBe('measured');

  const workerExecution = scenario.workerDiagnostics.find(
    (sample) =>
      sample.phase === 'execution' &&
      sample.operation === 'semanticEmbodiment' &&
      sample.operationName === 'CLUSTER_REGIONS'
  );
  expect(workerExecution).toBeTruthy();
  expect(workerExecution?.resultKind).toBe('scalar');
  expect(scenario.workerExecution.kernelMs).not.toBeNull();
  expect(scenario.workerExecution.kernelMs ?? -1).toBeGreaterThanOrEqual(0);
  expect(scenario.timingMs.requestToReady).toBeGreaterThanOrEqual(0);
  expect(scenario.timingMs.readyToRenderedFrames).toBeGreaterThanOrEqual(0);
  expect(scenario.scene.renderCallsLastFrame).toBeGreaterThan(0);
  expect(scenario.scene.trianglesLastFrame).toBeGreaterThanOrEqual(0);
}

test('R2D C4 proves bounded visible source-partition regions across scale and pathological fixtures', async ({
  page,
}) => {
  test.setTimeout(360_000);
  test.skip(
    process.env.NEMOSYNE_CLUSTER_C4_BROWSER_PROBE !== '1',
    'Cluster C4 evidence runs only in its isolated exact-head workflow.'
  );

  await mkdir('p1r-cluster-c4-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_RESOURCE_ENVELOPE__?.schemaVersion ?? null),
      { timeout: 15_000, message: 'Cluster C4 production evidence hook is installed' }
    )
    .toBe(1);

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const screenshotBindings: Array<{
    file: string;
    artifactId: string;
    datasetFingerprint: string;
    decisionId: string;
    candidateId: 'CLUSTER_REGIONS';
  }> = [];

  const scaleScenarios = [];
  for (const rowCount of rowCounts()) {
    const scenario = await page.evaluate(async (count) => {
      const hook = window.__NEMOSYNE_RESOURCE_ENVELOPE__;
      if (!hook) throw new Error('Cluster C4 production evidence hook is unavailable.');
      return hook.runClusterScenario({ rowCount: count, shape: 'balanced' });
    }, rowCount);

    assertReadyClusterScenario(scenario, rowCount, 'balanced');
    await expect(page.locator('#dataset-indicator')).toContainText(
      `p1r-cluster-c4-balanced-${rowCount}`
    );
    const shellDatasetContext = await page.locator('#dataset-indicator').textContent();
    scaleScenarios.push({ ...scenario, shellDatasetContext });

    await writeFile(
      'p1r-cluster-c4-results/c4-cluster.partial.json',
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

  expect(new Set(scaleScenarios.map((scenario) => scenario.artifact.semanticRegionCount))).toEqual(
    new Set([8])
  );
  expect(new Set(scaleScenarios.map((scenario) => scenario.artifact.candidateLocalDrawCalls))).toEqual(
    new Set([2])
  );
  const payloadSizes = scaleScenarios.map((scenario) => scenario.payloadJsonBytesProxy);
  expect(Math.max(...payloadSizes) - Math.min(...payloadSizes)).toBeLessThan(2048);

  const scaleScreenshot = 'p1r-cluster-c4-results/c4-cluster-balanced-scale.png';
  await page.screenshot({ path: scaleScreenshot, fullPage: true });
  const largestScale = scaleScenarios.at(-1)!;
  screenshotBindings.push({
    file: scaleScreenshot,
    artifactId: largestScale.artifact.artifactId,
    datasetFingerprint: largestScale.datasetFingerprint,
    decisionId: largestScale.decisionId,
    candidateId: 'CLUSTER_REGIONS',
  });

  const pathologicalInputs: Array<{ shape: ClusterEvidenceShape; rowCount: number }> = [
    { shape: 'one-cluster', rowCount: 1000 },
    { shape: 'near-bound', rowCount: 4096 },
    { shape: 'overlap', rowCount: 1000 },
    { shape: 'missing-labels', rowCount: 1000 },
    { shape: 'invalid-coordinates', rowCount: 1000 },
    { shape: 'imbalanced', rowCount: 1000 },
  ];
  const pathologicalScenarios = [];
  for (const input of pathologicalInputs) {
    const scenario = await page.evaluate(async (selected) => {
      const hook = window.__NEMOSYNE_RESOURCE_ENVELOPE__;
      if (!hook) throw new Error('Cluster C4 production evidence hook is unavailable.');
      return hook.runClusterScenario(selected);
    }, input);
    assertReadyClusterScenario(scenario, input.rowCount, input.shape);
    pathologicalScenarios.push(scenario);

    if (input.shape === 'overlap' || input.shape === 'invalid-coordinates') {
      const file = `p1r-cluster-c4-results/c4-cluster-${input.shape}.png`;
      await page.screenshot({ path: file, fullPage: true });
      screenshotBindings.push({
        file,
        artifactId: scenario.artifact.artifactId,
        datasetFingerprint: scenario.datasetFingerprint,
        decisionId: scenario.decisionId,
        candidateId: 'CLUSTER_REGIONS',
      });
    }
  }

  const oneCluster = pathologicalScenarios.find((scenario) => scenario.shape === 'one-cluster');
  const nearBound = pathologicalScenarios.find((scenario) => scenario.shape === 'near-bound');
  const overlap = pathologicalScenarios.find((scenario) => scenario.shape === 'overlap');
  const missing = pathologicalScenarios.find((scenario) => scenario.shape === 'missing-labels');
  const invalid = pathologicalScenarios.find((scenario) => scenario.shape === 'invalid-coordinates');
  const imbalanced = pathologicalScenarios.find((scenario) => scenario.shape === 'imbalanced');

  expect(oneCluster?.envelope.resource.elementCount).toBe(1);
  expect(nearBound?.envelope.resource.elementCount).toBe(240);
  expect(nearBound?.artifact.candidateLocalDrawCalls).toBe(2);
  expect(overlap).toBeTruthy();
  if (!overlap) throw new Error('Overlap scenario missing.');
  expect(overlapPairCount(overlap.envelope)).toBeGreaterThan(0);
  expect(overlap.artifact.supportBoundaryClaim).toBe(false);

  expect(missing).toBeTruthy();
  if (!missing || missing.envelope.result.status !== 'READY') {
    throw new Error('Missing-label scenario was not READY.');
  }
  expect(missing.envelope.result.payload.data.counts.unassignedCount).toBeGreaterThan(0);

  expect(invalid).toBeTruthy();
  if (!invalid || invalid.envelope.result.status !== 'READY') {
    throw new Error('Invalid-coordinate scenario was not READY.');
  }
  expect(invalid.envelope.result.payload.data.counts.coordinateExcludedCount).toBeGreaterThan(0);
  expect(invalid.artifact.unavailableSpatialRegionCount).toBe(1);

  expect(imbalanced).toBeTruthy();
  if (!imbalanced) throw new Error('Imbalanced scenario missing.');
  const positiveCounts = imbalanced.artifact.assignedCounts.filter((count) => count > 0);
  expect(Math.max(...positiveCounts) / Math.min(...positiveCounts)).toBeGreaterThan(20);

  const report = {
    schemaVersion: 1,
    classification: 'p1r-cluster-c4-synthetic-browser-evidence',
    source: sourceMetadata(),
    environment: {
      userAgent,
      datasetClass:
        'deterministic synthetic source-partition fixtures with explicit cohort authority and decoy color categorical',
      physicalQuestEvidence: false,
      payloadBytesAreJsonProxy: true,
      sceneRenderCountersAreLastWholeSceneFrame: true,
      candidateLocalDrawCallsComeFromClusterAdapterContract: true,
      screenshotsRetained: true,
      screenshotsBoundBySidecarIdentity: true,
    },
    scaleScenarios,
    pathologicalScenarios,
    screenshotBindings,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.checkoutHeadSha).toBe(report.source.sourceHeadSha);
  expect(report.source.workflowEventSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile(
    'p1r-cluster-c4-results/c4-browser-cluster-evidence.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    'p1r-cluster-c4-results/c4-screenshot-bindings.json',
    `${JSON.stringify(screenshotBindings, null, 2)}\n`,
    'utf8'
  );
  console.log('[P1-R2D C4] cluster evidence', JSON.stringify(report, null, 2));
});
