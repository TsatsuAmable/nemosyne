import { describe, expect, it } from 'vitest';
import { compileFormaAdmission } from '../src/moneta/forma/FormaAdmission.js';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.js';
import type { SemanticSnapshotV1 } from '../src/moneta/representation/SemanticSnapshotV1.js';
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.js';

describe('FormaAdmission & KB0 (L2-FORMA-0)', () => {
  const validSnapshot: SemanticSnapshotV1 = {
    schemaVersion: 1,
    snapshotId: 'semantic-snapshot-v1:validhash123',
    body: {
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
          evidenceReferences: [],
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
    },
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

  it('refuses admission when snapshot contains refused evidence sources', () => {
    const refusedSnapshot: SemanticSnapshotV1 = {
      ...validSnapshot,
      body: {
        ...validSnapshot.body,
        sources: [
          {
            ...validSnapshot.body.sources[0],
            state: { status: 'REFUSED', owningReason: 'Evidence receipt missing' },
          },
        ],
      },
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
