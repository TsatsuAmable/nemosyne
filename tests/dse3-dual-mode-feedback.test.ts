import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  compileDirectEmbodimentPlan,
  recordInvestigatorCritique,
  type DirectEmbodimentCompileResult,
} from '../src/moneta/representation/DirectEmbodimentCompiler.ts';
import {
  DirectTraversalSession,
  type DirectTraversalPort,
  type EstablishedDetailAuthorityV1,
} from '../src/moneta/representation/DirectTraversalSession.ts';
import {
  bindAlternativeFeedback,
  discloseConjecturalElements,
  resolveCritiqueToAlternative,
} from '../src/moneta/representation/DirectFeedbackLoop.ts';
import {
  type SemanticSnapshotV1,
  SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
  computeSnapshotId,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import {
  SEMANTIC_DETAIL_SCHEMA_VERSION,
  type SemanticDetailEnvelopeV1,
  type SemanticDetailRequestV1,
} from '../src/moneta/representation/SemanticDrillDown.ts';
import {
  DESKTOP_EXPANSIVE_BUDGET,
  QUEST_CONSTRAINED_BUDGET,
} from '../src/moneta/forma/FormaResolutionBroker.ts';
import {
  createConjecturalProposal,
  type ConjecturalProposalV1,
} from '../src/moneta/forma/ConjecturalProposal.ts';
import { computeCommittedContextIdentity } from '../src/atlas/domain/CommittedInvestigationContext.ts';
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.ts';

const FP = 'd5e3f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3';

function createMockEvidenceReferences(datasetFingerprint: string) {
  return [
    {
      datasetFingerprint,
      kernelVersion: '1.0.0-rust-wasm',
      bundleContentDigest: 'digest-bundle-rust-wasm-001',
      receiptId: 'receipt-rust-evidence-001',
      receiptContentDigest: 'digest-receipt-001',
      consumerId: 'nemosyne-representation-compiler',
      requirementProfileId: 'profile-governed-analytical-001',
      requirementProfileDigest: 'digest-profile-001',
      admissionPolicyId: 'policy-dual-epistemic-001',
      admissionPolicyDigest: 'digest-policy-001',
    },
  ];
}

function createDistributionSnapshot(datasetFingerprint: string): SemanticSnapshotV1 {
  const body = {
    analyticalDatasetFingerprint: datasetFingerprint,
    kernelVersion: '1.0.0-rust-wasm',
    semanticVocabulary: {
      id: 'vocab-statistical-density',
      version: '1.0.0',
      digest: 'digest-vocab-001',
    },
    normalizer: { id: 'normalizer-density-1d', version: '1.0.0', digest: 'digest-norm-001' },
    coverage: [
      {
        family: 'DISTRIBUTION',
        analyticalRequestDigest: 'digest-req-dist-001',
        status: 'AVAILABLE' as const,
      },
    ],
    sources: [
      {
        sourceId: 'src-density-1d',
        family: 'DISTRIBUTION',
        analyticalRequestIdentity: 'req-kde-density-1d',
        method: 'kernel_density_estimation_1d',
        methodVersion: '1.0.0',
        parametersDigest: 'digest-params-001',
        state: {
          status: 'AVAILABLE' as const,
          approximation: {
            mode: 'EXACT_AGGREGATE',
            representedRowCount: 1200,
            description: '1D continuous density',
          },
        },
        evidenceReferences: createMockEvidenceReferences(datasetFingerprint),
        limitations: [],
      },
    ],
    nodes: Array.from({ length: 20 }, (_, idx) => ({
      nodeId: `node-density-bin-${String(idx).padStart(2, '0')}`,
      sourceId: 'src-density-1d',
      producerSemanticId: 'density_estimator',
      propertyPath: `bins.${idx}.density`,
      descriptor: {
        label: `Density Bin ${idx}`,
        valueType: 'number' as const,
        unit: 'probability_density',
        frame: 'statistical_distribution',
      },
      value: 0.05 + 0.9 * Math.exp(-Math.pow((idx - 10) / 3, 2)),
      state: { status: 'AVAILABLE' as const },
    })),
    relations: [],
    limitations: [],
  };

  return {
    schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: computeSnapshotId(body),
    body,
  };
}

function createGroundedContext(): CommittedInvestigationContextV2 {
  return {
    schemaVersion: 2,
    nodeId: 'ctx-dse3-grounded-001',
    epistemicPurpose: 'CLAIM_BEARING',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Confirm grounded density profile',
      currentTask: 'distribution_envelope',
    },
  };
}

