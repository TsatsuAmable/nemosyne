import { describe, test, expect, vi, afterEach } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import { DESKTOP_EXPANSIVE_BUDGET } from '../src/moneta/forma/FormaResolutionBroker.ts';
import { FormaSystem1Proposer } from '../src/moneta/forma/FormaSystem1Proposer.ts';
import type { FormaProposalSetV1 } from '../src/moneta/forma/FormaSystem1Proposer.ts';
import { FullMonetaEngine } from '../src/moneta/adaptation/index.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import {
  computeSnapshotId,
  computeSourceId,
  type SemanticSnapshotV1,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.ts';
import type { EvidenceReferenceTupleV1 } from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeDataset(): Dataset {
  const rows = [];
  for (let i = 0; i < 80; i++) {
    rows.push({
      dim1: i * 2.0,
      dim2: (i % 6) * 1.5,
      category: i % 2 === 0 ? 'TypeA' : 'TypeB',
    });
  }
  return new Dataset(
    'fm5-s1-replay-ds',
    [
      { name: 'dim1', type: ColumnType.NUMERIC },
      { name: 'dim2', type: ColumnType.NUMERIC },
      { name: 'category', type: ColumnType.CATEGORICAL },
    ],
    rows
  );
}

function makeEvidence(datasetFingerprint: string): {
  envelope: SemanticEmbodimentEnvelopeV1;
  evidenceReferences: EvidenceReferenceTupleV1[];
} {
  return {
    envelope: {
      schemaVersion: 1,
      datasetFingerprint,
      candidateId: 'AGGREGATE_VOLUME',
      representationFamily: 'AGGREGATE',
      analyticalMethod: {
        name: 'aggregateVolume',
        version: '1.0.0',
        parameters: { groupingFields: ['category'], measure: 'COUNT' },
      },
      approximation: { mode: 'EXACT', representedRowCount: 80 },
      informationContract: {
        preserves: ['exact-metric-values'],
        loses: ['individual-observation-identity'],
      },
      resource: { sourceRowCount: 80, elementCount: 2, maxElementCount: 4096 },
      provenance: {
        kernelVersion: '1.0.0',
        algorithmVersion: '1.0.0',
        decisionId: 'decision-fm5-004',
        decisionModelVersion: 'onnx-v2',
        decisionModelArtifactHash: 'hash-xyz',
      },
      result: {
        status: 'READY',
        payload: {
          kind: 'AGGREGATE_VOLUME',
          data: {
            groupingFields: ['category'],
            measure: { function: 'COUNT' },
            groups: [
              { semanticId: 'group-type-a', key: 'TypeA', count: 40 },
              { semanticId: 'group-type-b', key: 'TypeB', count: 40 },
            ],
          },
        },
      },
    },
    evidenceReferences: [
      {
        datasetFingerprint,
        kernelVersion: '1.0.0',
        bundleContentDigest: 'sha256-bundle-001',
        receiptId: 'receipt-001',
        receiptContentDigest: 'sha256-receipt-digest-001',
        consumerId: 'descriptive-summary/v1',
        requirementProfileId: 'profile-001',
        requirementProfileDigest: 'sha256-profile-digest-001',
        admissionPolicyId: 'policy-001',
        admissionPolicyDigest: 'sha256-policy-digest-001',
      },
    ],
  } as const;
}

function setupAtlas(): AtlasCore {
  const bridge = makeKernelMockBridge();
  const atlas = new AtlasCore({ kernel: bridge });
  atlas.loadDataset(makeDataset());
  atlas.commitInvestigationContext('node-fm5-r', {
    schemaVersion: 2,
    nodeId: 'node-fm5-r',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'How do points cluster?',
      variablesOfInterest: ['dim1', 'dim2'],
      currentTask: 'cluster_analysis',
    },
    epistemicPurpose: 'CLAIM_BEARING',
  });
  return atlas;
}

