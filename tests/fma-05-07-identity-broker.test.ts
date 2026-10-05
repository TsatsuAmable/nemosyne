/**
 * FMA-05 through FMA-07 adversarial verification suite.
 *
 * Verifies:
 * - FMA-07: branchToAlternative atomicity (validation occurs before graph mutation).
 * - FMA-06: Investigation context lineage, historical revisions, and active node restoration on revisit.
 * - FMA-06: Monotonic ledger epoch across reset and dataset fingerprint compatibility check.
 * - FMA-05: FormaResolutionBroker budget integrity (non-positive budget rejection, future generation guard, and content-addressed variant digests).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.js';
import { Dataset, ColumnType } from '../src/data/Dataset.js';
import { makeKernelMockBridge } from './helpers/kernelMock.js';
import {
  CommittedInvestigationContextLedger,
  checkContextCompatibility,
  canonicalizeCommittedInvestigationContext,
  CommittedInvestigationContextV2,
  CONTEXT_INCOMPATIBLE,
} from '../src/atlas/domain/CommittedInvestigationContext.js';
import {
  FormaResolutionBroker,
  DeviceCapabilityBudgetV1,
  SemanticObligationContractV1,
} from '../src/moneta/forma/FormaResolutionBroker.js';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.js';
import {
  normalizeEnvelopeToSnapshot,
  EvidenceReferenceTupleV1,
} from '../src/moneta/representation/SemanticSnapshotV1.js';
import { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.js';

function makeMultiDimensionalDataset(): Dataset {
  const rows = [];
  for (let i = 0; i < 25; i++) {
    rows.push({
      dim1: i * 1.5,
      dim2: (i % 5) * 2.0,
      category: i % 2 === 0 ? 'A' : 'B',
    });
  }
  return new Dataset(
    'multi-dim-ds',
    [
      { name: 'dim1', type: ColumnType.NUMERIC },
      { name: 'dim2', type: ColumnType.NUMERIC },
      { name: 'category', type: ColumnType.CATEGORICAL },
    ],
    rows
  );
}

describe('FMA-07: Atomic Branching and Intent Validation', () => {
  let atlas: AtlasCore;

  beforeEach(() => {
    const bridge = makeKernelMockBridge();
    atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(makeMultiDimensionalDataset());
    atlas.arbitrateRepresentation();
  });

  it('rejects malformed intent before mutating graph or context', () => {
    const stateBefore = atlas.toState();
    const initialNodesCount = stateBefore.investigationGraph?.nodes.length ?? 0;
    const initialEdgesCount = stateBefore.investigationGraph?.edges.length ?? 0;
    const initialActiveNodeId = stateBefore.investigationGraph?.activeNodeId;
    const initialDecision = atlas.activeRepresentationDecision;

    expect(initialDecision).toBeDefined();
    const alternatives = atlas.getRepresentationAlternatives();
    expect(alternatives.length).toBeGreaterThan(0);
    const candidate = alternatives[0];

    // Malformed intent override: unsupported schemaVersion and invalid field
    const malformedIntent: any = {
      schemaVersion: 999,
      invalidField: 'unsupported',
    };

    expect(() => {
      atlas.branchToAlternative(candidate.candidateId, malformedIntent);
    }).toThrow();

    // Assert graph was NOT modified
    const stateAfter = atlas.toState();
    expect(stateAfter.investigationGraph?.nodes.length).toBe(initialNodesCount);
    expect(stateAfter.investigationGraph?.edges.length).toBe(initialEdgesCount);
    expect(stateAfter.investigationGraph?.activeNodeId).toBe(initialActiveNodeId);
    expect(atlas.activeRepresentationDecision).toBe(initialDecision);
  });
});

describe('FMA-06: Context Lineage and Active Node Restoration', () => {
  let atlas: AtlasCore;

  beforeEach(() => {
    const bridge = makeKernelMockBridge();
    atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(makeMultiDimensionalDataset());
    atlas.arbitrateRepresentation();
  });

  it('restores parent lineage when branching from a revisited historical node', () => {
    const state0 = atlas.toState();
    const rootNodeId = state0.investigationGraph?.activeNodeId;
    expect(rootNodeId).toBeDefined();

    const alternatives = atlas.getRepresentationAlternatives();
    expect(alternatives.length).toBeGreaterThan(0);
    const targetCandidate = alternatives[0];

    // Branch A -> B
    const nodeB = atlas.branchToAlternative(targetCandidate.candidateId);
    const nodeBId = nodeB.id;
    const state1 = atlas.toState();
    expect(state1.investigationGraph?.activeNodeId).toBe(nodeBId);

    // Verify edge connects root -> B
    const edgeToB = state1.investigationGraph?.edges.find((e) => e.target === nodeBId);
    expect(edgeToB?.source).toBe(rootNodeId);

    // Revisit root node A
    atlas.activateInvestigationContext(rootNodeId!);
    const stateRevisit = atlas.toState();
    expect(stateRevisit.investigationGraph?.activeNodeId).toBe(rootNodeId);

    // After reactivating root A, arbitrate/get alternatives for A and branch to another candidate
    const alternativesFromA = atlas.getRepresentationAlternatives();
    const altCandidateForC =
      alternativesFromA.find((a) => a.candidateId !== targetCandidate.candidateId) ??
      alternativesFromA[0];

    const nodeC = atlas.branchToAlternative(altCandidateForC.candidateId);
    const nodeCId = nodeC.id;
    const state2 = atlas.toState();
    expect(nodeCId).not.toBe(rootNodeId);
    expect(nodeCId).not.toBe(nodeBId);

    // FMA-06 requirement: C's parent edge MUST be rootNodeId (A), NOT nodeBId!
    const edgeToC = state2.investigationGraph?.edges.find((e) => e.target === nodeCId);
    expect(edgeToC?.source).toBe(rootNodeId);
  });

  it('CommittedInvestigationContextLedger preserves epoch monotonically across resets', () => {
    const ledger = new CommittedInvestigationContextLedger();
    const ctx: CommittedInvestigationContextV2 = {
      schemaVersion: 2,
      nodeId: 'node_epoch_1',
      investigationId: 'inv_1',
      datasetFingerprint: 'fp_1',
      committedRevision: 1,
      runtimeGeneration: 1,
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Testing monotonic epoch',
        variablesOfInterest: ['metric'],
      },
    };

    ledger.commit('node_epoch_1', ctx);
    ledger.activate('node_epoch_1');
    const epochBeforeReset = ledger.activationEpoch;
    expect(epochBeforeReset).toBeGreaterThan(0);

    ledger.reset();
    expect(ledger.activationEpoch).toBeGreaterThanOrEqual(epochBeforeReset);
  });

  it('checkContextCompatibility enforces dataset fingerprint and investigation matching', () => {
    const ledger = new CommittedInvestigationContextLedger();
    const baseContext: CommittedInvestigationContextV2 = {
      schemaVersion: 2,
      nodeId: 'node_1',
      investigationId: 'inv_base',
      datasetFingerprint: 'fp_base',
      committedRevision: 1,
      runtimeGeneration: 1,
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Base research question',
        variablesOfInterest: ['x'],
      },
    };

    const activation = ledger.commit('node_1', baseContext);
    const capturedBinding = {
      contextId: activation.contextId,
      nodeId: activation.nodeId,
      activationEpoch: activation.activationEpoch,
      investigationId: 'inv_base',
      datasetFingerprint: 'fp_base',
      runtimeGeneration: 1,
    };

    const mismatchFpBinding = {
      ...capturedBinding,
      datasetFingerprint: 'fp_divergent',
    };

    const resultMismatch = checkContextCompatibility(mismatchFpBinding, activation);
    expect(resultMismatch.ok).toBe(false);

    const resultMatch = checkContextCompatibility(capturedBinding, activation);
    expect(resultMatch.ok).toBe(true);
  });

  it('checkContextCompatibility refuses identity dimensions present on only one side', () => {
    const ledger = new CommittedInvestigationContextLedger();
    const fullContext: CommittedInvestigationContextV2 = {
      schemaVersion: 2,
      nodeId: 'node_dim',
      investigationId: 'inv_dim',
      datasetFingerprint: 'fp_dim',
      scopeId: 'scope_dim',
      committedRevision: 1,
      runtimeGeneration: 7,
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Dimension asymmetry probe',
        variablesOfInterest: ['x'],
      },
    };
    const activation = ledger.commit('node_dim', fullContext);
    const ids = {
      contextId: activation.contextId,
      nodeId: activation.nodeId,
      activationEpoch: activation.activationEpoch,
    };

    // Each dimension omitted from the captured binding while present on the
    // active context must refuse: omission is not a wildcard.
    const omitCases = [
      { name: 'investigationId', binding: { ...ids, datasetFingerprint: 'fp_dim', scopeId: 'scope_dim', runtimeGeneration: 7 } },
      { name: 'datasetFingerprint', binding: { ...ids, investigationId: 'inv_dim', scopeId: 'scope_dim', runtimeGeneration: 7 } },
      { name: 'scopeId', binding: { ...ids, investigationId: 'inv_dim', datasetFingerprint: 'fp_dim', runtimeGeneration: 7 } },
      { name: 'runtimeGeneration', binding: { ...ids, investigationId: 'inv_dim', datasetFingerprint: 'fp_dim', scopeId: 'scope_dim' } },
    ];
    for (const { name, binding } of omitCases) {
      const result = checkContextCompatibility(binding, activation);
      expect(`${name}: ${result.ok}`).toBe(`${name}: false`);
      if (!result.ok) {
        expect(result.code).toBe(CONTEXT_INCOMPATIBLE);
        expect(result.reason).toMatch(/present on only one side/);
      }
    }

    // Each dimension smuggled into the captured binding while absent from the
    // active context must refuse as well.
    const minimalLedger = new CommittedInvestigationContextLedger();
    const minimalActivation = minimalLedger.commit('node_min', {
      schemaVersion: 2,
      nodeId: 'node_min',
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Minimal legacy context',
        variablesOfInterest: ['x'],
      },
    });
    const minimalIds = {
      contextId: minimalActivation.contextId,
      nodeId: minimalActivation.nodeId,
      activationEpoch: minimalActivation.activationEpoch,
    };
    const extraCases = [
      { name: 'investigationId', binding: { ...minimalIds, investigationId: 'inv_dim' } },
      { name: 'datasetFingerprint', binding: { ...minimalIds, datasetFingerprint: 'fp_dim' } },
      { name: 'scopeId', binding: { ...minimalIds, scopeId: 'scope_dim' } },
      { name: 'runtimeGeneration', binding: { ...minimalIds, runtimeGeneration: 7 } },
    ];
    for (const { name, binding } of extraCases) {
      const result = checkContextCompatibility(binding, minimalActivation);
      expect(`${name}: ${result.ok}`).toBe(`${name}: false`);
      if (!result.ok) {
        expect(result.code).toBe(CONTEXT_INCOMPATIBLE);
        expect(result.reason).toMatch(/present on only one side/);
      }
    }

    // Absent on both sides stays adoptable for legacy contexts.
    expect(checkContextCompatibility({ ...minimalIds }, minimalActivation).ok).toBe(true);
  });
});

describe('FMA-05: FormaResolutionBroker Budget Integrity & Content-Addressed Hashes', () => {
  const dummyEvidence: EvidenceReferenceTupleV1[] = [
    {
      datasetFingerprint: 'sha256-dataset-fma05',
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
    datasetFingerprint: 'sha256-dataset-fma05',
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
      decisionId: 'decision-fma05',
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
    nodeId: 'inv-ctx-fma05',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'How do regional volumes distribute across display tiers?',
      variablesOfInterest: ['region', 'count'],
    },
    epistemicPurpose: 'CLAIM_BEARING',
  }) as CommittedInvestigationContextV2;

  const manifest = createKB0Manifest();
  const obligations: SemanticObligationContractV1 = {
    mandatoryNodeIds: ['group-north', 'group-south'],
    mandatoryChannels: ['spatial_scatter'],
  };

  it('rejects invalid or non-positive device budgets with INVALID_BUDGET', () => {
    const broker = new FormaResolutionBroker();
    const invalidBudget: DeviceCapabilityBudgetV1 = {
      profileName: 'zero_budget',
      maxElements: 100,
      maxMemoryBytes: 0, // Invalid: non-positive memory limit
      maxChannels: 4,
      allowedShapes: ['SPHERE'],
      allowSecondaryEncodings: true,
    };

    const outcome = broker.brokerVariant(snapshot, context, manifest, invalidBudget, obligations, 1);
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('INVALID_BUDGET');
    }
  });

  it('rejects future context generations with STALE_CONTEXT_ADOPTION_REFUSED', () => {
    const broker = new FormaResolutionBroker();
    const validBudget: DeviceCapabilityBudgetV1 = {
      profileName: 'desktop_budget',
      maxElements: 100,
      maxMemoryBytes: 1024 * 1024,
      maxChannels: 4,
      allowedShapes: ['SPHERE'],
      allowSecondaryEncodings: true,
    };

    // Broker has active generation 1; requested is future generation 999
    const outcome = broker.brokerVariant(snapshot, context, manifest, validBudget, obligations, 999);
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('STALE_CONTEXT_ADOPTION_REFUSED');
    }
  });

  it('produces distinct content-addressed variantId and sliceId when visual encoding shapes differ', () => {
    const broker = new FormaResolutionBroker();
    const sphereBudget: DeviceCapabilityBudgetV1 = {
      profileName: 'sphere_profile',
      maxElements: 100,
      maxMemoryBytes: 1024 * 1024,
      maxChannels: 4,
      allowedShapes: ['SPHERE'],
      allowSecondaryEncodings: true,
    };

    const voxelBudget: DeviceCapabilityBudgetV1 = {
      profileName: 'voxel_profile',
      maxElements: 100,
      maxMemoryBytes: 1024 * 1024,
      maxChannels: 4,
      allowedShapes: ['VOXEL'], // Maps shapes to VOXEL
      allowSecondaryEncodings: true,
    };

    const outcomeSphere = broker.brokerVariant(snapshot, context, manifest, sphereBudget, obligations, 1);
    const outcomeVoxel = broker.brokerVariant(snapshot, context, manifest, voxelBudget, obligations, 1);

    expect(outcomeSphere.status).toBe('ADMITTED');
    expect(outcomeVoxel.status).toBe('ADMITTED');

    if (outcomeSphere.status === 'ADMITTED' && outcomeVoxel.status === 'ADMITTED') {
      // Elements must have adapted shapes
      expect(outcomeSphere.variant.slice.elements[0].visualEncoding.shape).toBe('SPHERE');
      expect(outcomeVoxel.variant.slice.elements[0].visualEncoding.shape).toBe('VOXEL');

      // Digests and IDs must differ
      expect(outcomeSphere.variant.variantId).not.toBe(outcomeVoxel.variant.variantId);
      expect(outcomeSphere.variant.slice.sliceId).not.toBe(outcomeVoxel.variant.slice.sliceId);
    }
  });
});
