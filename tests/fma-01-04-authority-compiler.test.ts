import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import { compileFormaAdmission } from '../src/moneta/forma/FormaAdmission.ts';
import { compileFormaSpatialSlice } from '../src/moneta/forma/FormaSpatialCompiler.ts';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.ts';
import {
  normalizeEnvelopeToSnapshot,
  type EvidenceReferenceTupleV1,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import {
  canonicalizeCommittedInvestigationContext,
  type CommittedInvestigationContextV2,
} from '../src/atlas/domain/CommittedInvestigationContext.ts';
import { FullMonetaEngine } from '../src/moneta/adaptation/index.ts';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';

describe('Audit Review Repair Contract: FMA-01 through FMA-04 Authority & Compiler Verification', () => {
  const dummyEvidence: EvidenceReferenceTupleV1[] = [
    {
      datasetFingerprint: 'sha256-dataset-audit-fixture-001',
      kernelVersion: '1.0.0',
      bundleContentDigest: 'sha256-bundle-001',
      receiptId: 'receipt-audit-001',
      receiptContentDigest: 'sha256-receipt-digest-001',
      consumerId: 'descriptive-summary/v1',
      requirementProfileId: 'profile-001',
      requirementProfileDigest: 'sha256-profile-digest-001',
      admissionPolicyId: 'policy-001',
      admissionPolicyDigest: 'sha256-policy-digest-001',
    },
  ];

  const countEnvelope: SemanticEmbodimentEnvelopeV1 = {
    schemaVersion: 1,
    datasetFingerprint: 'sha256-dataset-audit-fixture-001',
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: {
      name: 'aggregateVolume',
      version: '1.0.0',
      parameters: { groupingFields: ['region'], measure: 'COUNT' },
    },
    approximation: {
      mode: 'EXACT',
      representedRowCount: 1000,
    },
    informationContract: {
      preserves: ['exact-metric-values'],
      loses: ['individual-observation-identity'],
    },
    resource: {
      sourceRowCount: 1000,
      elementCount: 2,
      maxElementCount: 4096,
    },
    provenance: {
      kernelVersion: '1.0.0',
      algorithmVersion: '1.0.0',
      decisionId: 'decision-audit-001',
      decisionModelVersion: 'onnx-v2',
      decisionModelArtifactHash: 'hash-xyz',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'AGGREGATE_VOLUME',
        data: {
          groupingFields: ['region'],
          measure: { function: 'COUNT' },
          groups: [
            { semanticId: 'group-north', key: 'North', count: 600 },
            { semanticId: 'group-south', key: 'South', count: 400 },
          ],
        },
      },
    },
  };

  const validSnapshot = normalizeEnvelopeToSnapshot(countEnvelope, dummyEvidence);

  const validContext = canonicalizeCommittedInvestigationContext({
    schemaVersion: 2,
    nodeId: 'node-investigation-audit',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Does region drive count?',
      variablesOfInterest: ['region', 'count'],
    },
    epistemicPurpose: 'CLAIM_BEARING',
  }) as CommittedInvestigationContextV2;

  const manifest = createKB0Manifest();

  test('FMA-01 probe: FullMonetaEngine on ungrounded input without analytical evidence refuses fail-closed without minting fake receipts', () => {
    const rows = [{ val: 1.0 }, { val: 2.0 }];
    const ds = new Dataset('unclustered-ds', [{ name: 'val', type: ColumnType.NUMERIC }], rows);
    const signature = buildDatasetSignature(ds);

    expect(() => {
      FullMonetaEngine.synthesizeOrAdapt(signature, validContext, undefined, {
        preference: 'BALANCED',
      });
    }).toThrowError(/Adaptation refused: analytical evidence is unavailable/);

    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(ds);

    expect(() => {
      atlas.adaptRepresentation({ preference: 'BALANCED' });
    }).toThrowError(/Adaptation refused: analytical evidence is unavailable/);
  });

  test('FMA-02a probe: compileFormaAdmission with requestedUse REFUSED returns REFUSED', () => {
    const outcome = compileFormaAdmission(validSnapshot, validContext, 'REFUSED');
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('POLICY_REFUSAL');
      expect(outcome.refusal.message).toContain('refused or unsupported');
    }
  });

  test('FMA-02b probe: cloned snapshot with altered node value under stale snapshotId refuses with UNTRUSTED_DECODING', () => {
    const tamperedSnapshot = {
      ...validSnapshot,
      body: {
        ...validSnapshot.body,
        nodes: [
          {
            ...validSnapshot.body.nodes[0],
            value: 12345,
          },
          ...validSnapshot.body.nodes.slice(1),
        ],
      },
    };

    const admissionOutcome = compileFormaAdmission(tamperedSnapshot, validContext);
    expect(admissionOutcome.status).toBe('REFUSED');
    if (admissionOutcome.status === 'REFUSED') {
      expect(admissionOutcome.refusal.code).toBe('UNTRUSTED_DECODING');
    }

    const compileOutcome = compileFormaSpatialSlice(tamperedSnapshot, validContext, manifest, 'SPATIAL_SCATTER_V1');
    expect(compileOutcome.status).toBe('REFUSED');
    if (compileOutcome.status === 'REFUSED') {
      expect(compileOutcome.refusal.code).toBe('UNTRUSTED_DECODING');
    }
  });

  test('FMA-03 probe: perspective interval foregrounding on count-only fixture refuses with UNSUPPORTED_MAPPING', () => {
    const countOnlyIntervalContext: CommittedInvestigationContextV2 = {
      ...validContext,
      perspective: {
        schemaVersion: 1,
        mode: 'foreground',
        uncertaintyForegrounding: 'interval',
      },
    };

    const outcome = compileFormaSpatialSlice(validSnapshot, countOnlyIntervalContext, manifest, 'SPATIAL_SCATTER_V1');
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('UNSUPPORTED_MAPPING');
      expect(outcome.refusal.message).toContain('lacking interval or variance metadata');
    }
  });

  test('FMA-03 scale probe: distinct values 1 and 11 produce distinct monotonic heights without modulo loss', () => {
    const customEnvelope: SemanticEmbodimentEnvelopeV1 = {
      ...countEnvelope,
      result: {
        status: 'READY',
        payload: {
          kind: 'AGGREGATE_VOLUME',
          data: {
            groupingFields: ['region'],
            measure: { function: 'COUNT' },
            groups: [
              { semanticId: 'group-one', key: 'One', count: 1 },
              { semanticId: 'group-eleven', key: 'Eleven', count: 11 },
            ],
          },
        },
      },
    };
    const customSnapshot = normalizeEnvelopeToSnapshot(customEnvelope, dummyEvidence);
    const outcome = compileFormaSpatialSlice(customSnapshot, validContext, manifest, 'SPATIAL_SCATTER_V1');
    expect(outcome.status).toBe('COMPILED');
    if (outcome.status === 'COMPILED') {
      const height1 = outcome.slice.elements[0].position[1];
      const height11 = outcome.slice.elements[1].position[1];
      expect(height1).not.toBe(height11);
      expect(height11).toBeGreaterThan(height1);
    }
  });

  test('FMA-04 probe: compiling two nodes produces two unique semanticNodeIds and two distinct elementIds', () => {
    const outcome = compileFormaSpatialSlice(validSnapshot, validContext, manifest, 'SPATIAL_SCATTER_V1');
    expect(outcome.status).toBe('COMPILED');
    if (outcome.status === 'COMPILED') {
      expect(validSnapshot.body.nodes.length).toBe(2);
      expect(outcome.slice.elements.length).toBe(2);

      const semanticIds = outcome.slice.elements.map((e) => e.semanticNodeId);
      const elementIds = outcome.slice.elements.map((e) => e.elementId);

      expect(new Set(semanticIds).size).toBe(2);
      expect(new Set(elementIds).size).toBe(2);
      expect(elementIds[0]).not.toBe(elementIds[1]);
      expect(outcome.slice.reverseExplanation[0].elementId).toBe(elementIds[0]);
      expect(outcome.slice.reverseExplanation[1].elementId).toBe(elementIds[1]);
    }
  });
});
