import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

function rowCounts(): number[] {
  const configured = process.env.NEMOSYNE_M4_ROW_COUNTS ?? '1000,8000,32000';
  const values = configured
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value >= 50 && value <= 100_000);
  if (values.length === 0) throw new Error('NEMOSYNE_M4_ROW_COUNTS has no valid values.');
  return values;
}

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    checkoutHeadSha: process.env.NEMOSYNE_CHECKOUT_HEAD_SHA ?? null,
    workflowEventSha: process.env.NEMOSYNE_WORKFLOW_EVENT_SHA ?? process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_M4_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_M4_WASM_SHA256 ?? null,
  };
}

test('M4 proves the visible bounded distribution path in the production browser', async ({
  page,
}) => {
  test.setTimeout(240_000);
  test.skip(
    process.env.NEMOSYNE_M4_BROWSER_PROBE !== '1',
    'M4 distribution evidence runs only in its isolated exact-head workflow.'
  );

  await mkdir('stream-m-m4-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_RESOURCE_ENVELOPE__?.schemaVersion ?? null),
      { timeout: 15_000, message: 'M4 production evidence hook is installed' }
    )
    .toBe(1);

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const scenarios = [];
  for (const rowCount of rowCounts()) {
    const scenario = await page.evaluate(async (count) => {
      const hook = window.__NEMOSYNE_RESOURCE_ENVELOPE__;
      if (!hook) throw new Error('M4 production evidence hook is unavailable.');
      return hook.runDistributionScenario({ rowCount: count, measureField: 'value' });
    }, rowCount);

    expect(scenario.sourceRowCount).toBe(rowCount);
    expect(scenario.measureField).toBe('value');
    expect(scenario.candidateId).toBe('DISTRIBUTION_FIELD');
    expect(scenario.initialStatus).toBe('PENDING');
    expect(scenario.finalStatus).toBe('READY');
    expect(scenario.statusSurface).toEqual({
      pendingWasVisible: true,
      readySurfaceRemoved: true,
    });

    expect(scenario.datasetFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(scenario.envelope.datasetFingerprint).toBe(scenario.datasetFingerprint);
    expect(scenario.envelope.candidateId).toBe('DISTRIBUTION_FIELD');
    expect(scenario.envelope.representationFamily).toBe('DISTRIBUTION');
    expect(scenario.envelope.provenance.decisionId).toBe(scenario.decisionId);
    expect(scenario.envelope.result.status).toBe('READY');
    if (scenario.envelope.result.status !== 'READY') throw new Error('unreachable refusal');
    expect(scenario.envelope.result.payload.kind).toBe('EMPIRICAL_DISTRIBUTION');
    if (scenario.envelope.result.payload.kind !== 'EMPIRICAL_DISTRIBUTION') {
      throw new Error('M4 received the wrong ready payload kind.');
    }
    expect(scenario.envelope.result.payload.data.measureField).toBe('value');
    expect(scenario.envelope.resource.sourceRowCount).toBe(rowCount);
    expect(scenario.envelope.resource.elementCount).toBeLessThanOrEqual(
      scenario.envelope.resource.maxElementCount
    );
    expect(scenario.payloadJsonBytesProxy).toBeGreaterThan(0);

    const elementCount = scenario.envelope.resource.elementCount;
    expect(scenario.artifact.analyticalMeshCount).toBe(elementCount);
    expect(scenario.artifact.histogramMeshCount).toBeGreaterThan(0);
    expect(scenario.artifact.ecdfMeshCount).toBeGreaterThan(0);
    expect(scenario.artifact.quantileMeshCount).toBeGreaterThan(0);
    expect(
      scenario.artifact.histogramMeshCount +
        scenario.artifact.ecdfMeshCount +
        scenario.artifact.quantileMeshCount
    ).toBe(elementCount);
    expect(new Set(scenario.artifact.semanticIds).size).toBe(elementCount);
    expect(scenario.artifact.representationKinds).toEqual(
      Array(elementCount).fill('DISTRIBUTION_FIELD')
    );

    expect(scenario.perceptualBinding.artifactId).toBe(scenario.artifact.artifactId);
    expect(scenario.perceptualBinding.datasetFingerprint).toBe(scenario.datasetFingerprint);
    expect(scenario.perceptualBinding.candidateId).toBe('DISTRIBUTION_FIELD');
    expect(scenario.perceptualBinding.payloadKind).toBe('EMPIRICAL_DISTRIBUTION');
    expect(scenario.perceptualBinding.decisionId).toBe(scenario.decisionId);
    expect(scenario.perceptualBinding.evidence.source).toBe('measured');
    expect(scenario.perceptualBinding.evidence.measured?.viewpointEnvelope).toHaveLength(9);

    const workerExecution = scenario.workerDiagnostics.find(
      (sample) =>
        sample.phase === 'execution' &&
        sample.operation === 'semanticEmbodiment' &&
        sample.operationName === 'DISTRIBUTION_FIELD'
    );
    expect(workerExecution).toBeTruthy();
    expect(workerExecution?.resultKind).toBe('scalar');
    expect(workerExecution?.timingMs.kernel).toBeGreaterThanOrEqual(0);
    expect(scenario.timingMs.requestToReady).toBeGreaterThanOrEqual(0);
    expect(scenario.scene.renderCallsLastFrame).toBeGreaterThan(0);

    await expect(page.locator('#dataset-indicator')).toContainText(
      `stream-m-m4-distribution-${rowCount}`
    );
    const shellDatasetContext = await page.locator('#dataset-indicator').textContent();

    scenarios.push({ ...scenario, shellDatasetContext });
    await writeFile(
      'stream-m-m4-results/m4-distribution.partial.json',
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

  expect(new Set(scenarios.map((scenario) => scenario.artifact.analyticalMeshCount)).size).toBe(1);
  expect(new Set(scenarios.map((scenario) => scenario.envelope.resource.elementCount)).size).toBe(
    1
  );

  await page.screenshot({
    path: 'stream-m-m4-results/m4-visible-distribution.png',
    fullPage: true,
  });

  const report = {
    schemaVersion: 1,
    classification: 'stream-m-m4-synthetic-browser-distribution-evidence',
    source: sourceMetadata(),
    environment: {
      userAgent,
      datasetClass: 'deterministic synthetic univariate mixture with distractor measure',
      physicalQuestEvidence: false,
      payloadBytesAreJsonProxy: true,
      sceneRenderCountersAreLastWholeSceneFrame: true,
      exactStructuredCloneBytesMeasured: false,
      screenshotRetained: true,
    },
    scenarios,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.checkoutHeadSha).toBe(report.source.sourceHeadSha);
  expect(report.source.workflowEventSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile(
    'stream-m-m4-results/m4-browser-distribution-evidence.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  console.log('[Stream M M4] distribution evidence', JSON.stringify(scenarios, null, 2));
});
