import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  NIL_VERSION,
  NilExecutor,
  bindAtlasNilHandlers,
  type NilCommand,
} from '../src/interaction/nil/index.ts';
import { compileDirectEmbodimentPlan } from '../src/moneta/representation/DirectEmbodimentCompiler.ts';
import {
  buildAlternativeEntries,
  buildDirectLoopSurfaceViews,
  buildDisclosureCards,
  buildPurposeBadge,
  buildVariantPairView,
} from '../src/moneta/representation/DirectLoopViewModels.ts';
import { discloseConjecturalElements } from '../src/moneta/representation/DirectFeedbackLoop.ts';
import {
  type SemanticSnapshotV1,
  SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
  computeSnapshotId,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import { DESKTOP_EXPANSIVE_BUDGET } from '../src/moneta/forma/FormaResolutionBroker.ts';
import { createConjecturalProposal } from '../src/moneta/forma/ConjecturalProposal.ts';
import { computeCommittedContextIdentity } from '../src/atlas/domain/CommittedInvestigationContext.ts';
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.ts';

const FP = 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4';

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

function createContext(
  purpose: 'CLAIM_BEARING' | 'EXPLORATORY_ABDUCTION'
): CommittedInvestigationContextV2 {
  return {
    schemaVersion: 2,
    nodeId: 'ctx-fm-loop-001',
    epistemicPurpose: purpose,
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Resolve detail through researcher commands',
      currentTask: 'command_routing',
    },
  };
}

function buildAtlas(purpose: 'CLAIM_BEARING' | 'EXPLORATORY_ABDUCTION'): AtlasCore {
  const rows = Array.from({ length: 60 }, (_, i) => ({
    val: i * 1.5,
    group: i % 2 === 0 ? 'A' : 'B',
  }));
  const ds = new Dataset(
    'fm-loop-dataset',
    [
      { name: 'val', type: ColumnType.NUMERIC },
      { name: 'group', type: ColumnType.CATEGORICAL },
    ],
    rows
  );
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
  atlas.loadDataset(ds);
  atlas.commitInvestigationContext('ctx-fm-loop-001', {
    schemaVersion: 2,
    nodeId: 'ctx-fm-loop-001',
    epistemicPurpose: purpose,
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Resolve detail through researcher commands',
      currentTask: 'command_routing',
    },
  });
  return atlas;
}

function nilCommand(
  sequence: number,
  verb: NilCommand['verb'],
  parameters: NilCommand['parameters']
): NilCommand {
  return {
    nilVersion: NIL_VERSION,
    commandId: `cmd-${sequence}`,
    investigationId: 'investigation-1',
    sequence,
    verb,
    targetIds: [],
    parameters,
    actor: 'researcher',
  };
}

function compileForAtlas(atlas: AtlasCore) {
  const snapshot = createDistributionSnapshot(atlas.dataset.fingerprint);
  const compilation = atlas.compileDirectEmbodiment({ snapshot });
  return { snapshot, compilation, elementId: compilation.plan.elements[0]?.id ?? '' };
}

describe('FM1/FM2: legacy NIL parity with an active direct compilation', () => {
  it('legacy REJECT records loose critique and leaves direct state untouched', async () => {
    const atlas = buildAtlas('CLAIM_BEARING');
    const { compilation } = compileForAtlas(atlas);
    const executor = new NilExecutor();
    const rejected: unknown[] = [];
    bindAtlasNilHandlers(executor, atlas, {
      onAlternativeRejected: (_command, critique) => rejected.push(critique),
    });

    await executor.execute(
      nilCommand(0, 'REJECT', { candidateId: 'legacy-candidate', rationale: 'not convincing' })
    );

    expect(rejected).toHaveLength(1);
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);
    expect(atlas.getDirectAlternativeFeedbackBindings()).toHaveLength(0);
    expect(atlas.getActiveDirectCompileResult()).toBe(compilation);
  });

  it('legacy PREFER without direct params throws the unchanged legacy error', async () => {
    const atlas = buildAtlas('CLAIM_BEARING');
    compileForAtlas(atlas);
    const executor = new NilExecutor();
    bindAtlasNilHandlers(executor, atlas);

    await expect(
      executor.execute(nilCommand(0, 'PREFER', { candidateId: 'legacy-candidate' }))
    ).rejects.toThrow();
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);
  });
});