function createExploratoryContext(): CommittedInvestigationContextV2 {
  return {
    schemaVersion: 2,
    nodeId: 'ctx-dse3-exploratory-001',
    epistemicPurpose: 'EXPLORATORY_ABDUCTION',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Explore conjectural density hypotheses',
      currentTask: 'hypothesis_exploration',
    },
  };
}

function createHypothesisProposal(
  snapshotId: string,
  contextId: string,
  boundNodeId = 'node-density-bin-00'
): ConjecturalProposalV1 {
  return createConjecturalProposal({
    snapshotId,
    contextId,
    generator: {
      modelId: 'AbductiveHypothesisModel',
      modelVersion: '1.0.0',
      executionRegime: 'ADAPTIVE',
    },
    elements: [
      {
        elementId: boundNodeId,
        kind: 'SPECULATIVE_SURFACE',
        epistemicStatus: 'HYPOTHESIZED',
        properties: {},
        uncertaintyDisclosure: 'Unverified abductive hypothesis',
      },
    ],
    relations: [],
    assumptions: ['Smooth prior over bins'],
    uncertaintyDisclosure: 'Explicitly labeled conjectural exploration',
    rationale: 'Abductive hypothesis generation',
  });
}

function compileExploratory(fingerprint = FP): {
  compilation: DirectEmbodimentCompileResult;
  proposal: ConjecturalProposalV1;
} {
  const snapshot = createDistributionSnapshot(fingerprint);
  const context = createExploratoryContext();
  const proposal = createHypothesisProposal(
    snapshot.snapshotId,
    computeCommittedContextIdentity(context)
  );
  const compilation = compileDirectEmbodimentPlan({
    datasetFingerprint: fingerprint,
    snapshot,
    context,
    budget: DESKTOP_EXPANSIVE_BUDGET,
    admissionOptions: {
      conjecturalProposals: [proposal],
      bindings: [
        {
          kind: 'CONJECTURAL',
          proposalId: proposal.proposalId,
          elementId: 'node-density-bin-00',
          propertyPath: 'bins.0.density',
          status: 'HYPOTHESIZED',
        },
      ],
    },
  });
  return { compilation, proposal };
}

function distributionAuthority(fingerprint: string): EstablishedDetailAuthorityV1 {
  return {
    datasetFingerprint: fingerprint,
    representationFamily: 'DISTRIBUTION',
    decisionId: 'decision-distribution-dse3',
    generation: 7,
    datasetVersion: 3,
  };
}

function fakePort(): DirectTraversalPort {
  const members = ['obs-0', 'obs-1', 'obs-2', 'obs-3'];
  // Cast: the fake always serves detail envelopes; the generic parameter only
  // exists so production ports satisfy the same structural interface.
  const execute = (async (req: {
    readonly dataset: { readonly fingerprint: string };
    readonly params: { readonly request: SemanticDetailRequestV1 };
  }) => {
      const request = req.params.request as SemanticDetailRequestV1;
      const page =
        request.limit === 1
          ? [members[request.offset] ?? '']
          : members.slice(request.offset, request.offset + request.limit);
      const value: SemanticDetailEnvelopeV1 = {
        schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
        generation: 7,
        request: { ...request, target: { ...request.target } },
        result: {
          status: 'READY',
          totalMemberCount: members.length,
          returnedCount: page.length,
          observationIds: [...page],
          compactViews: page.map((id, i) => ({ id, ordinal: request.offset + i })),
        },
      };
      return {
        generation: 7,
        datasetVersion: 3,
        datasetFingerprint: req.dataset.fingerprint,
        value,
      };
    }) as DirectTraversalPort['execute'];
  return {
    isAsync: true,
    hasRegisteredDataset: () => true,
    execute,
  };
}

