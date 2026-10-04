import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  QUEST_CONSTRAINED_BUDGET,
  DESKTOP_EXPANSIVE_BUDGET,
} from '../src/moneta/forma/FormaResolutionBroker.ts';
import { FullMonetaEngine } from '../src/moneta/adaptation/index.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import { RepresentationSearchEngine } from '../src/moneta/search/RepresentationSearchEngine.ts';
import { FormaSystem1Proposer } from '../src/moneta/forma/FormaSystem1Proposer.ts';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.ts';
import {
  computeSnapshotId,
  computeSourceId,
  normalizeEnvelopeToSnapshot,
  type SemanticSnapshotV1,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { EvidenceReferenceTupleV1 } from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.ts';

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
    'fm5-s1-record-ds',
    [
      { name: 'dim1', type: ColumnType.NUMERIC },
      { name: 'dim2', type: ColumnType.NUMERIC },
      { name: 'category', type: ColumnType.CATEGORICAL },
    ],
    rows
  );
}

function makeValidEvidence(datasetFingerprint: string): {
  envelope: SemanticEmbodimentEnvelopeV1;
  evidenceReferences: EvidenceReferenceTupleV1[];
} {
  const evidenceReferences: EvidenceReferenceTupleV1[] = [
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
  ];

  const envelope: SemanticEmbodimentEnvelopeV1 = {
    schemaVersion: 1,
    datasetFingerprint,
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: {
      name: 'aggregateVolume',
      version: '1.0.0',
      parameters: { groupingFields: ['category'], measure: 'COUNT' },
    },
    approximation: {
      mode: 'EXACT',
      representedRowCount: 80,
    },
    informationContract: {
      preserves: ['exact-metric-values'],
      loses: ['individual-observation-identity'],
    },
    resource: {
      sourceRowCount: 80,
      elementCount: 2,
      maxElementCount: 4096,
    },
    provenance: {
      kernelVersion: '1.0.0',
      algorithmVersion: '1.0.0',
      decisionId: 'decision-fm5-001',
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
  };

  return { envelope, evidenceReferences };
}

function commitContext(atlas: AtlasCore, purpose: 'CLAIM_BEARING' | 'EXPLORATORY_ABDUCTION'): void {
  atlas.commitInvestigationContext('node-fm5-root', {
    schemaVersion: 2,
    nodeId: 'node-fm5-root',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'How do points cluster across dimensions?',
      variablesOfInterest: ['dim1', 'dim2'],
      currentTask: 'cluster_analysis',
    },
    epistemicPurpose: purpose,
  });
}

function directContext(): CommittedInvestigationContextV2 {
  return {
    schemaVersion: 2,
    nodeId: 'node-fm5-abstain',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Empty snapshot probe',
    },
    epistemicPurpose: 'CLAIM_BEARING',
  };
}

describe('FM5-R1: consumed System-1 proposal set is recorded for replay', () => {
  test('PROPOSED set is recorded on the result, provenance, and persisted forma state', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(makeDataset());
    commitContext(atlas, 'CLAIM_BEARING');

    const evidence = makeValidEvidence(atlas.datasetFingerprint!);
    const result = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
      analyticalEvidence: evidence,
    });

    expect(result.system1ProposalSet).toBeDefined();
    expect(result.system1ProposalSet.status).toBe('PROPOSED');
    if (result.system1ProposalSet.status === 'PROPOSED') {
      expect(result.system1ProposalSet.candidates.length).toBeGreaterThan(0);
    }
    expect(result.system1ProposalSet.snapshotId).toBeTruthy();
    expect(result.provenance.system1ProposalSetId).toBe(result.system1ProposalSet.proposalSetId);

    // Persisted forma state carries the exact consumed set for replay
    const state = atlas.getFormaState();
    expect(state?.system1ProposalSet).toEqual(result.system1ProposalSet);
    const bytes = atlas.exportFormaInvestigationBytes();
    expect(bytes).toBeDefined();
    const roundTripped = JSON.parse(new TextDecoder().decode(bytes!));
    expect(roundTripped.system1ProposalSet).toEqual(
      JSON.parse(JSON.stringify(result.system1ProposalSet))
    );
  });

  test('PROPOSED advice seeds the search population with lineage; ABSTAIN seeds nothing', () => {
    const ds = makeDataset();
    const signature = buildDatasetSignature(ds);
    const evidence = makeValidEvidence(signature.provenance.datasetFingerprint);
    const snapshot = normalizeEnvelopeToSnapshot(evidence.envelope, evidence.evidenceReferences);
    const context = directContext();
    const manifest = createKB0Manifest();
    const proposer = new FormaSystem1Proposer();

    const proposed = proposer.generateProposals(
      snapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET
    );
    expect(proposed.status).toBe('PROPOSED');
    const withAdvice = RepresentationSearchEngine.search(signature, {
      preference: 'BALANCED',
      maxGenerations: 1,
      populationSize: 4,
      system1Proposals: proposed,
      context,
    });
    const seeded = withAdvice.candidates.filter((c) =>
      (c.lineage.operatorApplied ?? '').startsWith('SYSTEM1_SEED_')
    );
    expect(seeded.length).toBeGreaterThan(0);

    const emptyBody = {
      analyticalDatasetFingerprint: signature.provenance.datasetFingerprint,
      kernelVersion: '1.0.0',
      semanticVocabulary: { id: 'vocab', version: '1', digest: 'sha256-vocab' },
      normalizer: { id: 'norm', version: '1', digest: 'sha256-norm' },
      coverage: [],
      sources: [],
      nodes: [],
      relations: [],
      limitations: [],
    };
    const emptySnapshot: SemanticSnapshotV1 = {
      schemaVersion: 1,
      snapshotId: computeSnapshotId(emptyBody),
      body: emptyBody,
    };
    const abstained = proposer.generateProposals(
      emptySnapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET
    );
    expect(abstained.status).toBe('ABSTAIN');
    const withoutAdvice = RepresentationSearchEngine.search(signature, {
      preference: 'BALANCED',
      maxGenerations: 1,
      populationSize: 4,
      system1Proposals: abstained,
      context,
    });
    expect(
      withoutAdvice.candidates.filter((c) =>
        (c.lineage.operatorApplied ?? '').startsWith('SYSTEM1_SEED_')
      )
    ).toHaveLength(0);
  });

  test('ABSTAIN set is recorded, not swallowed, when admission accepts an empty snapshot', () => {
    const ds = makeDataset();
    const signature = buildDatasetSignature(ds);
    const evidence = makeValidEvidence(signature.provenance.datasetFingerprint);
    const sourceId = computeSourceId({
      family: 'AGGREGATE',
      analyticalRequestIdentity: 'req-abstain-001',
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
          analyticalRequestIdentity: 'req-abstain-001',
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

    const result = FullMonetaEngine.synthesizeOrAdapt(signature, directContext(), undefined, {
      snapshot,
      budget: QUEST_CONSTRAINED_BUDGET,
      maxGenerations: 1,
    });

    expect(result.system1ProposalSet.status).toBe('ABSTAIN');
    expect(result.provenance.system1ProposalSetId).toBe(result.system1ProposalSet.proposalSetId);
  });
});