describe('FM1/FM2: NIL direct routes through the real aggregate', () => {
  it('REJECT with directTarget records into the ledger and recompiles', async () => {
    const atlas = buildAtlas('CLAIM_BEARING');
    const { compilation, elementId } = compileForAtlas(atlas);
    const executor = new NilExecutor();
    const recorded: unknown[] = [];
    bindAtlasNilHandlers(executor, atlas, {
      onDirectCritiqueRecorded: (_command, entry) => recorded.push(entry),
    });

    await executor.execute(
      nilCommand(0, 'REJECT', {
        directTarget: elementId,
        critiqueKind: 'DENSITY_RESOLUTION',
        phenomenon: 'DISTRIBUTION',
        note: 'bins too coarse under Quest budget',
      })
    );

    expect(recorded).toHaveLength(1);
    const active = atlas.getActiveDirectCompileResult();
    expect(active).toBeDefined();
    expect(active?.critiqueLedger).toHaveLength(1);
    expect(active?.critiqueLedger[0]?.investigatorId).toBe('researcher');
    expect(active?.plan.planId).toBe(compilation.plan.planId);
  });

  it('REJECT direct route fails closed on bad kind, phenomenon, note, and target', async () => {
    const atlas = buildAtlas('CLAIM_BEARING');
    const { elementId } = compileForAtlas(atlas);
    const executor = new NilExecutor();
    bindAtlasNilHandlers(executor, atlas);
    const base = {
      directTarget: elementId,
      critiqueKind: 'DENSITY_RESOLUTION',
      phenomenon: 'DISTRIBUTION',
      note: 'needs refinement',
    };

    // Failed NIL commands do not advance the executor sequence: every refusal
    // below replays at position 0.
    await expect(
      executor.execute(nilCommand(0, 'REJECT', { ...base, critiqueKind: 'VIBES' }))
    ).rejects.toThrow('critiqueKind');
    await expect(
      executor.execute(nilCommand(0, 'REJECT', { ...base, phenomenon: 'TEMPORAL' }))
    ).rejects.toThrow('phenomenon');
    await expect(
      executor.execute(nilCommand(0, 'REJECT', { ...base, note: '   ' }))
    ).rejects.toThrow('note');
    await expect(
      executor.execute(nilCommand(0, 'REJECT', { ...base, directTarget: 'no-such-element' }))
    ).rejects.toThrow('not an element');
    expect(atlas.getActiveDirectCompileResult()?.critiqueLedger ?? []).toHaveLength(0);
  });

  it('PREFER with directCritiqueId resolves a linked alternative', async () => {
    const atlas = buildAtlas('CLAIM_BEARING');
    const { elementId } = compileForAtlas(atlas);
    const executor = new NilExecutor();
    const resolved: unknown[] = [];
    bindAtlasNilHandlers(executor, atlas, {
      onDirectAlternativeResolved: (_command, entry) => resolved.push(entry),
    });

    await executor.execute(
      nilCommand(0, 'REJECT', {
        directTarget: elementId,
        critiqueKind: 'SPATIAL_SCALE',
        phenomenon: 'DISTRIBUTION',
        note: 'overview too coarse; resolve constrained alternative',
      })
    );
    const critiqueId = atlas.getActiveDirectCompileResult()?.critiqueLedger[0]?.critiqueId ?? '';
    expect(critiqueId.length).toBeGreaterThan(0);

    await executor.execute(
      nilCommand(1, 'PREFER', { directCritiqueId: critiqueId, budgetProfile: 'QUEST_CONSTRAINED' })
    );

    expect(resolved).toHaveLength(1);
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(1);
    expect(atlas.getDirectFeedbackLinks()[0]?.critiqueId).toBe(critiqueId);
  });

  it('PREFER direct route fails closed on profile, critique, and missing params', async () => {
    const atlas = buildAtlas('CLAIM_BEARING');
    const { elementId } = compileForAtlas(atlas);
    const executor = new NilExecutor();
    bindAtlasNilHandlers(executor, atlas);

    await executor.execute(
      nilCommand(0, 'REJECT', {
        directTarget: elementId,
        critiqueKind: 'CUSTOM',
        phenomenon: 'DISTRIBUTION',
        note: 'needs alternative',
      })
    );
    const critiqueId = atlas.getActiveDirectCompileResult()?.critiqueLedger[0]?.critiqueId ?? '';

    // Refusals replay at sequence 1: the successful REJECT advanced past 0.
    await expect(
      executor.execute(nilCommand(1, 'PREFER', { directCritiqueId: critiqueId }))
    ).rejects.toThrow('budgetProfile');
    await expect(
      executor.execute(
        nilCommand(1, 'PREFER', { directCritiqueId: critiqueId, budgetProfile: 'SMARTWATCH_TINY' })
      )
    ).rejects.toThrow('budgetProfile');
    await expect(
      executor.execute(
        nilCommand(1, 'PREFER', {
          directCritiqueId: 'critique-unknown',
          budgetProfile: 'QUEST_CONSTRAINED',
        })
      )
    ).rejects.toThrow('Unknown critique');
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);
  });

  it('QUESTION preserves purpose so later traversal stays gated', async () => {
    const atlas = buildAtlas('EXPLORATORY_ABDUCTION');
    compileForAtlas(atlas);
    const executor = new NilExecutor();
    bindAtlasNilHandlers(executor, atlas);

    await executor.execute(
      nilCommand(0, 'QUESTION', { question: 'Which bins carry the secondary mode?' })
    );
    expect(atlas.getActiveInvestigationContext()?.epistemicPurpose).toBe('EXPLORATORY_ABDUCTION');
    expect(atlas.getActiveInvestigationContext()?.intent.researchQuestion).toBe(
      'Which bins carry the secondary mode?'
    );
  });
});