describe('DSE3: visible conjectural disclosure', () => {
  it('joins conjectural plan elements to their admitted proposal and generator', () => {
    const { compilation, proposal } = compileExploratory();
    const conjectural = compilation.plan.elements.filter((e) => e.parameters.isConjectural);
    expect(conjectural.length).toBeGreaterThan(0);

    const result = discloseConjecturalElements(compilation, [proposal], 'EXPLORATORY_ABDUCTION');
    expect(result.disclosures).toHaveLength(conjectural.length);
    for (const disclosure of result.disclosures) {
      expect(disclosure.proposalId).toBe(proposal.proposalId);
      expect(disclosure.generatorModelId).toBe('AbductiveHypothesisModel');
      expect(disclosure.epistemicStatuses).toContain('HYPOTHESIZED');
      expect(disclosure.uncertaintyDisclosure).toBe('Explicitly labeled conjectural exploration');
      expect(disclosure.admittedUnder).toBe('EXPLORATORY_ABDUCTION');
    }

    const again = discloseConjecturalElements(compilation, [proposal], 'EXPLORATORY_ABDUCTION');
    expect(again.disclosures.map((d) => d.disclosureId)).toEqual(
      result.disclosures.map((d) => d.disclosureId)
    );
  });

  it('grounded-only compilation discloses nothing', () => {
    const compilation = compileDirectEmbodimentPlan({
      datasetFingerprint: FP,
      snapshot: createDistributionSnapshot(FP),
      context: createGroundedContext(),
      budget: DESKTOP_EXPANSIVE_BUDGET,
    });
    const result = discloseConjecturalElements(compilation, [], 'CLAIM_BEARING');
    expect(result.disclosures).toHaveLength(0);
    expect(result.groundedElementCount).toBe(compilation.plan.elements.length);
  });

  it('refuses proposals admitted against a different snapshot and unbound elements', () => {
    const { compilation, proposal } = compileExploratory();
    const other = createHypothesisProposal(
      'snapshot-other',
      computeCommittedContextIdentity(createExploratoryContext())
    );
    expect(() =>
      discloseConjecturalElements(compilation, [other], 'EXPLORATORY_ABDUCTION')
    ).toThrow('different snapshot');

    const sibling = createHypothesisProposal(
      compilation.plan.semanticGraphId,
      computeCommittedContextIdentity(createExploratoryContext()),
      'node-density-bin-01'
    );
    expect(sibling.proposalId).not.toBe(proposal.proposalId);
    expect(() =>
      discloseConjecturalElements(compilation, [sibling], 'EXPLORATORY_ABDUCTION')
    ).toThrow('Unbound conjectural element');
  });
});

describe('DSE3: dual-mode purpose enforcement in traversal', () => {
  it('conjectural targets require explicit EXPLORATORY_ABDUCTION; omission fails closed', () => {
    const { compilation } = compileExploratory();
    const conjectural = compilation.plan.elements.find((e) => e.parameters.isConjectural);
    const grounded = compilation.plan.elements.find((e) => !e.parameters.isConjectural);
    if (!conjectural || !grounded) throw new Error('setup failed: mixed plan required');

    const refusedDefault = DirectTraversalSession.open(
      compilation,
      conjectural.id,
      'DISTRIBUTION',
      distributionAuthority(FP)
    );
    expect(refusedDefault.status).toBe('REFUSED');
    if (refusedDefault.status === 'REFUSED') {
      expect(refusedDefault.code).toBe('CONJECTURAL_PURPOSE_REFUSAL');
    }

    const refusedClaim = DirectTraversalSession.open(
      compilation,
      conjectural.id,
      'DISTRIBUTION',
      distributionAuthority(FP),
      {
        epistemicPurpose: 'CLAIM_BEARING',
      }
    );
    expect(refusedClaim.status).toBe('REFUSED');

    const allowed = DirectTraversalSession.open(
      compilation,
      conjectural.id,
      'DISTRIBUTION',
      distributionAuthority(FP),
      {
        epistemicPurpose: 'EXPLORATORY_ABDUCTION',
      }
    );
    expect(allowed.status).toBe('READY');
    if (allowed.status === 'READY') {
      expect(allowed.value.binding.isConjectural).toBe(true);
      expect(allowed.value.binding.epistemicPurpose).toBe('EXPLORATORY_ABDUCTION');
    }

    const groundedDefault = DirectTraversalSession.open(
      compilation,
      grounded.id,
      'DISTRIBUTION',
      distributionAuthority(FP)
    );
    expect(groundedDefault.status).toBe('READY');
  });

  it('conjectural observation inspection stays purpose-gated', async () => {
    const { compilation } = compileExploratory();
    const conjectural = compilation.plan.elements.find((e) => e.parameters.isConjectural);
    if (!conjectural) throw new Error('setup failed: conjectural element required');
    const port = fakePort();

    const session = DirectTraversalSession.open(
      compilation,
      conjectural.id,
      'DISTRIBUTION',
      distributionAuthority(FP),
      {
        epistemicPurpose: 'EXPLORATORY_ABDUCTION',
      }
    );
    if (session.status !== 'READY') throw new Error('setup failed');
    const page = await session.value.requestSubsetPage(port, 4, 0);
    expect(page.status).toBe('READY');

    const inspected = await session.value.inspectObservation(port, 'obs-1');
    expect(inspected.status).toBe('READY');
    if (inspected.status === 'READY') {
      expect(inspected.value.isConjectural).toBe(true);
      expect(inspected.value.lineage.isConjectural).toBe(true);
    }
  });
});

