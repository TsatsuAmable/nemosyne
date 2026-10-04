import { describe, test, expect, vi, afterEach } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import { DESKTOP_EXPANSIVE_BUDGET } from '../src/moneta/forma/FormaResolutionBroker.ts';
import { FormaSystem1Proposer } from '../src/moneta/forma/FormaSystem1Proposer.ts';
import type { FormaProposalSetV1 } from '../src/moneta/forma/FormaSystem1Proposer.ts';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.ts';
import {
  computeSnapshotId,
  computeSourceId,
  normalizeEnvelopeToSnapshot,
  type SemanticSnapshotV1,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.ts';
import type { EvidenceReferenceTupleV1 } from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

/**
 * FM5-R6: System-1 ABSTAIN/OOD fail-closed on the production path.
 *
 * R4 proved recorded-ABSTAIN replay at the engine level. The first, second
 * and fourth tests below prove the same property through the real production
 * entry (AtlasCore.adaptRepresentation): disclosure, no-seed, replay and
 * determinism. The threshold-OOD test calls the proposer directly because
 * the engine pins the default threshold and never forwards one — it proves
 * the proposer abstains rather than fabricating certainty, not production
 * threshold plumbing. It makes no held-out value claim: a negative
 * advice-vs-baseline delta remains valid measurement (see R5).
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function makeDataset(): Dataset {
  const rows = [];
  for (let i = 0; i < 80; i++) {
    rows.push({
      dim1: i * 2.0,
      dim2: (i % 6) * 1.5,
      category: i % 2 === 0 ? 'TypeA' : 'TypeB',
    });
  }
  return new Dataset(
    'fm5-r6-abstain-ds',
    [
      { name: 'dim1', type: ColumnType.NUMERIC },
      { name: 'dim2', type: ColumnType.NUMERIC },
      { name: 'category', type: ColumnType.CATEGORICAL },
    ],
    rows
  );
}

function makeEvidenceRefs(datasetFingerprint: string): EvidenceReferenceTupleV1[] {
  return [
    {
      datasetFingerprint,
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
}

function makeEmptySnapshot(datasetFingerprint: string): SemanticSnapshotV1 {
  const evidenceReferences = makeEvidenceRefs(datasetFingerprint);
  const sourceId = computeSourceId({
    family: 'AGGREGATE',
    analyticalRequestIdentity: 'req-fm5-r6-empty',
    method: 'aggregateVolume',
    methodVersion: '1.0.0',
    parametersDigest: 'sha256-params',
    state: { status: 'AVAILABLE' as const },
    evidenceReferences,
    limitations: [],
  });
  const body = {
    analyticalDatasetFingerprint: datasetFingerprint,
    kernelVersion: '1.0.0',
    semanticVocabulary: { id: 'vocab', version: '1', digest: 'sha256-vocab' },
    normalizer: { id: 'norm', version: '1', digest: 'sha256-norm' },
    coverage: [],
    sources: [
      {
        sourceId,
        family: 'AGGREGATE',
        analyticalRequestIdentity: 'req-fm5-r6-empty',
        method: 'aggregateVolume',
        methodVersion: '1.0.0',
        parametersDigest: 'sha256-params',
        state: { status: 'AVAILABLE' as const },
        evidenceReferences,
        limitations: [],
      },
    ],
    nodes: [],
    relations: [],
    limitations: [],
  };
  return { schemaVersion: 1, snapshotId: computeSnapshotId(body), body };
}

function makeNonEmptyEnvelope(datasetFingerprint: string): {
  envelope: SemanticEmbodimentEnvelopeV1;
  evidenceReferences: EvidenceReferenceTupleV1[];
} {
  return {
    envelope: {
      schemaVersion: 1,
      datasetFingerprint,
      candidateId: 'AGGREGATE_VOLUME',
      representationFamily: 'AGGREGATE',
      analyticalMethod: {
        name: 'aggregateVolume',
        version: '1.0.0',
        parameters: { groupingFields: ['category'], measure: 'COUNT' },
      },
      approximation: { mode: 'EXACT', representedRowCount: 80 },
      informationContract: {
        preserves: ['exact-metric-values'],
        loses: ['individual-observation-identity'],
      },
      resource: { sourceRowCount: 80, elementCount: 2, maxElementCount: 4096 },
      provenance: {
        kernelVersion: '1.0.0',
        algorithmVersion: '1.0.0',
        decisionId: 'decision-fm5-r6',
        decisionModelVersion: 'onnx-v2',
        decisionModelArtifactHash: 'hash-xyz',
      },
      result: {
        status: 'READY',
        payload: {
          kind: 'AGGREGATE_VOLUME',
          data: {
            groupingFields: ['category'],
            measure: { function: 'COUNT' },
            groups: [
              { semanticId: 'group-type-a', key: 'TypeA', count: 40 },
              { semanticId: 'group-type-b', key: 'TypeB', count: 40 },
            ],
          },
        },
      },
    },
    evidenceReferences: makeEvidenceRefs(datasetFingerprint),
  };
}

function setupAtlas(nodeId: string): AtlasCore {
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
  atlas.loadDataset(makeDataset());
  atlas.commitInvestigationContext(nodeId, {
    schemaVersion: 2,
    nodeId,
    intent: {
      schemaVersion: 1,
      researchQuestion: 'How do points cluster?',
      variablesOfInterest: ['dim1', 'dim2'],
      currentTask: 'cluster_analysis',
    },
    epistemicPurpose: 'CLAIM_BEARING',
  });
  return atlas;
}

describe('FM5-R6: ABSTAIN fail-closed on the production path', () => {
  test('empty semantic snapshot abstains without seeding search and discloses as advice-not-evidence', () => {
    const atlas = setupAtlas('node-fm5-r6');
    const snapshot = makeEmptySnapshot(atlas.datasetFingerprint!);

    const result = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 1,
      populationSize: 4,
      snapshot,
    });

    expect(result.system1ProposalSet.status).toBe('ABSTAIN');
    expect(result.system1ProposalSource).toBe('GENERATED');
    expect(result.system1AdviceApplied).toBe(false);
    if (result.system1ProposalSet.status === 'ABSTAIN') {
      expect(result.system1ProposalSet.abstentionReason).toBe(
        'Semantic snapshot contains no renderable nodes'
      );
    }
    // Fail-closed: no advice-seeded lineage anywhere on the frontier.
    for (const c of result.paretoFrontier) {
      expect(c.lineage.operatorApplied ?? '').not.toMatch(/^SYSTEM1_SEED_/);
    }
    // Deterministic path still completes with finite utility.
    expect(Number.isFinite(result.candidate.utility)).toBe(true);
    // Provenance binds the exact ABSTAIN set consumed.
    expect(result.provenance.system1ProposalSetId).toBe(
      result.system1ProposalSet.proposalSetId
    );
    // Disclosure presents ABSTAIN as advice-not-evidence.
    const report = atlas.explainFullMonetaDecision(result, 'BALANCED');
    expect(report).toContain('ABSTAINED');
    expect(report).toContain('without System-1 advice');
  });

  test('recorded ABSTAIN replays on the production path without rerun; stale ABSTAIN refused', () => {
    const atlas = setupAtlas('node-fm5-r6-replay');
    const snapshot = makeEmptySnapshot(atlas.datasetFingerprint!);
    const first = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 1,
      populationSize: 4,
      snapshot,
    });
    expect(first.system1ProposalSet.status).toBe('ABSTAIN');

    const generateSpy = vi.spyOn(FormaSystem1Proposer.prototype, 'generateProposals');
    const replayed = atlas.adaptRepresentation({
      preference: 'BALANCED',
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 1,
      populationSize: 4,
      snapshot,
      recordedSystem1Proposals: first.system1ProposalSet,
    });
    expect(generateSpy).not.toHaveBeenCalled();
    expect(replayed.system1ProposalSet).toEqual(first.system1ProposalSet);
    expect(replayed.system1ProposalSource).toBe('RECORDED');
    expect(replayed.system1AdviceApplied).toBe(false);
    for (const c of replayed.paretoFrontier) {
      expect(c.lineage.operatorApplied ?? '').not.toMatch(/^SYSTEM1_SEED_/);
    }

    const stale = {
      ...first.system1ProposalSet,
      snapshotId: 'sha256-stale-snapshot',
    } as FormaProposalSetV1;
    expect(() =>
      atlas.adaptRepresentation({
        preference: 'BALANCED',
        budget: DESKTOP_EXPANSIVE_BUDGET,
        maxGenerations: 1,
        populationSize: 4,
        snapshot,
        recordedSystem1Proposals: stale,
      })
    ).toThrowError(/snapshot identity mismatch/);
  });

  test('recorded below-seed-floor advice is recorded but not applied on the production path', () => {
    const atlas = setupAtlas('node-fm5-r6-floor');
    const { envelope, evidenceReferences } = makeNonEmptyEnvelope(atlas.datasetFingerprint!);
    const baseOpts = {
      preference: 'BALANCED' as const,
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 1,
      populationSize: 4,
      analyticalEvidence: { envelope, evidenceReferences },
    };
    const first = atlas.adaptRepresentation(baseOpts);
    expect(first.system1ProposalSet.status).toBe('PROPOSED');
    expect(first.system1AdviceApplied).toBe(true);
    if (first.system1ProposalSet.status !== 'PROPOSED') {
      throw new Error('precondition: expected PROPOSED advice on the fresh arm');
    }
    // Floor every recorded score to exactly the seed floor: the set stays
    // PROPOSED, but nothing may enter search seeding.
    const floored: FormaProposalSetV1 = {
      ...first.system1ProposalSet,
      candidates: first.system1ProposalSet.candidates.map((c) => ({ ...c, score: 0.5 })),
    };
    const replayed = atlas.adaptRepresentation({ ...baseOpts, recordedSystem1Proposals: floored });
    expect(replayed.system1ProposalSource).toBe('RECORDED');
    expect(replayed.system1ProposalSet).toEqual(floored);
    expect(replayed.system1AdviceApplied).toBe(false);
    for (const c of replayed.paretoFrontier) {
      expect(c.lineage.operatorApplied ?? '').not.toMatch(/^SYSTEM1_SEED_/);
    }
    const report = atlas.explainFullMonetaDecision(replayed, 'BALANCED');
    expect(report).toContain('below the search seeding floor');
  });

  test('impossible threshold abstains rather than fabricating low-confidence advice', () => {
    const atlas = setupAtlas('node-fm5-r6-threshold');
    const { envelope, evidenceReferences } = makeNonEmptyEnvelope(atlas.datasetFingerprint!);
    const snapshot = normalizeEnvelopeToSnapshot(envelope, evidenceReferences);
    expect(snapshot.body.nodes.length).toBeGreaterThan(0);
    const context = atlas.getActiveInvestigationContext() as unknown as CommittedInvestigationContextV2;
    const manifest = createKB0Manifest();
    const proposer = new FormaSystem1Proposer();

    const baseline = proposer.generateProposals(
      snapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET
    );
    expect(baseline.status).toBe('PROPOSED');

    const abstained = proposer.generateProposals(
      snapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET,
      1.0
    );
    expect(abstained.status).toBe('ABSTAIN');
    if (abstained.status === 'ABSTAIN') {
      expect(abstained.abstentionReason).toContain('confidence threshold');
    }
  });

  test('advice identity is deterministic for identical production inputs', () => {
    const atlas = setupAtlas('node-fm5-r6-determinism');
    const snapshot = makeEmptySnapshot(atlas.datasetFingerprint!);
    const opts = {
      preference: 'BALANCED' as const,
      budget: DESKTOP_EXPANSIVE_BUDGET,
      maxGenerations: 1,
      populationSize: 4,
      snapshot,
    };
    const first = atlas.adaptRepresentation(opts);
    const second = atlas.adaptRepresentation(opts);
    expect(second.system1ProposalSet).toEqual(first.system1ProposalSet);
    expect(second.system1ProposalSet.proposalSetId).toBe(
      first.system1ProposalSet.proposalSetId
    );
  });
});

