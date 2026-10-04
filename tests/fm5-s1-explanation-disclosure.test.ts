import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import { DESKTOP_EXPANSIVE_BUDGET } from '../src/moneta/forma/FormaResolutionBroker.ts';
import { FullMonetaEngine } from '../src/moneta/adaptation/index.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import {
  computeSnapshotId,
  computeSourceId,
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
    'fm5-s1-disclosure-ds',
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
    approximation: { mode: 'EXACT', representedRowCount: 80 },
    informationContract: {
      preserves: ['exact-metric-values'],
      loses: ['individual-observation-identity'],
    },
    resource: { sourceRowCount: 80, elementCount: 2, maxElementCount: 4096 },
    provenance: {
      kernelVersion: '1.0.0',
      algorithmVersion: '1.0.0',
      decisionId: 'decision-fm5-002',
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

describe('FM5-R2: TechnoCore discloses consumed System-1 advice', () => {
  test('PROPOSED advice is disclosed as advice with set identity and effect', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(makeDataset());
    atlas.commitInvestigationContext('node-fm5-d', {
      schemaVersion: 2,
      nodeId: 'node-fm5-d',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'How do points cluster?',
        variablesOfInterest: ['dim1', 'dim2'],
        currentTask: 'cluster_analysis',
      },
      epistemicPurpose: 'CLAIM_BEARING',
    });

    const evidence = makeEvidence(atlas.datasetFingerprint!);
    const result = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
      analyticalEvidence: evidence,
    });
    const report = atlas.explainFullMonetaDecision(result, 'BALANCED');

    expect(report).toContain('System-1 Advisory Disclosure:');
    expect(report).toContain(result.system1ProposalSet.proposalSetId);
    expect(report).toContain('advice, not analytical evidence');
    if (result.system1ProposalSet.status === 'PROPOSED') {
      expect(report).toContain(result.system1ProposalSet.candidates[0].templateId);
    }
    expect(
      report.includes('originated from System-1 advice') ||
        report.includes('competed; the selected candidate')
    ).toBe(true);
  });

  test('ABSTAIN is disclosed with reason and honest fallback', () => {
    const ds = makeDataset();
    const signature = buildDatasetSignature(ds);
    const evidence = makeEvidence(signature.provenance.datasetFingerprint);
    const sourceId = computeSourceId({
      family: 'AGGREGATE',
      analyticalRequestIdentity: 'req-abstain-002',
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
          analyticalRequestIdentity: 'req-abstain-002',
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
      nodeId: 'node-fm5-d-abstain',
      intent: { schemaVersion: 1, researchQuestion: 'Empty probe' },
      epistemicPurpose: 'CLAIM_BEARING',
    };

    const result = FullMonetaEngine.synthesizeOrAdapt(signature, context, undefined, {
      snapshot,
      maxGenerations: 1,
    });
    expect(result.system1ProposalSet.status).toBe('ABSTAIN');
    const report = FullMonetaEngine.explainFullMonetaDecision(result);
    expect(report).toContain('System-1 Advisory Disclosure:');
    expect(report).toContain('ABSTAINED');
    expect(report).toContain('without System-1 advice');
  });
});
