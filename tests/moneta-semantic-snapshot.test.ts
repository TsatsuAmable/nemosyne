import { describe, expect, it } from 'vitest';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.js';
import {
  normalizeEnvelopeToSnapshot,
  validateSemanticSnapshot,
  verifySnapshotIdentityInvariance,
  type EvidenceReferenceTupleV1,
  type SemanticSnapshotV1,
} from '../src/moneta/representation/SemanticSnapshotV1.js';

describe('SemanticSnapshotV1', () => {
  const sampleEvidenceRef: EvidenceReferenceTupleV1 = {
    datasetFingerprint: 'sha256-dataset-1234567890abcdef',
    kernelVersion: '1.0.0',
    bundleContentDigest: 'sha256-bundle-digest-1234567890',
    receiptId: 'receipt-001',
    receiptContentDigest: 'sha256-receipt-digest-001',
    consumerId: 'descriptive-summary/v1',
    requirementProfileId: 'profile-001',
    requirementProfileDigest: 'sha256-profile-digest-001',
    admissionPolicyId: 'policy-001',
    admissionPolicyDigest: 'sha256-policy-digest-001',
  };

  const sampleEnvelope: SemanticEmbodimentEnvelopeV1 = {
    schemaVersion: 1,
    datasetFingerprint: 'sha256-dataset-1234567890abcdef',
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
      decisionId: 'decision-abc-123',
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

  it('normalizes a READY analytical envelope into a valid SemanticSnapshotV1', () => {
    const snapshot = normalizeEnvelopeToSnapshot(sampleEnvelope, [sampleEvidenceRef]);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.snapshotId).toMatch(/^semantic-snapshot-v1:[a-f0-9]{64}$/);
    expect(snapshot.body.analyticalDatasetFingerprint).toBe('sha256-dataset-1234567890abcdef');
    expect(snapshot.body.sources.length).toBe(1);
    expect(snapshot.body.nodes.length).toBe(2);
    expect(() => validateSemanticSnapshot(snapshot)).not.toThrow();
  });

  it('guarantees presentation/decision identity invariance across different presentation decisions', () => {
    const envelope1 = { ...sampleEnvelope };
    const envelope2: SemanticEmbodimentEnvelopeV1 = {
      ...sampleEnvelope,
      provenance: {
        ...sampleEnvelope.provenance,
        decisionId: 'decision-different-456',
        decisionModelVersion: 'onnx-v3-experimental',
        decisionModelArtifactHash: 'hash-different-999',
      },
    };

    const snapshot1 = normalizeEnvelopeToSnapshot(envelope1, [sampleEvidenceRef]);
    const snapshot2 = normalizeEnvelopeToSnapshot(envelope2, [sampleEvidenceRef]);

    expect(verifySnapshotIdentityInvariance(snapshot1, snapshot2)).toBe(true);
    expect(snapshot1.snapshotId).toBe(snapshot2.snapshotId);
  });

  it('normalizes a REFUSED analytical envelope into a valid snapshot with REFUSED state', () => {
    const refusedEnvelope: SemanticEmbodimentEnvelopeV1 = {
      ...sampleEnvelope,
      result: {
        status: 'REFUSED',
        refusal: {
          code: 'MISSING_EVIDENCE',
          message: 'Governed evidence receipt missing or revoked',
        },
      },
    };

    const snapshot = normalizeEnvelopeToSnapshot(refusedEnvelope, [sampleEvidenceRef]);
    expect(snapshot.body.sources[0].state.status).toBe('REFUSED');
    expect(() => validateSemanticSnapshot(snapshot)).not.toThrow();
  });

  it('validates snapshot ordering and detects ID tampering', () => {
    const snapshot = normalizeEnvelopeToSnapshot(sampleEnvelope, [sampleEvidenceRef]);
    
    // Tamper with snapshotId
    const tamperedSnapshot: SemanticSnapshotV1 = {
      ...snapshot,
      snapshotId: 'semantic-snapshot-v1:tamperedhash123',
    };

    expect(() => validateSemanticSnapshot(tamperedSnapshot)).toThrow(/Snapshot ID mismatch/);
  });
});