describe('DSE3: critique to Road Not Taken alternative', () => {
  function compileWithCritique(fingerprint = FP): {
    compilation: DirectEmbodimentCompileResult;
    critiqueId: string;
    snapshot: SemanticSnapshotV1;
    context: CommittedInvestigationContextV2;
  } {
    const snapshot = createDistributionSnapshot(fingerprint);
    const context = createGroundedContext();
    const first = compileDirectEmbodimentPlan({
      datasetFingerprint: fingerprint,
      snapshot,
      context,
      budget: DESKTOP_EXPANSIVE_BUDGET,
    });
    const critique = recordInvestigatorCritique({
      investigatorId: 'investigator-dse3-001',
      targetElementId: first.plan.elements[0]?.id ?? '',
      targetPhenomenon: 'DISTRIBUTION',
      critiqueKind: 'DENSITY_RESOLUTION',
      note: 'Quest budget may lose low-density bins; try constrained variant as alternative',
      contextId: context.nodeId,
    });
    const compilation = compileDirectEmbodimentPlan({
      datasetFingerprint: fingerprint,
      snapshot,
      context,
      budget: DESKTOP_EXPANSIVE_BUDGET,
      critiqueFeedback: [critique],
    });
    return { compilation, critiqueId: critique.critiqueId, snapshot, context };
  }

  it('resolves a ledger critique to a linked, differing alternative', () => {
    const { compilation, critiqueId, snapshot, context } = compileWithCritique();
    const first = resolveCritiqueToAlternative({
      datasetFingerprint: FP,
      snapshot,
      context,
      compilation,
      critiqueId,
      adjustment: { budget: QUEST_CONSTRAINED_BUDGET },
    });

    expect(first.alternative.plan.planId).not.toBe(compilation.plan.planId);
    expect(first.link).toMatchObject({
      critiqueId,
      priorCompilationId: compilation.compilationId,
      priorDecisionId: compilation.plan.decisionId,
      alternativeCompilationId: first.alternative.compilationId,
      targetElementId: compilation.plan.elements[0]?.id,
      contextPurpose: 'CLAIM_BEARING',
    });

    const second = resolveCritiqueToAlternative({
      datasetFingerprint: FP,
      snapshot,
      context,
      compilation,
      critiqueId,
      adjustment: { budget: QUEST_CONSTRAINED_BUDGET },
    });
    expect(second.link.linkId).toBe(first.link.linkId);
  });

  it('refuses unknown critiques, mistargeted critiques, and vacuous adjustments', () => {
    const { compilation, snapshot, context } = compileWithCritique();

    expect(() =>
      resolveCritiqueToAlternative({
        datasetFingerprint: FP,
        snapshot,
        context,
        compilation,
        critiqueId: 'critique-unknown',
        adjustment: { budget: QUEST_CONSTRAINED_BUDGET },
      })
    ).toThrow('Unknown critique');

    const mistargeted = recordInvestigatorCritique({
      investigatorId: 'investigator-dse3-001',
      targetElementId: 'no-such-element',
      targetPhenomenon: 'DISTRIBUTION',
      critiqueKind: 'CUSTOM',
      note: 'points nowhere',
      contextId: context.nodeId,
    });
    const recompiled = compileDirectEmbodimentPlan({
      datasetFingerprint: FP,
      snapshot,
      context,
      budget: DESKTOP_EXPANSIVE_BUDGET,
      critiqueFeedback: [mistargeted],
    });
    expect(() =>
      resolveCritiqueToAlternative({
        datasetFingerprint: FP,
        snapshot,
        context,
        compilation: recompiled,
        critiqueId: mistargeted.critiqueId,
        adjustment: { budget: QUEST_CONSTRAINED_BUDGET },
      })
    ).toThrow('not an element');

    const { compilation: plain, critiqueId } = compileWithCritique();
    expect(() =>
      resolveCritiqueToAlternative({
        datasetFingerprint: FP,
        snapshot,
        context,
        compilation: plain,
        critiqueId,
      })
    ).toThrow('must differ');
  });

  it('feedback binding requires a link and a record id', () => {
    const { compilation, critiqueId, snapshot, context } = compileWithCritique();
    const { link } = resolveCritiqueToAlternative({
      datasetFingerprint: FP,
      snapshot,
      context,
      compilation,
      critiqueId,
      adjustment: { budget: QUEST_CONSTRAINED_BUDGET },
    });
    const binding = bindAlternativeFeedback(link, 'critique-v1:abc123');
    expect(binding.linkId).toBe(link.linkId);
    expect(binding.critiqueRecordId).toBe('critique-v1:abc123');
    expect(() => bindAlternativeFeedback(link, '  ')).toThrow();
  });
});

