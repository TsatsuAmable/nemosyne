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
import {
  type SemanticSnapshotV1,
  SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
  computeSnapshotId,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import {
  buildAlternativeEntries,
  buildDirectLoopSurfaceViews,
  buildVariantPairView,
} from '../src/moneta/representation/DirectLoopViewModels.ts';
import { computeCommittedContextIdentity } from '../src/atlas/domain/CommittedInvestigationContext.ts';
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.ts';
import type { InvestigationIntentV1 } from '../src/atlas/domain/InvestigationIntent.ts';

// Exit-qualification battery: proves the FM1/FM2 plan exits through the
// NIL -> aggregate -> view-model -> V4 direct-loop product path. Headless by
// design (mock kernels); it qualifies routing, provenance, and lineage
// integrity — never analytical truth, which stays a Rust/WASM claim.

function makeDataset(): Dataset {
  const rows = Array.from({ length: 60 }, (_, i) => ({
    val: i * 1.5,
    group: i % 2 === 0 ? 'A' : 'B',
  }));
  return new Dataset(
    'fm-exit-dataset',
    [
      { name: 'val', type: ColumnType.NUMERIC },
      { name: 'group', type: ColumnType.CATEGORICAL },
    ],
    rows
  );
}

function makeIntent(
  researchQuestion: string,
  currentTask: string,
  variablesOfInterest: string[]
): InvestigationIntentV1 {
  return {
    schemaVersion: 1,
    researchQuestion,
    currentTask,
    variablesOfInterest,
  };
}

function makeContext(nodeId: string, intent: InvestigationIntentV1): CommittedInvestigationContextV2 {
  return {
    schemaVersion: 2,
    nodeId,
    epistemicPurpose: 'CLAIM_BEARING',
    intent,
  };
}

function buildAtlasWithIntent(intent: InvestigationIntentV1): AtlasCore {
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
  atlas.loadDataset(makeDataset());
  atlas.commitInvestigationContext('ctx-exit-001', makeContext('ctx-exit-001', intent));
  return atlas;
}

function makeSnapshot(datasetFingerprint: string): SemanticSnapshotV1 {
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
        evidenceReferences: [
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
        ],
        limitations: [],
      },
    ],
    nodes: Array.from({ length: 8 }, (_, idx) => ({
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
      value: 0.1 + 0.8 * Math.exp(-Math.pow((idx - 4) / 2, 2)),
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

function nilCommand(
  sequence: number,
  verb: NilCommand['verb'],
  parameters: NilCommand['parameters']
): NilCommand {
  return {
    nilVersion: NIL_VERSION,
    commandId: `exit-cmd-${sequence}`,
    investigationId: 'investigation-exit',
    sequence,
    verb,
    targetIds: [],
    parameters,
    actor: 'researcher',
  };
}

async function critiqueAndPrefer(atlas: AtlasCore): Promise<string> {
  const snapshot = makeSnapshot(atlas.dataset.fingerprint);
  const first = atlas.compileDirectEmbodiment({ snapshot });
  const elementId = first.plan.elements[0]?.id ?? '';
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
  return critiqueId;
}

describe('FM1 exit through the direct loop: intent-framed decisions', () => {
  it('two materially different intents yield distinct provenance-bearing direct compilations', () => {
    const atlasA = buildAtlasWithIntent(
      makeIntent('What is the empirical distribution of val?', 'distribution-analysis', ['val'])
    );
    const atlasB = buildAtlasWithIntent(
      makeIntent('Do groups A and B separate over val?', 'cluster-comparison', ['val', 'group'])
    );
    const resultA = atlasA.compileDirectEmbodiment({
      snapshot: makeSnapshot(atlasA.dataset.fingerprint),
    });
    const resultB = atlasB.compileDirectEmbodiment({
      snapshot: makeSnapshot(atlasB.dataset.fingerprint),
    });

    expect(resultA.datasetFingerprint).toBe(resultB.datasetFingerprint);
    expect(resultA.provenance.contextDigest).toBeDefined();
    expect(resultB.provenance.contextDigest).toBeDefined();
    expect(resultA.provenance.contextDigest).not.toBe(resultB.provenance.contextDigest);
    expect(resultA.reverseExplanation).toBeDefined();
  });

  it('replaying the identical intent reproduces the exact context digest', () => {
    const intent = makeIntent('What is the empirical distribution of val?', 'distribution-analysis', [
      'val',
    ]);
    const first = buildAtlasWithIntent(intent).compileDirectEmbodiment({
      snapshot: makeSnapshot(buildAtlasWithIntent(intent).dataset.fingerprint),
    });
    const atlas = buildAtlasWithIntent(intent);
    const second = atlas.compileDirectEmbodiment({
      snapshot: makeSnapshot(atlas.dataset.fingerprint),
    });
    expect(second.provenance.contextDigest).toBe(first.provenance.contextDigest);
  });

  it('irrelevant wording changes preserve canonical identity through the direct path', () => {
    const padded = makeIntent('   What is the distribution of val?   ', 'distribution-analysis', [
      'val',
    ]);
    const clean = makeIntent('What is the distribution of val?', 'distribution-analysis', ['val']);
    expect(computeCommittedContextIdentity(makeContext('ctx-exit-001', padded))).toBe(
      computeCommittedContextIdentity(makeContext('ctx-exit-001', clean))
    );
    const atlasA = buildAtlasWithIntent(padded);
    const atlasB = buildAtlasWithIntent(clean);
    const digestA = atlasA.compileDirectEmbodiment({
      snapshot: makeSnapshot(atlasA.dataset.fingerprint),
    }).provenance.contextDigest;
    const digestB = atlasB.compileDirectEmbodiment({
      snapshot: makeSnapshot(atlasB.dataset.fingerprint),
    }).provenance.contextDigest;
    expect(digestA).toBe(digestB);
  });
});

describe('FM2 exit through the direct loop: compare, branch, defer, replay', () => {
  it('NIL critique->resolve carries parent lineage and author attribution into the link', async () => {
    const atlas = buildAtlasWithIntent(
      makeIntent('Resolve detail through researcher commands', 'command_routing', ['val'])
    );
    const critiqueId = await critiqueAndPrefer(atlas);

    const links = atlas.getDirectFeedbackLinks();
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link.critiqueId).toBe(critiqueId);
    // The active compilation is never switched silently: the link's prior is
    // the still-active compilation, and the alternative is a new one.
    expect(link.priorCompilationId).toBe(
      atlas.getActiveDirectCompileResult()?.compilationId
    );
    expect(link.alternativeCompilationId).not.toBe(link.priorCompilationId);
    expect(link.contextPurpose).toBe('CLAIM_BEARING');

    const critique = atlas
      .getActiveDirectCompileResult()
      ?.critiqueLedger.find((c) => c.critiqueId === critiqueId);
    expect(critique?.investigatorId?.trim().length).toBeGreaterThan(0);
    // The critique binds the committed context by node id; the full
    // provenance (including the canonical intent hash) resolves through the
    // compilation lineage asserted above.
    expect(critique?.recordedContextId).toBe('ctx-exit-001');
  });

  it('compare-only defer preserves decision, lineage, and alternatives with nothing lost', async () => {
    const atlas = buildAtlasWithIntent(
      makeIntent('Resolve detail through researcher commands', 'command_routing', ['val'])
    );
    const snapshot = makeSnapshot(atlas.dataset.fingerprint);
    const pair = atlas.compileObligationPreservingVariants({ snapshot });
    const activeBefore = atlas.getActiveDirectCompileResult();
    expect(activeBefore).toBeDefined();

    // A full compare-only surface session: views over live getters, no branch action.
    const views = buildDirectLoopSurfaceViews({
      links: atlas.getDirectFeedbackLinks(),
      bindings: atlas.getDirectAlternativeFeedbackBindings(),
      variantPair: atlas.getActiveVariantPair() ?? pair,
    });
    expect(views.alternative.pair).toBeDefined();
    expect(views.alternative.pair?.variants).toHaveLength(2);
    expect(buildVariantPairView(atlas.getActiveVariantPair() ?? pair)).toEqual(
      views.alternative.pair
    );

    // Nothing moved: same active compilation, no links conjured by viewing.
    expect(atlas.getActiveDirectCompileResult()).toBe(activeBefore);
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);

    // The deferred state packages and restores losslessly.
    const bytes = atlas.exportFormaInvestigationBytes();
    expect(bytes).toBeDefined();
    const fresh = buildAtlasWithIntent(
      makeIntent('Resolve detail through researcher commands', 'command_routing', ['val'])
    );
    fresh.setFormaState(JSON.parse(new TextDecoder().decode(bytes!)));
    expect(fresh.getDirectFeedbackLinks()).toHaveLength(0);
    expect(fresh.exportFormaInvestigationBytes()).toBeDefined();
  });

  it('direct-loop view builders are pure projections over the live aggregate', async () => {
    const atlas = buildAtlasWithIntent(
      makeIntent('Resolve detail through researcher commands', 'command_routing', ['val'])
    );
    const snapshot = makeSnapshot(atlas.dataset.fingerprint);
    atlas.compileDirectEmbodiment({ snapshot });
    await critiqueAndPrefer(atlas);

    const linksBefore = atlas.getDirectFeedbackLinks();
    const first = buildAlternativeEntries(
      linksBefore,
      atlas.getDirectAlternativeFeedbackBindings()
    );
    const second = buildAlternativeEntries(
      atlas.getDirectFeedbackLinks(),
      atlas.getDirectAlternativeFeedbackBindings()
    );
    expect(second).toEqual(first);
    expect(first).toHaveLength(1);
    expect(first[0]?.linkId).toBe(linksBefore[0]?.linkId);
    expect(first[0]?.feedbackRecordId).toBeNull();
    // Viewing introduced no lineage of its own.
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(1);
  });

  it('V4 packaging round-trips branch lineage byte-identically', async () => {
    const atlas = buildAtlasWithIntent(
      makeIntent('Resolve detail through researcher commands', 'command_routing', ['val'])
    );
    await critiqueAndPrefer(atlas);
    const first = atlas.exportFormaInvestigationBytes();
    expect(first).toBeDefined();

    const restored = buildAtlasWithIntent(
      makeIntent('Resolve detail through researcher commands', 'command_routing', ['val'])
    );
    restored.setFormaState(JSON.parse(new TextDecoder().decode(first!)));
    expect(restored.getDirectFeedbackLinks()).toHaveLength(1);
    expect(restored.getDirectFeedbackLinks()[0]?.linkId).toBe(
      atlas.getDirectFeedbackLinks()[0]?.linkId
    );
    const second = restored.exportFormaInvestigationBytes();
    expect(new TextDecoder().decode(second!)).toBe(new TextDecoder().decode(first!));
  });

  it('an adjustment reproducing the prior plan is refused instead of forking a phantom alternative', async () => {
    const atlas = buildAtlasWithIntent(
      makeIntent('Resolve detail through researcher commands', 'command_routing', ['val'])
    );
    const snapshot = makeSnapshot(atlas.dataset.fingerprint);
    atlas.compileDirectEmbodiment({ snapshot });
    const executor = new NilExecutor();
    bindAtlasNilHandlers(executor, atlas);
    await executor.execute(
      nilCommand(0, 'REJECT', {
        directTarget: atlas.getActiveDirectCompileResult()?.plan.elements[0]?.id ?? '',
        critiqueKind: 'SPATIAL_SCALE',
        phenomenon: 'DISTRIBUTION',
        note: 'probe the no-change refusal',
      })
    );
    const critiqueId = atlas.getActiveDirectCompileResult()?.critiqueLedger[0]?.critiqueId ?? '';
    expect(critiqueId.length).toBeGreaterThan(0);
    // Resolving with no adjustment would reproduce the prior plan: refused,
    // and the refusal conjures no link.
    expect(() => atlas.resolveDirectAlternativeFromCritique(critiqueId)).toThrow(
      /reproduces the prior plan/
    );
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);
  });
});
