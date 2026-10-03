import { describe, test, expect } from 'vitest';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.js';
import {
  compileFormaSpatialSlice,
  captureFormaExecution,
  replayFormaExecution,
  recordEmbodimentCritique,
} from '../src/moneta/forma/FormaSpatialCompiler.js';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.js';
import {
  normalizeEnvelopeToSnapshot,
  type EvidenceReferenceTupleV1,
} from '../src/moneta/representation/SemanticSnapshotV1.js';
import {
  canonicalizeCommittedInvestigationContext,
  type CommittedInvestigationContextV2,
} from '../src/atlas/domain/CommittedInvestigationContext.js';

describe('FormaSpatialCompiler (L2-FORMA-1)', () => {
  const dummyEvidence: EvidenceReferenceTupleV1[] = [
    {
      datasetFingerprint: 'sha256-dataset-1234567890abcdef',
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

  const snapshot = normalizeEnvelopeToSnapshot(envelope, dummyEvidence);
  const context = canonicalizeCommittedInvestigationContext({
    schemaVersion: 2,
    nodeId: 'node-investigation-01',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Does region drive count?',
      variablesOfInterest: ['region', 'count'],
    },
    epistemicPurpose: 'CLAIM_BEARING',
  }) as CommittedInvestigationContextV2;

  const manifest = createKB0Manifest();

  test('Exit Requirement 1: compiles into at least two valid spatial phenotypes without changing analytical identity', () => {
    const outcomeScatter = compileFormaSpatialSlice(snapshot, context, manifest, 'SPATIAL_SCATTER_V1');
    expect(outcomeScatter.status).toBe('COMPILED');
    if (outcomeScatter.status !== 'COMPILED') return;

    const outcomeSurface = compileFormaSpatialSlice(snapshot, context, manifest, 'SPATIAL_SURFACE_V1');
    expect(outcomeSurface.status).toBe('COMPILED');
    if (outcomeSurface.status !== 'COMPILED') return;

    // Both phenotypes must reference the exact same analytical snapshot identity
    expect(outcomeScatter.slice.snapshotId).toBe(snapshot.snapshotId);
    expect(outcomeSurface.slice.snapshotId).toBe(snapshot.snapshotId);

    // The slices themselves have distinct spatial encodings and slice identities
    expect(outcomeScatter.slice.sliceId).not.toBe(outcomeSurface.slice.sliceId);
    expect(outcomeScatter.slice.elements[0].visualEncoding.shape).toBe('SPHERE');
    expect(outcomeSurface.slice.elements[0].visualEncoding.shape).toBe('VOXEL');
    expect(outcomeScatter.slice.elements[0].position).not.toEqual(outcomeSurface.slice.elements[0].position);
  });

  test('Exit Requirement 2: every data-bearing property reverse-resolves to its binding/claim/evidence', () => {
    const outcome = compileFormaSpatialSlice(snapshot, context, manifest, 'SPATIAL_SCATTER_V1');
    expect(outcome.status).toBe('COMPILED');
    if (outcome.status !== 'COMPILED') return;

    expect(outcome.slice.reverseExplanation.length).toBe(snapshot.body.nodes.length);
    for (const trace of outcome.slice.reverseExplanation) {
      expect(trace.elementId).toBeDefined();
      expect(trace.channel).toBe('spatial_radial_scatter');
      expect(trace.semanticNodeId).toMatch(/^semantic-node-v1:/);
      expect(trace.evidenceReferences.length).toBeGreaterThan(0);
      expect(trace.evidenceReferences[0].datasetFingerprint).toBe('sha256-dataset-1234567890abcdef');
      expect(trace.evidenceReferences[0].receiptId).toBe('receipt-001');
    }
  });

  test('Exit Requirement 3: evidence substitution and drift refuses closed', () => {
    // Tampered snapshot with empty evidence references
    const tamperedSnapshot = {
      ...snapshot,
      body: {
        ...snapshot.body,
        sources: snapshot.body.sources.map((src) => ({
          ...src,
          evidenceReferences: [],
        })),
      },
    };

    const outcome = compileFormaSpatialSlice(tamperedSnapshot, context, manifest, 'SPATIAL_SCATTER_V1');
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('OBLIGATION_UNSATISFIED');
    }
  });

  test('Exit Requirement 4: exact capture and deterministic replay against frozen inputs', () => {
    const outcome = compileFormaSpatialSlice(snapshot, context, manifest, 'SPATIAL_SCATTER_V1');
    expect(outcome.status).toBe('COMPILED');
    if (outcome.status !== 'COMPILED') return;

    const capture = captureFormaExecution(outcome.slice, manifest);
    expect(capture.executionId).toBeDefined();
    expect(capture.sliceId).toBe(outcome.slice.sliceId);

    // Replay with identical inputs must succeed bitwise
    const replayMatch = replayFormaExecution(capture, {
      snapshot,
      context,
      manifest,
      phenotype: 'SPATIAL_SCATTER_V1',
    });
    expect(replayMatch.success).toBe(true);
    if (replayMatch.success) {
      expect(replayMatch.slice.sliceId).toBe(outcome.slice.sliceId);
    }

    // Replay with different phenotype or drifted context must fail
    const replayPhenotypeMismatch = replayFormaExecution(capture, {
      snapshot,
      context,
      manifest,
      phenotype: 'SPATIAL_SURFACE_V1',
    });
    expect(replayPhenotypeMismatch.success).toBe(false);

    const driftedContext = {
      ...context,
      nodeId: 'node-investigation-02-drifted',
    } as CommittedInvestigationContextV2;

    const replayContextMismatch = replayFormaExecution(capture, {
      snapshot,
      context: driftedContext,
      manifest,
      phenotype: 'SPATIAL_SCATTER_V1',
    });
    expect(replayContextMismatch.success).toBe(false);
  });

  test('Exit Requirement 5: confirmed human critique binds exact plan/context without updating production priors', () => {
    const outcomeBefore = compileFormaSpatialSlice(snapshot, context, manifest, 'SPATIAL_SCATTER_V1');
    expect(outcomeBefore.status).toBe('COMPILED');
    if (outcomeBefore.status !== 'COMPILED') return;

    const critique = recordEmbodimentCritique({
      planId: outcomeBefore.slice.planId,
      sliceId: outcomeBefore.slice.sliceId,
      contextId: context.nodeId,
      semanticNodeId: snapshot.body.nodes[0].nodeId,
      critiqueText: 'Radial scatter cluster is difficult to differentiate on mobile displays',
      proposedAlternativePhenotype: 'SPATIAL_SURFACE_V1',
      confirmed: true,
    });

    expect(critique.critiqueId).toBeDefined();
    expect(critique.confirmed).toBe(true);
    expect(critique.sliceId).toBe(outcomeBefore.slice.sliceId);

    // Subsequent compilation remains completely deterministic and unadapted
    const outcomeAfter = compileFormaSpatialSlice(snapshot, context, manifest, 'SPATIAL_SCATTER_V1');
    expect(outcomeAfter.status).toBe('COMPILED');
    if (outcomeAfter.status !== 'COMPILED') return;

    expect(outcomeAfter.slice.sliceId).toBe(outcomeBefore.slice.sliceId);
    expect(outcomeAfter.slice.elements).toEqual(outcomeBefore.slice.elements);
  });
});
