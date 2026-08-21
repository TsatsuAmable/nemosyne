import { describe, expect, it } from 'vitest';
import {
  DATASET_EVIDENCE_SCHEMA_VERSION,
  InvalidDatasetEvidenceError,
  assertDatasetEvidence,
  createDatasetEvidence,
  validateDatasetEvidence,
  type DatasetEvidence,
} from '../src/data/evidence/index.ts';

function validEvidence(): DatasetEvidence {
  return {
    schemaVersion: DATASET_EVIDENCE_SCHEMA_VERSION,
    datasetFingerprint: 'sha256:dataset-001',
    kernelVersion: 'wasm-kernel-3',
    evidence: [
      {
        id: 'spectral:entropy:x',
        category: 'spectral',
        name: 'spectral-entropy',
        value: 0.42,
        provenance: {
          method: 'fft',
          methodVersion: '1',
          kernelVersion: 'wasm-kernel-3',
          parameters: { window: 'hann', bins: 64 },
          deterministic: true,
          normalization: 'unit-energy',
          missingDataPolicy: 'reject',
          samplingPolicy: 'full-dataset',
          limitations: [],
        },
        uncertainty: { kind: 'none' },
      },
    ],
  };
}

describe('DatasetEvidence V3 contract', () => {
  it('accepts a provenance-complete analytical evidence envelope', () => {
    const evidence = validEvidence();
    expect(createDatasetEvidence(evidence)).toBe(evidence);
    expect(validateDatasetEvidence(evidence)).toEqual([]);
  });

  it('rejects duplicate evidence identities', () => {
    const evidence = validEvidence();
    evidence.evidence = [evidence.evidence[0], { ...evidence.evidence[0] }];

    expect(validateDatasetEvidence(evidence)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'evidence[1].id', message: expect.stringContaining('duplicate') }),
      ])
    );
  });

  it('rejects evidence produced by a different kernel version', () => {
    const evidence = validEvidence();
    evidence.evidence = [
      {
        ...evidence.evidence[0],
        provenance: { ...evidence.evidence[0].provenance, kernelVersion: 'other-kernel' },
      },
    ];

    expect(() => assertDatasetEvidence(evidence)).toThrow(InvalidDatasetEvidenceError);
    expect(validateDatasetEvidence(evidence)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'evidence[0].provenance.kernelVersion',
          message: expect.stringContaining('must match'),
        }),
      ])
    );
  });

  it('requires replay seeds for stochastic analytical methods', () => {
    const evidence = validEvidence();
    evidence.evidence = [
      {
        ...evidence.evidence[0],
        category: 'cluster',
        name: 'kmeans-clusters',
        provenance: {
          ...evidence.evidence[0].provenance,
          method: 'kmeans',
          deterministic: false,
        },
      },
    ];

    expect(validateDatasetEvidence(evidence)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'evidence[0].provenance.seed',
          message: expect.stringContaining('finite seed'),
        }),
      ])
    );
  });

  it('accepts stochastic methods when the seed is explicit', () => {
    const evidence = validEvidence();
    evidence.evidence = [
      {
        ...evidence.evidence[0],
        category: 'cluster',
        name: 'kmeans-clusters',
        provenance: {
          ...evidence.evidence[0].provenance,
          method: 'kmeans',
          deterministic: false,
          seed: 1729,
        },
      },
    ];

    expect(validateDatasetEvidence(evidence)).toEqual([]);
  });

  it('rejects malformed uncertainty metadata', () => {
    const evidence = validEvidence();
    evidence.evidence = [
      {
        ...evidence.evidence[0],
        uncertainty: { kind: 'interval', lower: 5, upper: 2, confidenceLevel: 1.2 },
      },
    ];

    const issues = validateDatasetEvidence(evidence);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'evidence[0].uncertainty' }),
        expect.objectContaining({ path: 'evidence[0].uncertainty.confidenceLevel' }),
      ])
    );
  });
});