describe('FM1/FM2: headless direct-loop view models', () => {
  function exploratoryCompilation() {
    const snapshot = createDistributionSnapshot(FP);
    const context = createContext('EXPLORATORY_ABDUCTION');
    const proposal = createConjecturalProposal({
      snapshotId: snapshot.snapshotId,
      contextId: computeCommittedContextIdentity(context),
      generator: {
        modelId: 'AbductiveHypothesisModel',
        modelVersion: '1.0.0',
        executionRegime: 'ADAPTIVE',
      },
      elements: [
        {
          elementId: 'node-density-bin-00',
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
    const compilation = compileDirectEmbodimentPlan({
      datasetFingerprint: FP,
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

  it('projects disclosure cards, purpose badge, alternative entries, and variant pairs', () => {
    const atlas = buildAtlas('EXPLORATORY_ABDUCTION');
    const fingerprint = atlas.dataset.fingerprint;
    const snapshot = createDistributionSnapshot(fingerprint);
    const pair = atlas.compileObligationPreservingVariants({ snapshot });

    const { compilation, proposal } = exploratoryCompilation();
    const disclosures = discloseConjecturalElements(
      compilation,
      [proposal],
      'EXPLORATORY_ABDUCTION'
    );
    const cards = buildDisclosureCards(disclosures);
    expect(cards.conjecturalElementCount).toBeGreaterThan(0);
    expect(cards.cards[0]).toMatchObject({
      proposalId: proposal.proposalId,
      admittedUnder: 'EXPLORATORY_ABDUCTION',
    });
    expect(cards.cards[0]?.generator).toContain('AbductiveHypothesisModel');

    const session = atlas.openDirectTraversal(
      pair.desktop.plan.elements[0]?.id ?? '',
      'DISTRIBUTION',
      {
        datasetFingerprint: fingerprint,
        representationFamily: 'DISTRIBUTION',
        decisionId: 'decision-fm-view',
        generation: 7,
        datasetVersion: 3,
      }
    );
    const badge = buildPurposeBadge(session.binding);
    expect(badge).toMatchObject({
      epistemicPurpose: 'EXPLORATORY_ABDUCTION',
      isConjectural: false,
      traversalId: session.binding.traversalId,
    });

    const variants = buildVariantPairView(pair);
    expect(variants.traversalRootId).toBe(pair.traversalRootId);
    expect(variants.variants).toHaveLength(2);
    expect(variants.variants[0]?.budgetProfile).toBe('DESKTOP_EXPANSIVE');
    expect(variants.mandatoryNodeIds.length).toBeGreaterThan(0);

    const entries = buildAlternativeEntries(atlas.getDirectFeedbackLinks(), []);
    expect(entries).toHaveLength(0);
    expect(buildDisclosureCards(disclosures)).toEqual(cards);
  });
});

describe('FM1/FM2: V4 packaging captures direct-loop lineage', () => {
  async function atlasWithOneLink(): Promise<{ atlas: AtlasCore; critiqueId: string }> {
    const atlas = buildAtlas('CLAIM_BEARING');
    const { elementId } = compileForAtlas(atlas);
    const executor = new NilExecutor();
    bindAtlasNilHandlers(executor, atlas);

    await executor.execute(
      nilCommand(0, 'REJECT', {
        directTarget: elementId,
        critiqueKind: 'SPATIAL_SCALE',
        phenomenon: 'DISTRIBUTION',
        note: 'overview too coarse; resolve constrained alternative',
      })
    );
    const critiqueId = atlas.getActiveDirectCompileResult()?.critiqueLedger[0]?.critiqueId ?? '';
    expect(critiqueId.length).toBeGreaterThan(0);

    await executor.execute(
      nilCommand(1, 'PREFER', { directCritiqueId: critiqueId, budgetProfile: 'QUEST_CONSTRAINED' })
    );
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(1);
    return { atlas, critiqueId };
  }

  it('direct-only flows export V4 bytes carrying critique->alternative links', async () => {
    const { atlas, critiqueId } = await atlasWithOneLink();

    const bytes = atlas.exportFormaInvestigationBytes();
    expect(bytes).toBeDefined();
    const parsed = JSON.parse(new TextDecoder().decode(bytes!));
    expect(parsed.directFeedbackLinks).toHaveLength(1);
    expect(parsed.directFeedbackLinks[0]?.critiqueId).toBe(critiqueId);
    expect(parsed.directFeedbackLinks[0]?.linkId).toBe(
      atlas.getDirectFeedbackLinks()[0]?.linkId
    );
    expect(parsed.directAlternativeFeedbackBindings).toEqual([]);
  });

  it('restored investigations serve packaged links through the live getters', async () => {
    const { atlas, critiqueId } = await atlasWithOneLink();
    const bytes = atlas.exportFormaInvestigationBytes();
    expect(bytes).toBeDefined();
    const parsed = JSON.parse(new TextDecoder().decode(bytes!));

    const restored = buildAtlas('CLAIM_BEARING');
    expect(restored.getDirectFeedbackLinks()).toHaveLength(0);
    restored.setFormaState(parsed);
    expect(restored.getDirectFeedbackLinks()).toHaveLength(1);
    expect(restored.getDirectFeedbackLinks()[0]?.critiqueId).toBe(critiqueId);
    expect(restored.getDirectAlternativeFeedbackBindings()).toEqual([]);
  });

  it('legacy snapshots without lineage fields restore to empty without throwing', async () => {
    const { atlas } = await atlasWithOneLink();
    const bytes = atlas.exportFormaInvestigationBytes();
    expect(bytes).toBeDefined();
    const parsed = JSON.parse(new TextDecoder().decode(bytes!));
    delete parsed.directFeedbackLinks;
    delete parsed.directAlternativeFeedbackBindings;

    const restored = buildAtlas('CLAIM_BEARING');
    expect(() => restored.setFormaState(parsed)).not.toThrow();
    expect(restored.getDirectFeedbackLinks()).toHaveLength(0);
    expect(restored.getDirectAlternativeFeedbackBindings()).toHaveLength(0);
  });
});

describe('FM1/FM2: headless surface projection over direct-loop state', () => {
  it('projects inspector/history/alternative views from live aggregate getters', async () => {
    const atlas = buildAtlas('EXPLORATORY_ABDUCTION');
    const fingerprint = atlas.dataset.fingerprint;
    const snapshot = createDistributionSnapshot(fingerprint);
    const pair = atlas.compileObligationPreservingVariants({ snapshot });
    const proposal = createConjecturalProposal({
      snapshotId: snapshot.snapshotId,
      contextId: computeCommittedContextIdentity(createContext('EXPLORATORY_ABDUCTION')),
      generator: {
        modelId: 'AbductiveHypothesisModel',
        modelVersion: '1.0.0',
        executionRegime: 'ADAPTIVE',
      },
      elements: [
        {
          elementId: 'node-density-bin-00',
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
    const elementId = compilation.plan.elements[0]?.id ?? '';
    const session = atlas.openDirectTraversal(elementId, 'DISTRIBUTION', {
      datasetFingerprint: fingerprint,
      representationFamily: 'DISTRIBUTION',
      decisionId: 'decision-fm-surface',
      generation: 7,
      datasetVersion: 3,
    });
    const disclosures = discloseConjecturalElements(compilation, [proposal], 'EXPLORATORY_ABDUCTION');

    const executor = new NilExecutor();
    bindAtlasNilHandlers(executor, atlas);
    await executor.execute(
      nilCommand(0, 'REJECT', {
        directTarget: elementId,
        critiqueKind: 'SPATIAL_SCALE',
        phenomenon: 'DISTRIBUTION',
        note: 'overview too coarse; resolve constrained alternative',
      })
    );
    const critiqueId = atlas.getActiveDirectCompileResult()?.critiqueLedger[0]?.critiqueId ?? '';
    expect(critiqueId.length).toBeGreaterThan(0);
    await executor.execute(
      nilCommand(1, 'PREFER', { directCritiqueId: critiqueId, budgetProfile: 'QUEST_CONSTRAINED' })
    );

    const views = buildDirectLoopSurfaceViews({
      disclosures,
      traversalBinding: session.binding,
      links: atlas.getDirectFeedbackLinks(),
      bindings: atlas.getDirectAlternativeFeedbackBindings(),
      variantPair: pair,
    });

    expect(views.schemaVersion).toBe('1.0.0');
    expect(views.inspector.disclosures?.conjecturalElementCount).toBeGreaterThan(0);
    expect(views.inspector.disclosures?.cards[0]?.admittedUnder).toBe('EXPLORATORY_ABDUCTION');
    expect(views.inspector.purpose?.traversalId).toBe(session.binding.traversalId);
    expect(views.inspector.alternatives).toHaveLength(1);
    expect(views.inspector.alternatives[0]?.critiqueId).toBe(critiqueId);
    expect(views.history.alternatives).toHaveLength(1);
    expect(views.history.alternatives[0]?.linkId).toBe(
      atlas.getDirectFeedbackLinks()[0]?.linkId
    );
    expect(views.history.bindings).toEqual([]);
    expect(views.alternative.pair?.traversalRootId).toBe(pair.traversalRootId);
    expect(views.alternative.pair?.variants).toHaveLength(2);
    expect(views.alternative.alternatives).toHaveLength(1);
  });

  it('projects empty views without throwing when no direct-loop state exists', () => {
    const views = buildDirectLoopSurfaceViews({ links: [] });
    expect(views.schemaVersion).toBe('1.0.0');
    expect(views.inspector.disclosures).toBeNull();
    expect(views.inspector.purpose).toBeNull();
    expect(views.inspector.alternatives).toEqual([]);
    expect(views.history.alternatives).toEqual([]);
    expect(views.history.bindings).toEqual([]);
    expect(views.alternative.pair).toBeNull();
    expect(views.alternative.alternatives).toEqual([]);
  });

  it('joins feedback records onto alternative entries by link identity', () => {
    const views = buildDirectLoopSurfaceViews({
      links: [
        {
          linkId: 'link-join-1',
          critiqueId: 'critique-join-1',
          priorCompilationId: 'comp-prior',
          priorDecisionId: 'decision-prior',
          alternativeCompilationId: 'comp-alt',
          alternativeDecisionId: 'decision-alt',
          targetElementId: 'node-density-bin-00',
          contextPurpose: 'CLAIM_BEARING',
        },
      ],
      bindings: [
        { bindingId: 'binding-join-1', linkId: 'link-join-1', critiqueRecordId: 'record-join-1' },
      ],
    });
    expect(views.history.alternatives).toHaveLength(1);
    expect(views.history.alternatives[0]?.feedbackRecordId).toBe('record-join-1');
    expect(views.history.bindings).toHaveLength(1);
    expect(views.inspector.alternatives[0]?.feedbackRecordId).toBe('record-join-1');
  });
});