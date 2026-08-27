import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { InvestigationAggregate } from '../src/atlas/domain/InvestigationAggregate.ts';
import type { AnalysisResult, AnalysisSpec } from '../src/atlas/types.ts';
import { Dataset } from '../src/data/Dataset.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

const DATASET = {
  name: 'RF046',
  columns: [{ name: 'x', type: 'number' as const }],
  rows: [{ x: 1 }, { x: 2 }, { x: 3 }],
};

function makeAtlas(sessionId = 'rf046-session'): AtlasCore {
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge(), sessionId });
  atlas.loadDataset(Dataset.fromJSON(DATASET));
  return atlas;
}

function analysisSpec(atlas: AtlasCore, min: number): AnalysisSpec {
  return {
    datasetFingerprint: atlas.datasetFingerprint!,
    datasetVersion: atlas.datasetVersion,
    operation: { op: 'filter', column: 'x', min },
    algorithmVersion: 'rf046-kernel-v1',
    label: 'filter-x',
  };
}

function appendSemanticAnalysisEvent(atlas: AtlasCore, min: number): void {
  const fp = atlas.datasetFingerprint!;
  atlas.evidenceLedger.appendEvent(
    {
      timestamp: 1_000,
      kind: 'analysis',
      command: analysisSpec(atlas, min),
      datasetVersion: atlas.datasetVersion,
      datasetFingerprint: fp,
      stateHash: fp,
    },
    atlas.sessionId,
  );
}

function appendTimestampParameterEvent(atlas: AtlasCore, timestamp: number): void {
  const fp = atlas.datasetFingerprint!;
  const spec = analysisSpec(atlas, 1);
  atlas.evidenceLedger.appendEvent(
    {
      timestamp: 1_000,
      kind: 'analysis',
      command: {
        ...spec,
        operation: { ...spec.operation, timestamp },
      },
      datasetVersion: atlas.datasetVersion,
      datasetFingerprint: fp,
      stateHash: fp,
    },
    atlas.sessionId,
  );
}

function analysisResult(atlas: AtlasCore, outputHash: string): AnalysisResult {
  return {
    resultId: `${atlas.datasetFingerprint}:result:1`,
    datasetFingerprint: atlas.datasetFingerprint!,
    datasetVersion: atlas.datasetVersion,
    spec: analysisSpec(atlas, 1),
    dataset: atlas.dataset.toJSON(),
    metrics: null,
    diagnostics: ['authoritative diagnostic'],
    warnings: [],
    provenance: null,
    implementationVersion: 'rf046-kernel-v1',
    outputHash,
    evidenceStatus: 'validated',
  };
}

function decisionWithEvidence(fact: string): RepresentationDecision {
  return {
    chosenCandidateId: 'scatter' as RepresentationDecision['chosenCandidateId'],
    chosenFamily: 'POINT_CLOUD' as RepresentationDecision['chosenFamily'],
    chosenLayout: 'grid' as RepresentationDecision['chosenLayout'],
    utilityScore: 0.82,
    representationFamily: 'POINT_CLOUD' as RepresentationDecision['representationFamily'],
    embodiment: {
      primaryLayout: 'grid' as RepresentationDecision['embodiment']['primaryLayout'],
      primaryGeometry: 'sphere' as RepresentationDecision['embodiment']['primaryGeometry'],
      primaryBehavior: 'static' as RepresentationDecision['embodiment']['primaryBehavior'],
      primaryInteraction: 'inspect' as RepresentationDecision['embodiment']['primaryInteraction'],
      spatialStrategy: { id: 'strategy_scatter' } as RepresentationDecision['embodiment']['spatialStrategy'],
    },
    evidence: [{ fact, weight: 1, supports: true, source: 'kernel:test-evidence' }],
    rejectedAlternatives: [
      { family: 'DISTRIBUTION' as RepresentationDecision['representationFamily'], score: 0.2, reason: 'less faithful', hardPassed: true },
    ],
    provenance: {
      generatedAt: 1_000,
      engine: 'moneta',
      version: 'v3',
      datasetFingerprint: 'dataset-fp',
      fitnessModelVersion: 'bootstrap-v1',
    },
    datasetSignature: {} as RepresentationDecision['datasetSignature'],
  };
}

