import { describe, test, expect } from 'vitest';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.js';
import {
  FormaResolutionBroker,
  QUEST_CONSTRAINED_BUDGET,
  DESKTOP_EXPANSIVE_BUDGET,
  type DeviceCapabilityBudgetV1,
  type SemanticObligationContractV1,
} from '../src/moneta/forma/FormaResolutionBroker.js';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.js';
import {
  normalizeEnvelopeToSnapshot,
  type EvidenceReferenceTupleV1,
} from '../src/moneta/representation/SemanticSnapshotV1.js';
import {
  canonicalizeCommittedInvestigationContext,
  type CommittedInvestigationContextV2,
} from '../src/atlas/domain/CommittedInvestigationContext.js';

describe('FormaResolutionBroker (L4-RUNTIME-BUDGET / FM4)', () => {
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
    nodeId: 'inv-ctx-broker-001',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'How do regional volumes distribute across display tiers?',
      variablesOfInterest: ['region', 'count'],
    },
    epistemicPurpose: 'CLAIM_BEARING',
  }) as CommittedInvestigationContextV2;

  const manifest = createKB0Manifest();

  const baseObligations: SemanticObligationContractV1 = {
    mandatoryNodeIds: ['group-north', 'group-south'],
    mandatoryChannels: ['spatial_scatter'],
  };

  test('Exit Requirement 1: multi-tier variant generation preserves analytical snapshot identity', () => {
    const broker = new FormaResolutionBroker();

    const stickmanOutcome = broker.brokerVariant(
      snapshot,
      context,
      manifest,
      QUEST_CONSTRAINED_BUDGET,
      baseObligations,
      1,
    );
    expect(stickmanOutcome.status).toBe('ADMITTED');
    if (stickmanOutcome.status !== 'ADMITTED') return;

    const monaLisaOutcome = broker.brokerVariant(
      snapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET,
      baseObligations,
      1,
    );
    expect(monaLisaOutcome.status).toBe('ADMITTED');
    if (monaLisaOutcome.status !== 'ADMITTED') return;

    expect(stickmanOutcome.variant.variantTier).toBe('STICKMAN_SPARSE');
    expect(monaLisaOutcome.variant.variantTier).toBe('MONA_LISA_EXPANSIVE');

    // Both variants share identical underlying analytical snapshot and context identity
    expect(stickmanOutcome.variant.snapshotId).toBe(snapshot.snapshotId);
    expect(monaLisaOutcome.variant.snapshotId).toBe(snapshot.snapshotId);
    expect(stickmanOutcome.variant.contextId).toBe(context.nodeId);
    expect(monaLisaOutcome.variant.contextId).toBe(context.nodeId);

    // Both preserve mandatory semantic nodes in their reverse explanations
    const stickmanTracedProducers = stickmanOutcome.variant.slice.reverseExplanation.map((t) => t.producerSemanticId);
    const monaLisaTracedProducers = monaLisaOutcome.variant.slice.reverseExplanation.map((t) => t.producerSemanticId);
    expect(stickmanTracedProducers).toContain('group-north');
    expect(stickmanTracedProducers).toContain('group-south');
    expect(monaLisaTracedProducers).toContain('group-north');
    expect(monaLisaTracedProducers).toContain('group-south');
  });

  test('Exit Requirement 2: constrained budget sheds optional channels without mutating mandatory obligations', () => {
    const broker = new FormaResolutionBroker();

    const stickmanOutcome = broker.brokerVariant(
      snapshot,
      context,
      manifest,
      QUEST_CONSTRAINED_BUDGET,
      baseObligations,
      1,
    );
    expect(stickmanOutcome.status).toBe('ADMITTED');
    if (stickmanOutcome.status !== 'ADMITTED') return;

    // Optional channels shed
    expect(stickmanOutcome.variant.shedOptionalChannels).toContain('secondary_voxel_surface');
    expect(stickmanOutcome.variant.shedOptionalChannels).toContain('opacity_modulation');

    // Mandatory elements are strictly constrained to SPHERE with full opacity
    for (const el of stickmanOutcome.variant.slice.elements) {
      expect(el.visualEncoding.shape).toBe('SPHERE');
      expect(el.visualEncoding.opacity).toBe(1.0);
    }
  });

  test('Exit Requirement 3: refuses closed when mandatory channel cannot be satisfied under budget', () => {
    const broker = new FormaResolutionBroker();

    const unachievableObligations: SemanticObligationContractV1 = {
      mandatoryNodeIds: ['group-north'],
      mandatoryChannels: ['spatial_scatter', 'opacity_modulation'],
    };

    // QUEST_CONSTRAINED cannot satisfy 'opacity_modulation'
    const outcome = broker.brokerVariant(
      snapshot,
      context,
      manifest,
      QUEST_CONSTRAINED_BUDGET,
      unachievableObligations,
      1,
    );

    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('MANDATORY_OBLIGATION_UNSATISFIED');
      expect(outcome.refusal.message).toContain('opacity_modulation');
    }
  });

  test('Exit Requirement 4: refuses closed when element count budget is exceeded', () => {
    const broker = new FormaResolutionBroker();

    const tinyBudget: DeviceCapabilityBudgetV1 = {
      profileName: 'TINY_PROFILE',
      maxElements: 1, // Only 1 element allowed, but 2 are required
      maxChannels: 2,
      maxMemoryBytes: 1024,
      allowedShapes: ['SPHERE'],
      allowSecondaryEncodings: false,
    };

    const outcome = broker.brokerVariant(
      snapshot,
      context,
      manifest,
      tinyBudget,
      baseObligations,
      1,
    );

    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('BUDGET_EXCEEDED');
      expect(outcome.refusal.message).toContain('exceeds budget maxElements');
    }
  });

  test('Exit Requirement 5: rejects stale context adoption when context generation has moved', () => {
    const broker = new FormaResolutionBroker();

    // Advance context generation to 2
    const nextGen = broker.advanceContextGeneration(context.nodeId);
    expect(nextGen).toBe(2);
    expect(broker.getContextGeneration(context.nodeId)).toBe(2);

    // Request with stale generation 1
    const outcome = broker.brokerVariant(
      snapshot,
      context,
      manifest,
      QUEST_CONSTRAINED_BUDGET,
      baseObligations,
      1, // Stale!
    );

    expect(outcome.status).toBe('REFUSED');
    if (outcome.status === 'REFUSED') {
      expect(outcome.refusal.code).toBe('STALE_CONTEXT_ADOPTION_REFUSED');
      expect(outcome.refusal.message).toContain('stale');
    }

    // Request with current generation 2 succeeds
    const validOutcome = broker.brokerVariant(
      snapshot,
      context,
      manifest,
      QUEST_CONSTRAINED_BUDGET,
      baseObligations,
      2, // Current!
    );

    expect(validOutcome.status).toBe('ADMITTED');
  });
});