describe('DSE3: production entry point via AtlasCore', () => {
  function buildAtlas(purpose: 'CLAIM_BEARING' | 'EXPLORATORY_ABDUCTION'): AtlasCore {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      val: i * 1.5,
      group: i % 2 === 0 ? 'A' : 'B',
    }));
    const ds = new Dataset(
      'dse3-e2e-dataset',
      [
        { name: 'val', type: ColumnType.NUMERIC },
        { name: 'group', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge as any });
    atlas.loadDataset(ds);
    atlas.commitInvestigationContext('ctx-dse3-e2e-001', {
      schemaVersion: 2,
      nodeId: 'ctx-dse3-e2e-001',
      epistemicPurpose: purpose,
      intent: {
        schemaVersion: 1,
        researchQuestion: 'DSE3 end-to-end verification',
        currentTask: 'dual_mode_feedback',
      },
    });
    return atlas;
  }

  it('runs the full loop: compile, disclose, traverse, alternative, feedback', async () => {
    const atlas = buildAtlas('EXPLORATORY_ABDUCTION');
    const fingerprint = atlas.dataset.fingerprint;
    const snapshot = createDistributionSnapshot(fingerprint);

    const compilation = atlas.compileDirectEmbodiment({ snapshot });
    expect(atlas.getActiveDirectCompileResult()).toBe(compilation);

    const proposal = createHypothesisProposal(
      snapshot.snapshotId,
      computeCommittedContextIdentity({
        schemaVersion: 2,
        nodeId: 'ctx-dse3-e2e-001',
        epistemicPurpose: 'EXPLORATORY_ABDUCTION',
        intent: { schemaVersion: 1, researchQuestion: 'x', currentTask: 'y' },
      })
    );
    const disclosure = atlas.discloseDirectConjectural([proposal]);
    expect(disclosure.groundedElementCount).toBe(compilation.plan.elements.length);

    const elementId = compilation.plan.elements[0]?.id ?? '';
    const session = atlas.openDirectTraversal(elementId, 'DISTRIBUTION', {
      datasetFingerprint: fingerprint,
      representationFamily: 'DISTRIBUTION',
      decisionId: 'decision-distribution-e2e',
      generation: 7,
      datasetVersion: 3,
    });
    expect(session.binding.epistemicPurpose).toBe('EXPLORATORY_ABDUCTION');

    const critique = recordInvestigatorCritique({
      investigatorId: 'investigator-e2e-001',
      targetElementId: elementId,
      targetPhenomenon: 'DISTRIBUTION',
      critiqueKind: 'SPATIAL_SCALE',
      note: 'overview too coarse; resolve constrained alternative',
      contextId: 'ctx-dse3-e2e-001',
    });
    const recompiled = atlas.compileDirectEmbodiment({ snapshot, critiqueFeedback: [critique] });
    expect(recompiled.critiqueLedger).toHaveLength(1);

    const { alternative, link } = atlas.resolveDirectAlternativeFromCritique(critique.critiqueId, {
      budget: QUEST_CONSTRAINED_BUDGET,
    });
    expect(alternative.plan.planId).not.toBe(recompiled.plan.planId);
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(1);
    expect(atlas.getActiveDirectCompileResult()).toBe(recompiled);

    const feedback = atlas.recordDirectAlternativeFeedback(link.linkId, {
      planId: alternative.plan.planId,
      sliceId: alternative.slice.sliceId,
      contextId: 'ctx-dse3-e2e-001',
      semanticNodeId: alternative.plan.elements[0]?.semanticNodeId ?? '',
      critiqueText: 'Constrained alternative preserves mandatory bins; adopt for Quest.',
      author: { researcherId: 'investigator-e2e-001' },
      confirmed: true,
    });
    expect(feedback.binding.linkId).toBe(link.linkId);
    expect(feedback.record.author.researcherId).toBe('investigator-e2e-001');
    expect(atlas.getDirectAlternativeFeedbackBindings()).toHaveLength(1);
  });

  it('a later CLAIM_BEARING context closes conjectural traversal on the same compilation', () => {
    const atlas = buildAtlas('EXPLORATORY_ABDUCTION');
    const fingerprint = atlas.dataset.fingerprint;
    const snapshot = createDistributionSnapshot(fingerprint);
    const activeContext = atlas.getActiveInvestigationContext();
    if (!activeContext) throw new Error('setup failed: no active context');
    const proposal = createHypothesisProposal(
      snapshot.snapshotId,
      computeCommittedContextIdentity(activeContext)
    );
    const compilation = atlas.compileDirectEmbodiment({
      snapshot,
      admissionOptions: {
        conjecturalProposals: [proposal],
        bindings: [
          {
            kind: 'CONJECTURAL',
            proposalId: proposal.proposalId,
            elementId: 'node-density-bin-00',
            propertyPath: 'bins.0.density',
            status: 'HYPOTHESIZED',
          },
        ],
      },
    });
    const conjectural = compilation.plan.elements.find((e) => e.parameters.isConjectural);
    if (!conjectural) throw new Error('setup failed: conjectural element required');
    const authority = {
      datasetFingerprint: fingerprint,
      representationFamily: 'DISTRIBUTION' as const,
      decisionId: 'decision-distribution-switch',
      generation: 7,
      datasetVersion: 3,
    };

    const open = atlas.openDirectTraversal(conjectural.id, 'DISTRIBUTION', authority);
    expect(open.binding.epistemicPurpose).toBe('EXPLORATORY_ABDUCTION');

    atlas.commitInvestigationContext('ctx-dse3-e2e-002', {
      schemaVersion: 2,
      nodeId: 'ctx-dse3-e2e-002',
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Now make claims',
        currentTask: 'claim',
      },
    });
    expect(() => atlas.openDirectTraversal(conjectural.id, 'DISTRIBUTION', authority)).toThrow(
      'EXPLORATORY_ABDUCTION'
    );
  });

  it('aggregate refuses feedback on unknown links and self-labeled events', () => {
    const atlas = buildAtlas('CLAIM_BEARING');
    const snapshot = createDistributionSnapshot(atlas.dataset.fingerprint);
    atlas.compileDirectEmbodiment({ snapshot });

    expect(() =>
      atlas.recordDirectAlternativeFeedback('link-unknown', {
        planId: 'plan-x',
        sliceId: 'slice-x',
        contextId: 'ctx-dse3-e2e-001',
        semanticNodeId: 'node-x',
        critiqueText: 'no link',
        confirmed: true,
      })
    ).toThrow('unknown critique->alternative link');
  });

  it('self-labeled feedback is refused even with a valid link', () => {
    const atlas = buildAtlas('CLAIM_BEARING');
    const fingerprint = atlas.dataset.fingerprint;
    const snapshot = createDistributionSnapshot(fingerprint);
    const first = atlas.compileDirectEmbodiment({ snapshot });
    const elementId = first.plan.elements[0]?.id ?? '';
    const critique = recordInvestigatorCritique({
      investigatorId: 'investigator-e2e-002',
      targetElementId: elementId,
      targetPhenomenon: 'DISTRIBUTION',
      critiqueKind: 'CUSTOM',
      note: 'needs alternative',
      contextId: 'ctx-dse3-e2e-001',
    });
    atlas.compileDirectEmbodiment({ snapshot, critiqueFeedback: [critique] });
    const { link } = atlas.resolveDirectAlternativeFromCritique(critique.critiqueId, {
      budget: QUEST_CONSTRAINED_BUDGET,
    });

    expect(() =>
      atlas.recordDirectAlternativeFeedback(link.linkId, {
        planId: 'plan-x',
        sliceId: 'slice-x',
        contextId: 'ctx-dse3-e2e-001',
        semanticNodeId: 'node-x',
        critiqueText: 'automated praise',
        confirmed: true,
        automated: true,
      } as never)
    ).toThrow();
  });
});
