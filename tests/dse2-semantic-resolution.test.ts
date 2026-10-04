import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  compileDirectEmbodimentPlan,
  compileObligationPreservingVariants,
  type DirectEmbodimentCompileResult,
} from '../src/moneta/representation/DirectEmbodimentCompiler.ts';
import {
  DirectTraversalSession,
  DIRECT_TRAVERSAL_PAGE_LIMIT_V1,
  type DirectTraversalPort,
  type EstablishedDetailAuthorityV1,
} from '../src/moneta/representation/DirectTraversalSession.ts';
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
import type { CommittedInvestigationContextV2 } from '../src/atlas/domain/CommittedInvestigationContext.ts';

const FP = 'c4d2e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

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

function createClusteringSnapshot(datasetFingerprint: string): SemanticSnapshotV1 {
  const body = {
    analyticalDatasetFingerprint: datasetFingerprint,
    kernelVersion: '1.0.0-rust-wasm',
    semanticVocabulary: {
      id: 'vocab-topological-clustering',
      version: '1.0.0',
      digest: 'digest-vocab-002',
    },
    normalizer: {
      id: 'normalizer-spatial-clustering',
      version: '1.0.0',
      digest: 'digest-norm-002',
    },
    coverage: [
      {
        family: 'TOPOLOGY',
        analyticalRequestDigest: 'digest-req-topo-001',
        status: 'AVAILABLE' as const,
      },
    ],
    sources: [
      {
        sourceId: 'src-topological-clusters',
        family: 'TOPOLOGY',
        analyticalRequestIdentity: 'req-cluster-centroids-2d',
        method: 'topological_partitioning_centroids',
        methodVersion: '1.0.0',
        parametersDigest: 'digest-params-002',
        state: {
          status: 'AVAILABLE' as const,
          approximation: {
            mode: 'CENTROID_SUMMARY',
            representedRowCount: 5000,
            description: 'Topological partition hulls and centroids',
          },
        },
        evidenceReferences: createMockEvidenceReferences(datasetFingerprint),
        limitations: [],
      },
    ],
    nodes: Array.from({ length: 8 }, (_, idx) => ({
      nodeId: `node-cluster-centroid-${idx}`,
      sourceId: 'src-topological-clusters',
      producerSemanticId: 'topological_cluster_engine',
      propertyPath: `clusters.${idx}.centroid_separation`,
      descriptor: {
        label: `Cluster Centroid ${idx}`,
        valueType: 'number' as const,
        unit: 'spatial_distance',
        frame: 'topological_partition',
      },
      value: 1.5 + idx * 0.75,
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
    nodeId: 'ctx-dse2-grounded-001',
    epistemicPurpose: 'CLAIM_BEARING',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Resolve bounded semantic detail from a direct compilation',
      currentTask: 'detail_resolution',
    },
  };
}

function distributionAuthority(fingerprint: string): EstablishedDetailAuthorityV1 {
  return {
    datasetFingerprint: fingerprint,
    representationFamily: 'DISTRIBUTION',
    decisionId: 'decision-distribution-dse2',
    generation: 7,
    datasetVersion: 3,
  };
}

function readyEnvelope(
  request: SemanticDetailRequestV1,
  generation: number,
  members: readonly string[],
  totalMemberCount: number
): SemanticDetailEnvelopeV1 {
  const page = members.slice(request.offset, request.offset + request.limit);
  return {
    schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
    generation,
    request: { ...request, target: { ...request.target } },
    result: {
      status: 'READY',
      totalMemberCount,
      returnedCount: page.length,
      observationIds: [...page],
      compactViews: page.map((id, i) => ({ id, ordinal: request.offset + i })),
    },
  };
}

type FakeMode =
  | 'READY'
  | 'REFUSED'
  | 'THROW'
  | 'STALE_GENERATION'
  | 'WRONG_FINGERPRINT'
  | 'IDENTITY_MISMATCH'
  | 'CHANGED_MEMBERS';

interface FakePortOptions {
  readonly generation?: number;
  readonly datasetVersion?: number;
  readonly registered?: boolean;
  readonly isAsync?: boolean;
  readonly members?: readonly string[];
  readonly totalMemberCount?: number;
  readonly mode?: FakeMode;
}

function fakePort(options: FakePortOptions = {}): DirectTraversalPort & {
  readonly requests: SemanticDetailRequestV1[];
} {
  const generation = options.generation ?? 7;
  const datasetVersion = options.datasetVersion ?? 3;
  const members = options.members ?? ['obs-0', 'obs-1', 'obs-2', 'obs-3', 'obs-4'];
  const total = options.totalMemberCount ?? members.length;
  const mode = options.mode ?? 'READY';
  const requests: SemanticDetailRequestV1[] = [];

  return {
    isAsync: options.isAsync ?? true,
    hasRegisteredDataset: () => options.registered ?? true,
    requests,
    execute: async <T>(req: {
      readonly requestId: string;
      readonly operation: 'semanticDetail';
      readonly dataset: { readonly fingerprint: string; readonly version: number };
      readonly generation: number;
      readonly params: {
        readonly request: SemanticDetailRequestV1;
        readonly embodimentRequest: null;
      };
    }): Promise<{
      readonly generation: number;
      readonly datasetVersion: number;
      readonly datasetFingerprint: string;
      readonly error?: string;
      readonly value: T | null;
    }> => {
      requests.push(req.params.request);
      if (mode === 'THROW') throw new Error('transport failure');
      const request = req.params.request;
      if (mode === 'STALE_GENERATION') {
        return {
          generation: generation + 1,
          datasetVersion,
          datasetFingerprint: req.dataset.fingerprint,
          value: null,
        };
      }
      if (mode === 'WRONG_FINGERPRINT') {
        return { generation, datasetVersion, datasetFingerprint: '0'.repeat(64), value: null };
      }
      if (mode === 'REFUSED') {
        const value: SemanticDetailEnvelopeV1 = {
          schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
          generation,
          request: { ...request, target: { ...request.target } },
          result: {
            status: 'REFUSED',
            refusal: { code: 'CHANGED_DATASET', message: 'authority withdrawn' },
          },
        };
        return {
          generation,
          datasetVersion,
          datasetFingerprint: req.dataset.fingerprint,
          value: value as unknown as T,
        };
      }
      const servedMembers =
        mode === 'CHANGED_MEMBERS' ? members.map((m) => `${m}-changed`) : members;
      let envelope = readyEnvelope(request, generation, servedMembers, total);
      if (mode === 'IDENTITY_MISMATCH') {
        envelope = {
          ...envelope,
          request: { ...envelope.request, offset: envelope.request.offset + 1000 },
        };
      }
      return {
        generation,
        datasetVersion,
        datasetFingerprint: req.dataset.fingerprint,
        value: envelope as unknown as T,
      };
    },
  };
}

function compileDistribution(fingerprint = FP): DirectEmbodimentCompileResult {
  return compileDirectEmbodimentPlan({
    datasetFingerprint: fingerprint,
    snapshot: createDistributionSnapshot(fingerprint),
    context: createGroundedContext(),
    budget: DESKTOP_EXPANSIVE_BUDGET,
  });
}

async function openReadySession(
  port: DirectTraversalPort,
  fingerprint = FP
): Promise<{ session: DirectTraversalSession; elementId: string }> {
  const compilation = compileDistribution(fingerprint);
  const elementId = compilation.plan.elements[0]?.id ?? '';
  const opened = DirectTraversalSession.open(
    compilation,
    elementId,
    'DISTRIBUTION',
    distributionAuthority(fingerprint)
  );
  if (opened.status !== 'READY') throw new Error(`setup failed: ${opened.status}`);
  const page = await opened.value.requestSubsetPage(port, 4, 0);
  if (page.status !== 'READY') throw new Error(`setup page failed: ${page.status}`);
  return { session: opened.value, elementId };
}

describe('DSE2: obligation-preserving device variants', () => {
  it('admits desktop+constrained pair with shared traversal root and preserved obligations', () => {
    const snapshot = createDistributionSnapshot(FP);
    const pair = compileObligationPreservingVariants({
      datasetFingerprint: FP,
      snapshot,
      context: createGroundedContext(),
    });

    expect(pair.variantBudgets).toEqual(['DESKTOP_EXPANSIVE', 'QUEST_CONSTRAINED']);
    expect(pair.snapshotId).toBe(snapshot.snapshotId);
    expect(pair.traversalRootId.startsWith('traversal-root-')).toBe(true);
    expect(pair.desktop.plan.datasetFingerprint).toBe(FP);
    expect(pair.constrained.plan.datasetFingerprint).toBe(FP);
    expect(pair.desktop.plan.semanticGraphId).toBe(pair.constrained.plan.semanticGraphId);

    const desktopNodes = new Set(pair.desktop.plan.elements.map((e) => e.semanticNodeId));
    const constrainedNodes = new Set(pair.constrained.plan.elements.map((e) => e.semanticNodeId));
    for (const mandatory of pair.preservedObligations.mandatoryNodeIds) {
      expect(desktopNodes.has(mandatory)).toBe(true);
      expect(constrainedNodes.has(mandatory)).toBe(true);
    }
    for (const shed of pair.constrainedShedChannels) {
      expect(pair.preservedObligations.mandatoryChannels).not.toContain(shed);
    }
    expect(pair.constrained.plan.elements.length).toBeGreaterThan(0);
  });

  it('is deterministic: repeated pair compilation shares root and plan identity', () => {
    const first = compileObligationPreservingVariants({
      datasetFingerprint: FP,
      snapshot: createDistributionSnapshot(FP),
      context: createGroundedContext(),
    });
    const second = compileObligationPreservingVariants({
      datasetFingerprint: FP,
      snapshot: createDistributionSnapshot(FP),
      context: createGroundedContext(),
    });

    expect(second.traversalRootId).toBe(first.traversalRootId);
    expect(second.desktop.plan.planId).toBe(first.desktop.plan.planId);
    expect(second.constrained.plan.planId).toBe(first.constrained.plan.planId);
  });

  it('fault injection: impossible mandatory node refuses closed', () => {
    expect(() =>
      compileObligationPreservingVariants({
        datasetFingerprint: FP,
        snapshot: createDistributionSnapshot(FP),
        context: createGroundedContext(),
        obligations: {
          mandatoryNodeIds: ['node-does-not-exist'],
          mandatoryChannels: ['spatial_position'],
        },
      })
    ).toThrow();
  });

  it('fault injection: unsatisfiable constrained budget refuses closed', () => {
    expect(() =>
      compileObligationPreservingVariants({
        datasetFingerprint: FP,
        snapshot: createDistributionSnapshot(FP),
        context: createGroundedContext(),
        constrainedBudget: { ...QUEST_CONSTRAINED_BUDGET, maxChannels: 1 },
      })
    ).toThrow();
  });
});

describe('DSE2: reversible direct traversal', () => {
  it('open binds traversal identity deterministically to plan element and authority', () => {
    const compilation = compileDistribution();
    const elementId = compilation.plan.elements[0]?.id ?? '';
    const first = DirectTraversalSession.open(
      compilation,
      elementId,
      'DISTRIBUTION',
      distributionAuthority(FP)
    );
    const second = DirectTraversalSession.open(
      compilation,
      elementId,
      'DISTRIBUTION',
      distributionAuthority(FP)
    );

    expect(first.status).toBe('READY');
    expect(second.status).toBe('READY');
    if (first.status !== 'READY' || second.status !== 'READY') throw new Error('setup failed');

    expect(first.value.binding.traversalId).toBe(second.value.binding.traversalId);
    expect(first.value.binding).toMatchObject({
      datasetFingerprint: FP,
      directDecisionId: compilation.plan.decisionId,
      detailDecisionId: 'decision-distribution-dse2',
      representationFamily: 'DISTRIBUTION',
      planElementId: elementId,
      phenomenon: 'DISTRIBUTION',
    });
    expect(first.value.binding.isConjectural).toBe(
      compilation.plan.elements[0]?.parameters.isConjectural ?? false
    );
    expect(first.value.currentLevel).toBe('STRUCTURE');
    expect(first.value.navigationDepth).toBe(1);
  });

  it('open refuses unknown element, mismatched authority, and uncovered phenomenon', () => {
    const compilation = compileDistribution();
    const elementId = compilation.plan.elements[0]?.id ?? '';

    expect(
      DirectTraversalSession.open(
        compilation,
        'no-such-element',
        'DISTRIBUTION',
        distributionAuthority(FP)
      ).status
    ).toBe('REFUSED');
    expect(
      DirectTraversalSession.open(compilation, elementId, 'DISTRIBUTION', distributionAuthority(FP))
        .status
    ).toBe('READY');

    const wrongFingerprint = { ...distributionAuthority(FP), datasetFingerprint: '0'.repeat(64) };
    const mismatch = DirectTraversalSession.open(
      compilation,
      elementId,
      'DISTRIBUTION',
      wrongFingerprint
    );
    expect(mismatch.status).toBe('REFUSED');
    if (mismatch.status === 'REFUSED') expect(mismatch.code).toBe('DETAIL_AUTHORITY_MISMATCH');

    const wrongFamily = { ...distributionAuthority(FP), representationFamily: 'CLUSTER' as const };
    expect(
      DirectTraversalSession.open(compilation, elementId, 'DISTRIBUTION', wrongFamily).status
    ).toBe('REFUSED');

    const uncovered = DirectTraversalSession.open(
      compilation,
      elementId,
      'TOPOLOGICAL_CLUSTERING',
      distributionAuthority(FP)
    );
    expect(uncovered.status).toBe('REFUSED');
    if (uncovered.status === 'REFUSED')
      expect(uncovered.code).toBe('UNSUPPORTED_PHENOMENON_FAMILY');
  });

  it('subset page resolves members from authority and re-requests identically', async () => {
    const compilation = compileDistribution();
    const elementId = compilation.plan.elements[0]?.id ?? '';
    const port = fakePort();
    const opened = DirectTraversalSession.open(
      compilation,
      elementId,
      'DISTRIBUTION',
      distributionAuthority(FP)
    );
    if (opened.status !== 'READY') throw new Error('setup failed');

    const first = await opened.value.requestSubsetPage(port, 4, 0);
    expect(first.status).toBe('READY');
    if (first.status !== 'READY') throw new Error('setup failed');
    expect(first.value.observationIds).toEqual(['obs-0', 'obs-1', 'obs-2', 'obs-3']);
    expect(first.value.totalMemberCount).toBe(5);
    expect(opened.value.currentLevel).toBe('SUBSET');

    const second = await opened.value.requestSubsetPage(port, 4, 0);
    expect(second.status).toBe('READY');
    if (second.status !== 'READY') throw new Error('setup failed');
    expect(second.value.pageId).toBe(first.value.pageId);
    expect(port.requests).toHaveLength(2);
  });

  it('exact observation inspection carries dual-decision lineage', async () => {
    const port = fakePort();
    const { session } = await openReadySession(port);

    const inspected = await session.inspectObservation(port, 'obs-1');
    expect(inspected.status).toBe('READY');
    if (inspected.status !== 'READY') throw new Error('setup failed');
    expect(inspected.value.observationId).toBe('obs-1');
    expect(inspected.value.fields).toMatchObject({ id: 'obs-1' });
    expect(inspected.value.lineage).toMatchObject({
      datasetFingerprint: FP,
      detailDecisionId: 'decision-distribution-dse2',
      representationFamily: 'DISTRIBUTION',
      traversalId: session.binding.traversalId,
    });
    expect(session.currentLevel).toBe('OBSERVATION');

    expect(session.returnToParent()).toBe('SUBSET');

    const unknown = await session.inspectObservation(port, 'obs-9');
    expect(unknown.status).toBe('REFUSED');
    if (unknown.status === 'REFUSED') expect(unknown.code).toBe('OBSERVATION_NOT_IN_PAGE');
  });

  it('return restores the exact parent and refuses post-return inspection', async () => {
    const port = fakePort();
    const { session } = await openReadySession(port);
    const inspected = await session.inspectObservation(port, 'obs-0');
    expect(inspected.status).toBe('READY');

    expect(session.returnToParent()).toBe('SUBSET');
    expect(session.currentLevel).toBe('SUBSET');

    const again = await session.inspectObservation(port, 'obs-0');
    expect(again.status).toBe('READY');

    expect(session.returnToParent()).toBe('SUBSET');
    expect(session.returnToParent()).toBe('STRUCTURE');
    expect(session.returnToParent()).toBe('STRUCTURE');

    const stale = await session.inspectObservation(port, 'obs-0');
    expect(stale.status).toBe('REFUSED');
    if (stale.status === 'REFUSED') expect(stale.code).toBe('NO_ACTIVE_SUBSET');
  });

  it('evict retains identity via reconstruction descriptor; rebuild restores the page', async () => {
    const port = fakePort();
    const { session } = await openReadySession(port);
    const traversalId = session.binding.traversalId;

    const tokens = session.evictMaterialisedPages();
    expect(tokens).toHaveLength(1);
    expect(session.currentLevel).toBe('STRUCTURE');
    expect(session.binding.traversalId).toBe(traversalId);

    const stale = await session.inspectObservation(port, 'obs-0');
    expect(stale.status).toBe('REFUSED');

    const rebuilt = await session.rebuildPage(port, tokens[0] ?? '');
    expect(rebuilt.status).toBe('READY');
    if (rebuilt.status !== 'READY') throw new Error('setup failed');
    expect(rebuilt.value.observationIds).toEqual(['obs-0', 'obs-1', 'obs-2', 'obs-3']);
    expect(session.currentLevel).toBe('SUBSET');
    expect(session.binding.traversalId).toBe(traversalId);
  });

  it('rebuild refuses changed member identity and unknown tokens', async () => {
    const { session } = await openReadySession(fakePort());
    const tokens = session.evictMaterialisedPages();

    const changed = await session.rebuildPage(
      fakePort({ mode: 'CHANGED_MEMBERS' }),
      tokens[0] ?? ''
    );
    expect(changed.status).toBe('REFUSED');
    if (changed.status === 'REFUSED') expect(changed.code).toBe('REBUILD_IDENTITY_MISMATCH');

    const unknown = await session.rebuildPage(fakePort(), 'rebuild-unknown-token');
    expect(unknown.status).toBe('REFUSED');
    if (unknown.status === 'REFUSED') expect(unknown.code).toBe('UNKNOWN_RECONSTRUCTION_TOKEN');
  });

  it('refusal battery: no port, unregistered dataset, stale transport, and authority refusal', async () => {
    const compilation = compileDistribution();
    const elementId = compilation.plan.elements[0]?.id ?? '';
    const authority = distributionAuthority(FP);
    const open = () => {
      const outcome = DirectTraversalSession.open(
        compilation,
        elementId,
        'DISTRIBUTION',
        authority
      );
      if (outcome.status !== 'READY') throw new Error('setup failed');
      return outcome.value;
    };

    const noPort = await open().requestSubsetPage(null, 4, 0);
    expect(noPort.status).toBe('REFUSED');
    if (noPort.status === 'REFUSED') expect(noPort.code).toBe('NO_EXECUTION_PORT');

    const unregistered = await open().requestSubsetPage(fakePort({ registered: false }), 4, 0);
    expect(unregistered.status).toBe('REFUSED');
    if (unregistered.status === 'REFUSED') expect(unregistered.code).toBe('DATASET_NOT_RESIDENT');

    const stale = await open().requestSubsetPage(fakePort({ mode: 'STALE_GENERATION' }), 4, 0);
    expect(stale.status).toBe('REFUSED');

    const wrongFp = await open().requestSubsetPage(fakePort({ mode: 'WRONG_FINGERPRINT' }), 4, 0);
    expect(wrongFp.status).toBe('REFUSED');

    const refused = await open().requestSubsetPage(fakePort({ mode: 'REFUSED' }), 4, 0);
    expect(refused.status).toBe('REFUSED');
    if (refused.status === 'REFUSED') expect(refused.code).toBe('DETAIL_REFUSED');

    const mismatch = await open().requestSubsetPage(fakePort({ mode: 'IDENTITY_MISMATCH' }), 4, 0);
    expect(mismatch.status).toBe('REFUSED');
    if (mismatch.status === 'REFUSED') expect(mismatch.code).toBe('DETAIL_IDENTITY_MISMATCH');

    const overLimit = await open().requestSubsetPage(
      fakePort(),
      DIRECT_TRAVERSAL_PAGE_LIMIT_V1 + 1,
      0
    );
    expect(overLimit.status).toBe('REFUSED');
    if (overLimit.status === 'REFUSED') expect(overLimit.code).toBe('PAGE_LIMIT_EXCEEDED');

    const badOffset = await open().requestSubsetPage(fakePort(), 4, -1);
    expect(badOffset.status).toBe('REFUSED');
    if (badOffset.status === 'REFUSED') expect(badOffset.code).toBe('INVALID_PAGE_WINDOW');
  });

  it('cluster phenomenon traverses under the CLUSTER family', async () => {
    const snapshot = createClusteringSnapshot(FP);
    const compilation = compileDirectEmbodimentPlan({
      datasetFingerprint: FP,
      snapshot,
      context: createGroundedContext(),
      budget: DESKTOP_EXPANSIVE_BUDGET,
    });
    expect(compilation.boundedOverview.phenomenonCoverage).toContain('TOPOLOGICAL_CLUSTERING');

    const elementId = compilation.plan.elements[0]?.id ?? '';
    const authority: EstablishedDetailAuthorityV1 = {
      datasetFingerprint: FP,
      representationFamily: 'CLUSTER',
      decisionId: 'decision-cluster-dse2',
      generation: 7,
      datasetVersion: 3,
    };
    const opened = DirectTraversalSession.open(
      compilation,
      elementId,
      'TOPOLOGICAL_CLUSTERING',
      authority
    );
    expect(opened.status).toBe('READY');
    if (opened.status !== 'READY') throw new Error('setup failed');
    expect(opened.value.binding.representationFamily).toBe('CLUSTER');

    const page = await opened.value.requestSubsetPage(fakePort(), 2, 0);
    expect(page.status).toBe('READY');
  });
});

describe('DSE2: production entry point via AtlasCore', () => {
  function buildAtlas(): AtlasCore {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      val: i * 1.5,
      group: i % 2 === 0 ? 'A' : 'B',
    }));
    const ds = new Dataset(
      'dse2-e2e-dataset',
      [
        { name: 'val', type: ColumnType.NUMERIC },
        { name: 'group', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge as any });
    atlas.loadDataset(ds);
    atlas.commitInvestigationContext('ctx-dse2-e2e-001', {
      schemaVersion: 2,
      nodeId: 'ctx-dse2-e2e-001',
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'DSE2 end-to-end verification',
        currentTask: 'detail_resolution',
      },
    });
    return atlas;
  }

  it('compiles variants, opens traversal, and resolves a page through the aggregate', async () => {
    const atlas = buildAtlas();
    const fingerprint = atlas.dataset.fingerprint;
    const snapshot = createDistributionSnapshot(fingerprint);

    const pair = atlas.compileObligationPreservingVariants({ snapshot });
    expect(atlas.getActiveVariantPair()).toBe(pair);
    expect(atlas.getActiveDirectCompileResult()).toBe(pair.desktop);

    const elementId = pair.desktop.plan.elements[0]?.id ?? '';
    const session = atlas.openDirectTraversal(elementId, 'DISTRIBUTION', {
      datasetFingerprint: fingerprint,
      representationFamily: 'DISTRIBUTION',
      decisionId: 'decision-distribution-e2e',
      generation: 7,
      datasetVersion: 3,
    });
    expect(atlas.getActiveDirectTraversal()).toBe(session);

    const page = await session.requestSubsetPage(
      fakePort({ generation: 7, datasetVersion: 3 }),
      4,
      0
    );
    expect(page.status).toBe('READY');
    if (page.status === 'READY') {
      expect(page.value.traversalId).toBe(session.binding.traversalId);
    }
  });

  it('aggregate refuses traversal without an active compilation', () => {
    const atlas = buildAtlas();
    expect(() =>
      atlas.openDirectTraversal(
        'any-element',
        'DISTRIBUTION',
        distributionAuthority('0'.repeat(64))
      )
    ).toThrow();
  });
});
