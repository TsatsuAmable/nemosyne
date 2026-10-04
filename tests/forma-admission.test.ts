import { describe, expect, it } from 'vitest';
import { compileFormaAdmission } from '../src/moneta/forma/FormaAdmission.js';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.js';
import {
  type SemanticSnapshotV1,
  type SemanticSnapshotBodyV1,
  computeSnapshotId,
  type EvidenceReferenceTupleV1,
} from '../src/moneta/representation/SemanticSnapshotV1.js';
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.js';

describe('FormaAdmission & KB0 (L2-FORMA-0)', () => {
  const validEvidenceReferences: EvidenceReferenceTupleV1[] = [
    {
      datasetFingerprint: 'sha256-dataset-123',
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

  const validBody: SemanticSnapshotBodyV1 = {
    analyticalDatasetFingerprint: 'sha256-dataset-123',
    kernelVersion: '1.0.0',
    semanticVocabulary: { id: 'vocab-v1', version: '1.0.0', digest: 'dig-v1' },
    normalizer: { id: 'norm-v1', version: '1.0.0', digest: 'dig-n1' },
    coverage: [{ family: 'AGGREGATE', analyticalRequestDigest: 'dig-req1', status: 'AVAILABLE' }],
    sources: [
      {
        sourceId: 'src-001',
        family: 'AGGREGATE',
        analyticalRequestIdentity: 'req-001',
        method: 'aggregateVolume',
        methodVersion: '1.0.0',
        parametersDigest: 'params-001',
        state: { status: 'AVAILABLE' },
        evidenceReferences: validEvidenceReferences,
        limitations: [],
      },
    ],
    nodes: [
      {
        nodeId: 'node-001',
        sourceId: 'src-001',
        producerSemanticId: 'group-north',
        propertyPath: 'count',
        descriptor: { label: 'North Count', valueType: 'number' },
        value: 100,
        state: { status: 'AVAILABLE' },
      },
    ],
    relations: [],
    limitations: [],
  };

  const validSnapshot: SemanticSnapshotV1 = {
    schemaVersion: 1,
    snapshotId: computeSnapshotId(validBody),
    body: validBody,
  };

  const validContext: CommittedInvestigationContextV2 = {
    schemaVersion: 2,
    nodeId: 'node-context-001',
    epistemicPurpose: 'CLAIM_BEARING',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Is North count growing?',
    },
  };

  it('admits a valid snapshot and context for PRODUCTION execution', () => {
    const outcome = compileFormaAdmission(validSnapshot, validContext, 'PRODUCTION');
    expect(outcome.status).toBe('ADMITTED');
    if (outcome.status === 'ADMITTED') {
      expect(outcome.result.body.permittedUse).toBe('PRODUCTION');
      expect(outcome.result.body.reverseExplanation.mappings.length).toBe(1);
    }
  });

  it('admits a STUDY_ONLY execution request with explicit STUDY_ONLY permission', () => {
    const outcome = compileFormaAdmission(validSnapshot, validContext, 'STUDY_ONLY');
    expect(outcome.status).toBe('ADMITTED');
    if (outcome.status === 'ADMITTED') {
      expect(outcome.result.body.permittedUse).toBe('STUDY_ONLY');
    }
  });

  it('refuses admission when requested use is REFUSED (FMA-02a falsifier)', () => {
    const outcome = compileFormaAdmission(validSnapshot, validContext, 'REFUSED');
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('POLICY_REFUSAL');
      expect(outcome.refusal.message).toContain('refused or unsupported');
    }
  });

  it('refuses admission when snapshot value is tampered under original snapshotId (FMA-02b falsifier)', () => {
    const tamperedSnapshot: SemanticSnapshotV1 = {
      ...validSnapshot,
      body: {
        ...validSnapshot.body,
        nodes: [
          {
            ...validSnapshot.body.nodes[0],
            value: 999999,
          },
        ],
      },
    };

    const outcome = compileFormaAdmission(tamperedSnapshot, validContext);
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('UNTRUSTED_DECODING');
      expect(outcome.refusal.message).toContain('Snapshot ID mismatch');
    }
  });

  it('refuses admission when evidence references are missing', () => {
    const noEvidenceBody: SemanticSnapshotBodyV1 = {
      ...validBody,
      sources: [
        {
          ...validBody.sources[0],
          evidenceReferences: [],
        },
      ],
    };
    const noEvidenceSnapshot: SemanticSnapshotV1 = {
      schemaVersion: 1,
      snapshotId: computeSnapshotId(noEvidenceBody),
      body: noEvidenceBody,
    };

    const outcome = compileFormaAdmission(noEvidenceSnapshot, validContext);
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('OBLIGATION_UNSATISFIED');
    }
  });

  it('refuses admission when snapshot contains refused evidence sources', () => {
    const refusedBody: SemanticSnapshotBodyV1 = {
      ...validBody,
      sources: [
        {
          ...validBody.sources[0],
          state: { status: 'REFUSED', owningReason: 'Evidence receipt missing' },
        },
      ],
    };
    const refusedSnapshot: SemanticSnapshotV1 = {
      schemaVersion: 1,
      snapshotId: computeSnapshotId(refusedBody),
      body: refusedBody,
    };

    const outcome = compileFormaAdmission(refusedSnapshot, validContext);
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('POLICY_REFUSAL');
    }
  });

  it('generates a deterministic KB0 knowledge manifest', () => {
    const manifest = createKB0Manifest();
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.manifestId).toMatch(/^kb0-manifest-v1:[a-f0-9]{64}$/);
    expect(manifest.body.channels).toContain('spatial_x');
  });
});
