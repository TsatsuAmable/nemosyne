import { describe, expect, it } from 'vitest';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.js';
import { sha256Hex } from '../src/security/CryptoHash.ts';
import {
  normalizeDirectDistributionBindingToSnapshot,
  normalizeEnvelopeToSnapshot,
  validateSemanticSnapshot,
  verifySnapshotIdentityInvariance,
  type EvidenceReferenceTupleV1,
  type SemanticSnapshotV1,
} from '../src/moneta/representation/SemanticSnapshotV1.js';
import {
  DIRECT_DISTRIBUTION_CONSUMER_ID_V1,
  type DirectDistributionBindingV1,
} from '../src/moneta/representation/DirectDistributionBindingV1.ts';
import { DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1 } from '../src/data/evidence/EvidenceRequirementProfile.ts';

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

  function directBinding(overrides: Partial<DirectDistributionBindingV1> = {}): DirectDistributionBindingV1 {
    const source: SemanticEmbodimentEnvelopeV1 = {
      ...sampleEnvelope,
      candidateId: 'DISTRIBUTION_FIELD',
      representationFamily: 'DISTRIBUTION',
      analyticalMethod: {
        name: 'univariate-empirical-distribution',
        version: '1.0.0',
        parameters: { measureField: 'x', histogramBinCount: 8, ecdfKnotCount: 8 },
      },
      result: {
        status: 'READY',
        payload: {
          kind: 'EMPIRICAL_DISTRIBUTION',
          data: {
            measureField: 'x',
            counts: { sourceCount: 2, validCount: 2, excludedCount: 0 },
            domain: { min: 1, max: 2 },
            histogram: [{ semanticId: 'bin-0', lowerBound: 1, upperBound: 2, count: 2, upperInclusive: true }],
            ecdf: [{ semanticId: 'knot-0', value: 1, cumulativeProbability: 0.5, cumulativeCount: 1 }],
            quantiles: [],
          },
        },
      },
      provenance: {
        ...sampleEnvelope.provenance,
        kernelVersion: '1.0.0',
      },
    };
    const sourceJson = JSON.stringify(source);
    const sourceDigest = sha256Hex(sourceJson);
    return {
      schemaVersion: '1',
      consumerId: DIRECT_DISTRIBUTION_CONSUMER_ID_V1,
      requirementProfileId: DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1.profileId,
      claimKind: 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION',
      datasetFingerprint: source.datasetFingerprint,
      kernelVersion: '1.0.0',
      sourceDigest,
      sourceJson,
      receiptId: `direct-distribution:${sourceDigest}`,
      source,
      ...overrides,
    };
  }

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

  it('normalizes a verified direct binding with its fixed kernel-issued reference', () => {
    const binding = directBinding();
    const snapshot = normalizeDirectDistributionBindingToSnapshot(binding);

    expect(snapshot.body.directDistributionReference).toEqual({
      schemaVersion: '1',
      consumerId: DIRECT_DISTRIBUTION_CONSUMER_ID_V1,
      requirementProfileId: DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1.profileId,
      claimKind: 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION',
      datasetFingerprint: binding.datasetFingerprint,
      kernelVersion: binding.kernelVersion,
      sourceDigest: binding.sourceDigest,
      receiptId: binding.receiptId,
      sourceId: snapshot.body.directDistributionReference!.sourceId,
    });
    expect(snapshot.body.sources[0].evidenceReferences).toEqual([]);
    expect(() => validateSemanticSnapshot(snapshot)).not.toThrow();
    expect(normalizeDirectDistributionBindingToSnapshot(binding)).toEqual(snapshot);
  });

  it('refuses a direct binding whose fixed consumer identity is substituted', () => {
    const binding = directBinding({ consumerId: 'nemosyne:consumer/not-direct/v1' as typeof DIRECT_DISTRIBUTION_CONSUMER_ID_V1 });

    expect(() => normalizeDirectDistributionBindingToSnapshot(binding)).toThrow(/Consumer\/profile\/claim authority mismatch/);
  });

  it('keeps legacy snapshots free of a direct-distribution reference', () => {
    const snapshot = normalizeEnvelopeToSnapshot(sampleEnvelope, [sampleEvidenceRef]);

    expect('directDistributionReference' in snapshot.body).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('directDistribution');
  });
});
