import { describe, test, expect } from 'vitest';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.js';
import {
  compileFormaSpatialSlice,
} from '../src/moneta/forma/FormaSpatialCompiler.js';
import {
  FormaMultiElementRuntime,
} from '../src/moneta/forma/FormaMultiElementRuntime.js';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.js';
import {
  normalizeEnvelopeToSnapshot,
  type EvidenceReferenceTupleV1,
} from '../src/moneta/representation/SemanticSnapshotV1.js';
import {
  canonicalizeCommittedInvestigationContext,
  type CommittedInvestigationContextV2,
} from '../src/atlas/domain/CommittedInvestigationContext.js';

describe('FormaMultiElementRuntime (L2-FORMA-2 / MCR3-4)', () => {
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

  const envelopeA: SemanticEmbodimentEnvelopeV1 = {
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
      decisionId: 'decision-a',
      decisionModelVersion: 'onnx-v2',
      decisionModelArtifactHash: 'hash-a',
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

  const envelopeB: SemanticEmbodimentEnvelopeV1 = {
    schemaVersion: 1,
    datasetFingerprint: 'sha256-dataset-1234567890abcdef',
    candidateId: 'DISTRIBUTION_FIELD',
    representationFamily: 'DISTRIBUTION',
    analyticalMethod: {
      name: 'empiricalDistribution',
      version: '1.0.0',
      parameters: { field: 'score', binCount: 2 },
    },
    approximation: {
      mode: 'EXACT',
      representedRowCount: 1000,
    },
    informationContract: {
      preserves: ['empirical-distribution-shape'],
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
      decisionId: 'decision-b',
      decisionModelVersion: 'onnx-v2',
      decisionModelArtifactHash: 'hash-b',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'EMPIRICAL_DISTRIBUTION',
        data: {
          measureField: 'score',
          domain: { min: 0, max: 100 },
          counts: { sourceCount: 1000, validCount: 1000, excludedCount: 0 },
          histogram: [
            { semanticId: 'bin-0', lowerBound: 0, upperBound: 50, count: 350, upperInclusive: false },
            { semanticId: 'bin-1', lowerBound: 50, upperBound: 100, count: 650, upperInclusive: true },
          ],
          ecdf: [],
          quantiles: [],
        },
      },
    },
  };

  const snapshotA = normalizeEnvelopeToSnapshot(envelopeA, dummyEvidence);
  const snapshotB = normalizeEnvelopeToSnapshot(envelopeB, dummyEvidence);

  const context = canonicalizeCommittedInvestigationContext({
    schemaVersion: 2,
    nodeId: 'node-investigation-01',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Does region correlate with score distribution?',
      variablesOfInterest: ['region', 'score'],
    },
    epistemicPurpose: 'CLAIM_BEARING',
  }) as CommittedInvestigationContextV2;

  const manifest = createKB0Manifest();

  test('Exit Requirement 1: multiple renderable elements coexist under a composed representation', () => {
    const outcomeA = compileFormaSpatialSlice(snapshotA, context, manifest, 'SPATIAL_SCATTER_V1');
    const outcomeB = compileFormaSpatialSlice(snapshotB, context, manifest, 'SPATIAL_SURFACE_V1');
    expect(outcomeA.status).toBe('COMPILED');
    expect(outcomeB.status).toBe('COMPILED');
    if (outcomeA.status !== 'COMPILED' || outcomeB.status !== 'COMPILED') return;

    const runtime = new FormaMultiElementRuntime();
    const elemA = runtime.registerElement('elem-aggregate', outcomeA.slice, 'AGGREGATE_VOLUME');
    const elemB = runtime.registerElement('elem-distribution', outcomeB.slice, 'EMPIRICAL_DISTRIBUTION');
    runtime.addRelationship('elem-aggregate', 'elem-distribution', 'COORDINATES_WITH');

    expect(elemA.lifecycleState).toBe('RESIDENT');
    expect(elemB.lifecycleState).toBe('RESIDENT');
    expect(runtime.getAllElements().length).toBe(2);

    const composedIdentity = runtime.computeComposedIdentity();
    expect(composedIdentity).toMatch(/^composed-forma-v1:[a-f0-9]{64}$/);
  });

  test('Exit Requirement 2: elements cool/evict/reconstruct independently without destroying siblings', () => {
    const outcomeA = compileFormaSpatialSlice(snapshotA, context, manifest, 'SPATIAL_SCATTER_V1');
    const outcomeB = compileFormaSpatialSlice(snapshotB, context, manifest, 'SPATIAL_SURFACE_V1');
    if (outcomeA.status !== 'COMPILED' || outcomeB.status !== 'COMPILED') return;

    const runtime = new FormaMultiElementRuntime();
    runtime.registerElement('elem-aggregate', outcomeA.slice, 'AGGREGATE_VOLUME');
    runtime.registerElement('elem-distribution', outcomeB.slice, 'EMPIRICAL_DISTRIBUTION');
    runtime.addRelationship('elem-aggregate', 'elem-distribution', 'DETAIL_OF');

    // Cool Element A
    runtime.coolElement('elem-aggregate');
    expect(runtime.getElement('elem-aggregate')?.lifecycleState).toBe('COOLED');
    expect(runtime.getElement('elem-aggregate')?.spatialElements.length).toBe(0);

    // Sibling Element B remains unaffected and fully resident
    expect(runtime.getElement('elem-distribution')?.lifecycleState).toBe('RESIDENT');
    expect(runtime.getElement('elem-distribution')?.spatialElements.length).toBeGreaterThan(0);

    // Reconstruct Element A
    runtime.reconstructElement('elem-aggregate', outcomeA.slice, 1);
    expect(runtime.getElement('elem-aggregate')?.lifecycleState).toBe('RESIDENT');
    expect(runtime.getElement('elem-aggregate')?.spatialElements.length).toBeGreaterThan(0);
  });

  test('Exit Requirement 3: evicting element advances generation and refuses stale reconstruction', () => {
    const outcomeA = compileFormaSpatialSlice(snapshotA, context, manifest, 'SPATIAL_SCATTER_V1');
    if (outcomeA.status !== 'COMPILED') return;

    const runtime = new FormaMultiElementRuntime();
    runtime.registerElement('elem-aggregate', outcomeA.slice, 'AGGREGATE_VOLUME');

    // Evict advances generation from 1 to 2
    runtime.evictElement('elem-aggregate');
    expect(runtime.getElement('elem-aggregate')?.lifecycleState).toBe('EVICTED');
    expect(runtime.getElement('elem-aggregate')?.generation).toBe(2);

    // Reconstructing with stale generation 1 throws STALE_GENERATION_REFUSAL
    expect(() =>
      runtime.reconstructElement('elem-aggregate', outcomeA.slice, 1),
    ).toThrow(/STALE_GENERATION_REFUSAL/);

    // Reconstructing with current generation 2 succeeds
    runtime.reconstructElement('elem-aggregate', outcomeA.slice, 2);
    expect(runtime.getElement('elem-aggregate')?.lifecycleState).toBe('RESIDENT');
  });

  test('Exit Requirement 4: select element independently by persistent semantic ID', () => {
    const outcomeA = compileFormaSpatialSlice(snapshotA, context, manifest, 'SPATIAL_SCATTER_V1');
    if (outcomeA.status !== 'COMPILED') return;

    const runtime = new FormaMultiElementRuntime();
    runtime.registerElement('elem-aggregate', outcomeA.slice, 'AGGREGATE_VOLUME');

    const targetSemanticNodeId = snapshotA.body.nodes[0].nodeId;
    const selection = runtime.selectBySemanticId('elem-aggregate', targetSemanticNodeId);

    expect(selection.selectedElementId).toBe('elem-aggregate');
    expect(selection.semanticNodeId).toBe(targetSemanticNodeId);
    expect(selection.channel).toBe('spatial_radial_scatter');
    expect(runtime.getActiveSelection()).toEqual(selection);

    // Unknown semantic ID throws rather than guessing or defaulting
    expect(() =>
      runtime.selectBySemanticId('elem-aggregate', 'unknown-node-id'),
    ).toThrow(/not found/);
  });

  test('Exit Requirement 5: composed identity remains stable across non-destructive lifecycle states', () => {
    const outcomeA = compileFormaSpatialSlice(snapshotA, context, manifest, 'SPATIAL_SCATTER_V1');
    const outcomeB = compileFormaSpatialSlice(snapshotB, context, manifest, 'SPATIAL_SURFACE_V1');
    if (outcomeA.status !== 'COMPILED' || outcomeB.status !== 'COMPILED') return;

    const runtime = new FormaMultiElementRuntime();
    runtime.registerElement('elem-aggregate', outcomeA.slice, 'AGGREGATE_VOLUME');
    runtime.registerElement('elem-distribution', outcomeB.slice, 'EMPIRICAL_DISTRIBUTION');
    runtime.addRelationship('elem-aggregate', 'elem-distribution', 'OVERLAY');

    const identityInitial = runtime.computeComposedIdentity();

    // Cooling Element A
    runtime.coolElement('elem-aggregate');
    const identityAfterCool = runtime.computeComposedIdentity();
    expect(identityAfterCool).toBe(identityInitial);

    // Restoring Element A
    runtime.reconstructElement('elem-aggregate', outcomeA.slice, 1);
    const identityAfterRestore = runtime.computeComposedIdentity();
    expect(identityAfterRestore).toBe(identityInitial);
  });
});
