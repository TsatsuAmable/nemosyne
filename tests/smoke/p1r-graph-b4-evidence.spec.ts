import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type {
  GraphEvidenceScenarioResult,
  GraphEvidenceShape,
} from '../../src/app/graphEvidenceDiagnostics.ts';

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    checkoutHeadSha: process.env.NEMOSYNE_CHECKOUT_HEAD_SHA ?? null,
    workflowEventSha: process.env.NEMOSYNE_WORKFLOW_EVENT_SHA ?? process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_GRAPH_B4_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_GRAPH_B4_WASM_SHA256 ?? null,
  };
}

function assertReadyScenario(
  scenario: GraphEvidenceScenarioResult,
  shape: GraphEvidenceShape,
  rowCount: number
): void {
  expect(scenario.schemaVersion).toBe(1);
  expect(scenario.shape).toBe(shape);
  expect(scenario.sourceRowCount).toBe(rowCount);
  expect(scenario.candidateId).toBe('RELATIONSHIP_GRAPH');
  expect(scenario.datasetFingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(scenario.decisionId.length).toBeGreaterThan(0);
  expect(scenario.envelope.datasetFingerprint).toBe(scenario.datasetFingerprint);
  expect(scenario.envelope.candidateId).toBe('RELATIONSHIP_GRAPH');
  expect(scenario.envelope.representationFamily).toBe('GRAPH');
  expect(scenario.envelope.provenance.decisionId).toBe(scenario.decisionId);
  expect(scenario.envelope.result.status).toBe('READY');
  if (scenario.envelope.result.status !== 'READY') throw new Error('unreachable graph refusal');

  const payload = scenario.envelope.result.payload.data;
  expect(payload.directionality).toBe(shape === 'undirected' ? 'UNDIRECTED' : 'DIRECTED');
  expect(payload.nodes).toHaveLength(rowCount);
  expect(payload.edges.length).toBeGreaterThan(0);
  expect(payload.counts.sourceNodeCount).toBe(rowCount);
  expect(payload.counts.retainedNodeCount).toBe(rowCount);
  expect(payload.counts.sourceEdgeCount).toBe(payload.edges.length);
  expect(payload.counts.retainedEdgeCount).toBe(payload.edges.length);
  expect(payload.counts.refusedEdgeCount).toBe(0);
  expect(scenario.envelope.resource.elementCount).toBe(payload.edges.length);
  expect(scenario.payloadJsonBytesProxy).toBeGreaterThan(0);
  expect(scenario.payloadJsonBytesProxy).toBeLessThanOrEqual(2 * 1024 * 1024);

  expect(scenario.artifact.semanticNodeCount).toBe(payload.nodes.length);
  expect(scenario.artifact.semanticEdgeCount).toBe(payload.edges.length);
  expect(scenario.artifact.interactionProxyCount).toBe(payload.nodes.length + payload.edges.length);
  expect(scenario.artifact.renderedBatchCount).toBe(2);
  expect(scenario.artifact.candidateLocalDrawCalls).toBe(2);
  expect(scenario.artifact.nodeSurfacePresent).toBe(true);
  expect(scenario.artifact.edgeSurfacePresent).toBe(true);
  expect(scenario.artifact.presentationSemantics).toBe(
    'force-directed-positioning-over-payload-topology'
  );
  expect(scenario.artifact.supportBoundaryClaim).toBe(false);

  // Full product adjacency proof: the adapter interaction identities must be
  // the exact semantic identities and exact order emitted by the Rust payload.
  expect(scenario.artifact.nodeSemanticIds).toEqual(scenario.topology.nodeIds);
  expect(scenario.artifact.edgeSemanticIds).toEqual(
    scenario.topology.edges.map((edge) => edge.semanticId)
  );
  expect(new Set(scenario.artifact.nodeSemanticIds).size).toBe(payload.nodes.length);
  expect(new Set(scenario.artifact.edgeSemanticIds).size).toBe(payload.edges.length);
  expect(scenario.topology.isolatedNodeCount).toBeGreaterThan(0);
  expect(scenario.topology.parallelEdgePairCount).toBeGreaterThan(0);
  expect(scenario.topology.selfLoopCount).toBeGreaterThan(0);

  expect(scenario.layoutInvariance.seedA).not.toBe(scenario.layoutInvariance.seedB);
  expect(scenario.layoutInvariance.positionsDiffer).toBe(true);
  expect(scenario.layoutInvariance.topologyInvariant).toBe(true);

  expect(scenario.perceptualBinding.artifactId).toBe(scenario.artifact.artifactId);
  expect(scenario.perceptualBinding.datasetFingerprint).toBe(scenario.datasetFingerprint);
  expect(scenario.perceptualBinding.candidateId).toBe('RELATIONSHIP_GRAPH');
  expect(scenario.perceptualBinding.payloadKind).toBe('RELATIONSHIP_GRAPH');
  expect(scenario.perceptualBinding.decisionId).toBe(scenario.decisionId);
  expect(scenario.perceptualBinding.communityClaim).toBe(false);
  expect(scenario.perceptualBinding.evidence.source).toBe('measured');

  const workerExecution = scenario.workerDiagnostics.find(
    (sample) =>
      sample.phase === 'execution' &&
      sample.operation === 'semanticEmbodiment' &&
      sample.operationName === 'RELATIONSHIP_GRAPH'
  );
  expect(workerExecution).toBeTruthy();
  expect(workerExecution?.resultKind).toBe('scalar');
  expect(scenario.workerExecution.kernelMs).not.toBeNull();
  expect(scenario.workerExecution.kernelMs ?? -1).toBeGreaterThanOrEqual(0);
  expect(scenario.timingMs.requestToReady).toBeGreaterThanOrEqual(0);
  expect(scenario.timingMs.readyToRenderedFrames).toBeGreaterThanOrEqual(0);
  expect(scenario.scene.renderCallsLastFrame).toBeGreaterThan(0);
}

test('P1-R2E B4 proves truthful relationship graph product behavior and finite STOP evidence', async ({
  page,
}) => {
  test.setTimeout(480_000);
  test.skip(
    process.env.NEMOSYNE_GRAPH_B4_BROWSER_PROBE !== '1',
    'Graph B4 evidence runs only in its isolated exact-head workflow.'
  );

  await mkdir('p1r-graph-b4-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_GRAPH_B4_EVIDENCE__?.schemaVersion ?? null),
      { timeout: 15_000, message: 'Graph B4 production evidence hook is installed' }
    )
    .toBe(1);

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const readyInputs: Array<{
    shape: Exclude<GraphEvidenceShape, 'missing-endpoint'>;
    rowCount: number;
  }> = [
    { shape: 'directed', rowCount: 128 },
    { shape: 'undirected', rowCount: 128 },
    { shape: 'mixed-endpoints', rowCount: 128 },
    { shape: 'near-bound', rowCount: 4000 },
    { shape: 'mutation-stale', rowCount: 128 },
  ];

  const readyScenarios: GraphEvidenceScenarioResult[] = [];
  const screenshotBindings: Array<{
    file: string;
    artifactId: string;
    datasetFingerprint: string;
    decisionId: string;
    candidateId: 'RELATIONSHIP_GRAPH';
    communityClaim: false;
  }> = [];

  for (const input of readyInputs) {
    const scenario = await page.evaluate(async (selected) => {
      const hook = window.__NEMOSYNE_GRAPH_B4_EVIDENCE__;
      if (!hook) throw new Error('Graph B4 production evidence hook is unavailable.');
      return hook.runScenario(selected);
    }, input);
    assertReadyScenario(scenario, input.shape, input.rowCount);
    readyScenarios.push(scenario);

    if (input.shape !== 'mutation-stale') {
      await expect(page.locator('#dataset-indicator')).toContainText(
        `p1r-graph-b4-${input.shape}-${input.rowCount}`
      );
    }

    if (input.shape === 'directed' || input.shape === 'undirected' || input.shape === 'near-bound') {
      const file = `p1r-graph-b4-results/b4-${input.shape}.png`;
      await page.screenshot({ path: file, fullPage: true });
      screenshotBindings.push({
        file,
        artifactId: scenario.artifact.artifactId,
        datasetFingerprint: scenario.datasetFingerprint,
        decisionId: scenario.decisionId,
        candidateId: 'RELATIONSHIP_GRAPH',
        communityClaim: false,
      });
    }

    await writeFile(
      'p1r-graph-b4-results/b4-graph.partial.json',
      `${JSON.stringify(
        {
          schemaVersion: 1,
          classification: 'diagnostic-only-partial',
          source: sourceMetadata(),
          completedReadyScenarios: readyScenarios,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  }

  const directed = readyScenarios.find((scenario) => scenario.shape === 'directed');
  const undirected = readyScenarios.find((scenario) => scenario.shape === 'undirected');
  const mixed = readyScenarios.find((scenario) => scenario.shape === 'mixed-endpoints');
  const nearBound = readyScenarios.find((scenario) => scenario.shape === 'near-bound');
  const stale = readyScenarios.find((scenario) => scenario.shape === 'mutation-stale');
  expect(directed?.directionality).toBe('DIRECTED');
  expect(undirected?.directionality).toBe('UNDIRECTED');
  expect(mixed?.artifact.semanticEdgeCount).toBeGreaterThan(0);
  expect(nearBound?.artifact.semanticNodeCount).toBe(4000);
  expect(nearBound?.artifact.semanticEdgeCount ?? 0).toBeGreaterThan(5000);
  expect(nearBound?.artifact.candidateLocalDrawCalls).toBe(2);

  // Stale/fingerprint + prefix-eviction evidence: mutation invalidates the
  // retained governed envelope, records dropped-edge evidence, and renders no
  // old topology while the new authority request is pending.
  expect(stale?.staleFence.exercised).toBe(true);
  expect(stale?.staleFence.evictedEdgeCount ?? 0).toBeGreaterThan(0);
  expect(stale?.staleFence.statusAfterMutation).toBe('PENDING');
  expect(stale?.staleFence.graphSurfaceAfterMutation).toBe(false);

  const refusal = await page.evaluate(async () => {
    const hook = window.__NEMOSYNE_GRAPH_B4_EVIDENCE__;
    if (!hook) throw new Error('Graph B4 production evidence hook is unavailable.');
    return hook.runMissingEndpointScenario({ rowCount: 128 });
  });
  expect(refusal.candidateId).toBe('RELATIONSHIP_GRAPH');
  expect(refusal.datasetFingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(refusal.envelope.provenance.decisionId).toBe(refusal.decisionId);
  expect(refusal.envelope.result.status).toBe('REFUSED');
  expect(refusal.status).toBe('REFUSED');
  expect(refusal.graphSurfacePresent).toBe(false);
  expect(refusal.refusalCode).toBe('MISSING_EVIDENCE');
  expect(refusal.refusalMessage).toMatch(/endpoint|row ID/i);

  // Five graph-like signals are present (near-coincident x/y and perfectly
  // correlated columns), but no source edges exist. Explicit graph authority
  // therefore cannot admit RELATIONSHIP_GRAPH and no graph surface appears.
  const noSource = await page.evaluate(async () => {
    const hook = window.__NEMOSYNE_GRAPH_B4_EVIDENCE__;
    if (!hook) throw new Error('Graph B4 production evidence hook is unavailable.');
    return hook.runNoSourceAuthorityScenario({ rowCount: 128 });
  });
  expect(noSource.graphLikeCoordinates).toBe(true);
  expect(noSource.sourceEdgeCount).toBe(0);
  expect(noSource.explicitGraphAuthorityRequested).toBe(true);
  expect(noSource.relationshipGraphChosen).toBe(false);
  expect(noSource.chosenCandidateId).not.toBe('RELATIONSHIP_GRAPH');
  expect(noSource.graphSurfacePresent).toBe(false);

  const report = {
    schemaVersion: 1,
    classification: 'p1r-r2e-b4-synthetic-browser-evidence',
    source: sourceMetadata(),
    environment: {
      userAgent,
      datasetClass:
        'deterministic source-edge graph fixtures with graph-like coordinate/correlation decoys',
      physicalQuestEvidence: false,
      payloadBytesAreJsonProxy: true,
      sceneRenderCountersAreLastWholeSceneFrame: true,
      candidateLocalDrawCallsComeFromGraphAdapterContract: true,
      screenshotsRetained: true,
      screenshotsBoundBySidecarIdentity: true,
      screenshotsClaimCommunityTruth: false,
    },
    readyScenarios,
    missingEndpointRefusal: refusal,
    noSourceAuthority: noSource,
    screenshotBindings,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.checkoutHeadSha).toBe(report.source.sourceHeadSha);
  expect(report.source.workflowEventSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile(
    'p1r-graph-b4-results/b4-browser-graph-evidence.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    'p1r-graph-b4-results/b4-screenshot-bindings.json',
    `${JSON.stringify(screenshotBindings, null, 2)}\n`,
    'utf8'
  );
  console.log('[P1-R2E B4] relationship graph evidence', JSON.stringify(report, null, 2));
});
