import { describe, test, expect } from 'vitest';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.js';
import {
  FormaSystem1Proposer,
} from '../src/moneta/forma/FormaSystem1Proposer.js';
import {
  QUEST_CONSTRAINED_BUDGET,
  DESKTOP_EXPANSIVE_BUDGET,
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

describe('FormaSystem1Proposer (L3-S1-FORMA / FM5)', () => {
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
    nodeId: 'inv-ctx-s1-001',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'How does regional distribution shape candidate metaphors?',
      variablesOfInterest: ['region', 'count'],
    },
    epistemicPurpose: 'CLAIM_BEARING',
  }) as CommittedInvestigationContextV2;

  const manifest = createKB0Manifest();

  test('Exit Requirement 1: produces bounded FormaProposalSetV1 with transparent linear scoring', () => {
    const proposer = new FormaSystem1Proposer();
    const outcome = proposer.generateProposals(
      snapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET,
      0.5,
    );

    expect(outcome.status).toBe('PROPOSED');
    if (outcome.status !== 'PROPOSED') return;

    expect(outcome.candidates.length).toBeGreaterThan(0);
    expect(outcome.candidates[0].score).toBeGreaterThanOrEqual(0.5);
    expect(outcome.searchHints.length).toBeGreaterThan(0);

    // Sorted descending by score
    for (let i = 0; i < outcome.candidates.length - 1; i++) {
      expect(outcome.candidates[i].score).toBeGreaterThanOrEqual(outcome.candidates[i + 1].score);
    }
  });

  test('Exit Requirement 2: constrained budget biases proposals toward sparse stickman tier', () => {
    const proposer = new FormaSystem1Proposer();
    const outcome = proposer.generateProposals(
      snapshot,
      context,
      manifest,
      QUEST_CONSTRAINED_BUDGET,
      0.5,
    );

    expect(outcome.status).toBe('PROPOSED');
    if (outcome.status !== 'PROPOSED') return;

    expect(outcome.candidates[0].targetResolutionTier).toBe('STICKMAN_SPARSE');
    expect(outcome.searchHints).toContain('SUPPRESS_SECONDARY_CHANNELS');
  });

  test('Exit Requirement 3: returns ABSTAIN when confidence falls below required threshold', () => {
    const proposer = new FormaSystem1Proposer();
    const outcome = proposer.generateProposals(
      snapshot,
      context,
      manifest,
      QUEST_CONSTRAINED_BUDGET,
      0.99, // Unachievably high threshold
    );

    expect(outcome.status).toBe('ABSTAIN');
    if (outcome.status === 'ABSTAIN') {
      expect(outcome.abstentionReason).toContain('below confidence threshold');
    }
  });

  test('Exit Requirement 4: returns ABSTAIN when semantic snapshot contains no nodes', () => {
    const proposer = new FormaSystem1Proposer();
    const emptySnapshot = {
      ...snapshot,
      body: {
        ...snapshot.body,
        nodes: [],
      },
    };

    const outcome = proposer.generateProposals(
      emptySnapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET,
      0.5,
    );

    expect(outcome.status).toBe('ABSTAIN');
    if (outcome.status === 'ABSTAIN') {
      expect(outcome.abstentionReason).toContain('contains no renderable nodes');
    }
  });

  test('Exit Requirement 5: ranking and proposal set IDs are strictly deterministic', () => {
    const proposerA = new FormaSystem1Proposer();
    const proposerB = new FormaSystem1Proposer();

    const outcomeA = proposerA.generateProposals(
      snapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET,
      0.5,
    );

    const outcomeB = proposerB.generateProposals(
      snapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET,
      0.5,
    );

    expect(outcomeA.proposalSetId).toBe(outcomeB.proposalSetId);
    expect(outcomeA).toEqual(outcomeB);
  });
});
