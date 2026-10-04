import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import { DESKTOP_EXPANSIVE_BUDGET } from '../src/moneta/forma/FormaResolutionBroker.ts';
import type { EvidenceReferenceTupleV1 } from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

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
    'fm5-s1-bypass-ds',
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
      decisionId: 'decision-fm5-003',
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

function setupAtlas(): AtlasCore {
  const bridge = makeKernelMockBridge();
  const atlas = new AtlasCore({ kernel: bridge });
  atlas.loadDataset(makeDataset());
  atlas.commitInvestigationContext('node-fm5-b', {
    schemaVersion: 2,
    nodeId: 'node-fm5-b',
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

describe('FM5-R3: governed deterministic fallback bypasses System-1 advice', () => {
  test('bypassed advice is still recorded, marked unapplied, and disclosed', () => {
    const atlas = setupAtlas();
    const evidence = makeEvidence(atlas.datasetFingerprint!);
    const result = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
      analyticalEvidence: evidence,
      ignoreSystem1Advice: true,
    });

    expect(result.system1ProposalSet.status).toBe('PROPOSED');
    expect(result.system1AdviceApplied).toBe(false);

    const state = atlas.getFormaState();
    expect(state?.system1ProposalSet).toEqual(result.system1ProposalSet);
    expect(state?.system1AdviceApplied).toBe(false);

    const report = atlas.explainFullMonetaDecision(result, 'BALANCED');
    expect(report).toContain('deliberately bypassed by caller request');
  });

  test('default path applies PROPOSED advice and discloses no bypass', () => {
    const atlas = setupAtlas();
    const evidence = makeEvidence(atlas.datasetFingerprint!);
    const result = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 2,
      analyticalEvidence: evidence,
    });

    expect(result.system1ProposalSet.status).toBe('PROPOSED');
    expect(result.system1AdviceApplied).toBe(true);

    const report = atlas.explainFullMonetaDecision(result, 'BALANCED');
    expect(report).not.toContain('deliberately bypassed');
  });
});