async function exportedDigest(session: NemosyneSession): Promise<{ digest: string; manifest: Record<string, unknown> }> {
  const payload = NemosynePackageManager.unpack(await session.exportPortablePackage());
  return {
    digest: payload.manifest.investigationDigest ?? '',
    manifest: payload.manifest as unknown as Record<string, unknown>,
  };
}

describe('RF-046 semantic investigation digest contract', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('changes when only an analytical command parameter changes', async () => {
    const first = makeAtlas();
    const second = makeAtlas();
    appendSemanticAnalysisEvent(first, 1);
    appendSemanticAnalysisEvent(second, 2);

    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('does not mistake a nested semantic parameter named timestamp for replay metadata', async () => {
    const first = makeAtlas('rf046-timestamp-param');
    const second = makeAtlas('rf046-timestamp-param');
    appendTimestampParameterEvent(first, 100);
    appendTimestampParameterEvent(second, 200);

    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('changes when only authoritative analysis-result identity changes', async () => {
    const first = new InvestigationAggregate({ sessionId: 'rf046-result' });
    const second = new InvestigationAggregate({ sessionId: 'rf046-result' });
    const firstAtlas = makeAtlas('rf046-result-atlas');
    const secondAtlas = makeAtlas('rf046-result-atlas');
    first.ledger.addResult(analysisResult(firstAtlas, 'output-a'));
    second.ledger.addResult(analysisResult(secondAtlas, 'output-b'));

    expect(await second.computeDigest('rf046-kernel-v1')).not.toBe(
      await first.computeDigest('rf046-kernel-v1'),
    );
  });

  it('keeps lineage-only result rowIds out of scientific digest identity', async () => {
    const first = new InvestigationAggregate({ sessionId: 'rf046-rowids' });
    const second = new InvestigationAggregate({ sessionId: 'rf046-rowids' });
    const atlas = makeAtlas('rf046-rowids-atlas');
    const base = analysisResult(atlas, 'same-output');
    first.ledger.addResult({
      ...base,
      dataset: { ...base.dataset, rowIds: ['lineage-a', 'lineage-b', 'lineage-c'] },
    });
    second.ledger.addResult({
      ...base,
      dataset: { ...base.dataset, rowIds: ['other-a', 'other-b', 'other-c'] },
    });

    expect(await second.computeDigest('rf046-kernel-v1')).toBe(
      await first.computeDigest('rf046-kernel-v1'),
    );
  });

  it('changes when result scientific content changes even if the legacy outputHash does not', async () => {
    const first = new InvestigationAggregate({ sessionId: 'rf046-result-content' });
    const second = new InvestigationAggregate({ sessionId: 'rf046-result-content' });
    const atlas = makeAtlas('rf046-result-content-atlas');
    const base = analysisResult(atlas, 'same-output');
    first.ledger.addResult(base);
    second.ledger.addResult({
      ...base,
      dataset: {
        ...base.dataset,
        rows: [{ x: 1 }, { x: 2 }, { x: 999 }],
      },
    });

    expect(await second.computeDigest('rf046-kernel-v1')).not.toBe(
      await first.computeDigest('rf046-kernel-v1'),
    );
  });

  it('commits complete observation semantics, not only id and notes', async () => {
    const first = makeAtlas();
    const second = makeAtlas();
    first.recordObservation({ notes: 'same note', targetIds: ['node-a'], tags: ['candidate'] });
    second.recordObservation({ notes: 'same note', targetIds: ['node-b'], tags: ['candidate'] });

    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('commits finding evidence links and description', async () => {
    const first = makeAtlas();
    const second = makeAtlas();
    first.recordFinding({
      title: 'same title',
      description: 'supported by A',
      confidence: 'validated',
      observationIds: ['obs-a'],
      resultIds: ['result-a'],
    });
    second.recordFinding({
      title: 'same title',
      description: 'supported by B',
      confidence: 'validated',
      observationIds: ['obs-b'],
      resultIds: ['result-b'],
    });

    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('commits annotation content and target identity', async () => {
    const first = makeAtlas();
    const second = makeAtlas();
    first.recordAnnotation({ text: 'annotation A', position: [1, 2, 3], targetId: 'node-a' });
    second.recordAnnotation({ text: 'annotation B', position: [1, 2, 3], targetId: 'node-b' });

    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('commits full representation decision evidence rather than only the winner summary', async () => {
    const first = new InvestigationAggregate({ sessionId: 'rf046-representation' });
    const second = new InvestigationAggregate({ sessionId: 'rf046-representation' });
    first.representation.restoreDecision(decisionWithEvidence('measured-density-a'));
    second.representation.restoreDecision(decisionWithEvidence('measured-density-b'));

    expect(await second.computeDigest('rf046-kernel-v1')).not.toBe(
      await first.computeDigest('rf046-kernel-v1'),
    );
  });

  it('commits portable research context', async () => {
    const first = new NemosyneSession({ atlas: makeAtlas('rf046-context'), sessionId: 'rf046-context' });
    const second = new NemosyneSession({ atlas: makeAtlas('rf046-context'), sessionId: 'rf046-context' });
    first.setResearchContext({ studyId: 'study-1', researchQuestion: 'Question A?', hypothesis: 'H1' });
    second.setResearchContext({ studyId: 'study-1', researchQuestion: 'Question B?', hypothesis: 'H1' });

    expect((await exportedDigest(second)).digest).not.toBe((await exportedDigest(first)).digest);
  });

  it('commits NIL outcomes and their provenance', async () => {
    const firstAtlas = makeAtlas('rf046-nil');
    const secondAtlas = makeAtlas('rf046-nil');
    const first = new NemosyneSession({ atlas: firstAtlas, sessionId: 'rf046-nil' });
    const second = new NemosyneSession({ atlas: secondAtlas, sessionId: 'rf046-nil' });
    second.recordNoFeasibleRepresentation({
      nilId: 'nil:rf046:1',
      recordedAt: 1_000,
      traces: [],
      nearMisses: [],
      provenance: {
        datasetFingerprint: secondAtlas.datasetFingerprint!,
        kernelVersion: secondAtlas.kernelVersion() ?? 'unknown',
        evidenceIds: ['evidence:1'],
        requirementsHash: 'requirements:1',
      },
    });

    expect((await exportedDigest(second)).digest).not.toBe((await exportedDigest(first)).digest);
  });

  it('excludes presentation-only state from the scientific digest', async () => {
    const first = new NemosyneSession({ atlas: makeAtlas('rf046-presentation'), sessionId: 'rf046-presentation' });
    const second = new NemosyneSession({ atlas: makeAtlas('rf046-presentation'), sessionId: 'rf046-presentation' });
    second.setPresentation({
      camera: { position: [12, 4, -8], rotationY: 1.5 },
      theme: 'highContrast',
      panelPositions: [{ id: 'panel', x: 9 }],
    });

    expect((await exportedDigest(second)).digest).toBe((await exportedDigest(first)).digest);
  });

  it('labels new portable digests with the v2 semantic digest algorithm', async () => {
    const session = new NemosyneSession({ atlas: makeAtlas('rf046-schema'), sessionId: 'rf046-schema' });
    const { manifest } = await exportedDigest(session);

    expect(manifest.investigationDigestAlgorithm).toBe('sha256-canonical-investigation-v2');
  });
});