describe('FM5-R4: recorded System-1 advice is consumed on replay without rerun', () => {
  test('injected recorded set is used verbatim; proposer is not rerun', () => {
    const atlas = setupAtlas();
    const evidence = makeEvidence(atlas.datasetFingerprint!);
    const first = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
      analyticalEvidence: evidence,
    });
    expect(first.system1ProposalSet.status).toBe('PROPOSED');
    expect(first.system1ProposalSource).toBe('GENERATED');

    const generateSpy = vi.spyOn(FormaSystem1Proposer.prototype, 'generateProposals');
    const replayed = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
      analyticalEvidence: evidence,
      recordedSystem1Proposals: first.system1ProposalSet,
    });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(replayed.system1ProposalSet).toEqual(first.system1ProposalSet);
    expect(replayed.system1ProposalSource).toBe('RECORDED');
    expect(replayed.system1AdviceApplied).toBe(true);

    const report = atlas.explainFullMonetaDecision(replayed, 'BALANCED');
    expect(report).toContain('Advisory origin: RECORDED');

    const state = atlas.getFormaState();
    expect(state?.system1ProposalSource).toBe('RECORDED');
    expect(state?.system1ProposalSet).toEqual(first.system1ProposalSet);
  });

  test('stale snapshot identity refuses instead of silently applying', () => {
    const atlas = setupAtlas();
    const evidence = makeEvidence(atlas.datasetFingerprint!);
    const first = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
      analyticalEvidence: evidence,
    });
    const stale = {
      ...first.system1ProposalSet,
      snapshotId: 'sha256-stale-snapshot',
    } as FormaProposalSetV1;

    expect(() =>
      atlas.adaptRepresentation({
        preference: 'BALANCED',
        budget: DESKTOP_EXPANSIVE_BUDGET,
        maxGenerations: 2,
        analyticalEvidence: evidence,
        recordedSystem1Proposals: stale,
      })
    ).toThrowError(/snapshot identity mismatch/);
  });

  test('foreign context identity refuses instead of silently applying', () => {
    const atlas = setupAtlas();
    const evidence = makeEvidence(atlas.datasetFingerprint!);
    const first = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
      analyticalEvidence: evidence,
    });
    const foreign = {
      ...first.system1ProposalSet,
      contextId: 'node-elsewhere',
    } as FormaProposalSetV1;

    expect(() =>
      atlas.adaptRepresentation({
        preference: 'BALANCED',
        budget: DESKTOP_EXPANSIVE_BUDGET,
        maxGenerations: 2,
        analyticalEvidence: evidence,
        recordedSystem1Proposals: foreign,
      })
    ).toThrowError(/investigation context mismatch/);
  });

  test('unsupported schema version refuses before any use', () => {
    const atlas = setupAtlas();
    const evidence = makeEvidence(atlas.datasetFingerprint!);
    const first = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
      analyticalEvidence: evidence,
    });
    const future = {
      ...first.system1ProposalSet,
      schemaVersion: 999,
    } as unknown as FormaProposalSetV1;

    expect(() =>
      atlas.adaptRepresentation({
        preference: 'BALANCED',
        budget: DESKTOP_EXPANSIVE_BUDGET,
        maxGenerations: 2,
        analyticalEvidence: evidence,
        recordedSystem1Proposals: future,
      })
    ).toThrowError(/unsupported schema version/);
  });

  test('injected ABSTAIN replays without advice and without proposer rerun', () => {
    const ds = makeDataset();
    const signature = buildDatasetSignature(ds);
    const evidence = makeEvidence(signature.provenance.datasetFingerprint);
    const sourceId = computeSourceId({
      family: 'AGGREGATE',
      analyticalRequestIdentity: 'req-abstain-r4',
      method: 'aggregateVolume',
      methodVersion: '1.0.0',
      parametersDigest: 'sha256-params',
      state: { status: 'AVAILABLE' as const },
      evidenceReferences: evidence.evidenceReferences,
      limitations: [],
    });
    const body = {
      analyticalDatasetFingerprint: signature.provenance.datasetFingerprint,
      kernelVersion: '1.0.0',
      semanticVocabulary: { id: 'vocab', version: '1', digest: 'sha256-vocab' },
      normalizer: { id: 'norm', version: '1', digest: 'sha256-norm' },
      coverage: [],
      sources: [
        {
          sourceId,
          family: 'AGGREGATE',
          analyticalRequestIdentity: 'req-abstain-r4',
          method: 'aggregateVolume',
          methodVersion: '1.0.0',
          parametersDigest: 'sha256-params',
          state: { status: 'AVAILABLE' as const },
          evidenceReferences: evidence.evidenceReferences,
          limitations: [],
        },
      ],
      nodes: [],
      relations: [],
      limitations: [],
    };
    const snapshot: SemanticSnapshotV1 = {
      schemaVersion: 1,
      snapshotId: computeSnapshotId(body),
      body,
    };
    const context: CommittedInvestigationContextV2 = {
      schemaVersion: 2,
      nodeId: 'node-fm5-r-abstain',
      intent: { schemaVersion: 1, researchQuestion: 'Empty probe' },
      epistemicPurpose: 'CLAIM_BEARING',
    };

    const first = FullMonetaEngine.synthesizeOrAdapt(signature, context, undefined, {
      snapshot,
      maxGenerations: 1,
    });
    expect(first.system1ProposalSet.status).toBe('ABSTAIN');
    expect(first.system1ProposalSource).toBe('GENERATED');

    const generateSpy = vi.spyOn(FormaSystem1Proposer.prototype, 'generateProposals');
    const replayed = FullMonetaEngine.synthesizeOrAdapt(signature, context, undefined, {
      snapshot,
      maxGenerations: 1,
      recordedSystem1Proposals: first.system1ProposalSet,
    });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(replayed.system1ProposalSet).toEqual(first.system1ProposalSet);
    expect(replayed.system1ProposalSource).toBe('RECORDED');
    expect(replayed.system1AdviceApplied).toBe(false);
  });
});
