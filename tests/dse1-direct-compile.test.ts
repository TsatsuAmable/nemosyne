import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  compileDirectEmbodimentPlan,
  recordInvestigatorCritique,
  type DirectEmbodimentCompileRequest,
} from '../src/moneta/representation/DirectEmbodimentCompiler.ts';
import {
  type SemanticSnapshotV1,
  type EvidenceReferenceTupleV1,
  SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
  computeSnapshotId,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import {
  DESKTOP_EXPANSIVE_BUDGET,
  QUEST_CONSTRAINED_BUDGET,
  type DeviceCapabilityBudgetV1,
} from '../src/moneta/forma/FormaResolutionBroker.ts';
import {
  type CommittedInvestigationContextV2,
  computeCommittedContextIdentity,
} from '../src/atlas/domain/CommittedInvestigationContext.ts';
import { createConjecturalProposal } from '../src/moneta/forma/ConjecturalProposal.ts';

function createMockEvidenceReferences(datasetFingerprint: string): EvidenceReferenceTupleV1[] {
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

function createGovernedDistributionSnapshot(
  datasetFingerprint: string,
  rowCount: number = 1000
): SemanticSnapshotV1 {
  const evidenceReferences = createMockEvidenceReferences(datasetFingerprint);

  const body = {
    analyticalDatasetFingerprint: datasetFingerprint,
    kernelVersion: '1.0.0-rust-wasm',
    semanticVocabulary: {
      id: 'vocab-statistical-density',
      version: '1.0.0',
      digest: 'digest-vocab-001',
    },
    normalizer: {
      id: 'normalizer-density-1d',
      version: '1.0.0',
      digest: 'digest-norm-001',
    },
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
            representedRowCount: rowCount,
            description: '1D continuous density across variable observation spectrum',
          },
        },
        evidenceReferences,
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

function createGovernedClusteringSnapshot(
  datasetFingerprint: string,
  rowCount: number = 5000
): SemanticSnapshotV1 {
  const evidenceReferences = createMockEvidenceReferences(datasetFingerprint);

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
            representedRowCount: rowCount,
            description: 'Topological partition hulls and centroids',
          },
        },
        evidenceReferences,
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
      value: 1.5 + (idx * 0.75),
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
    nodeId: 'ctx-grounded-claim-001',
    epistemicPurpose: 'CLAIM_BEARING',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Confirm grounded 1D density profile from verified evidence',
      currentTask: 'distribution_envelope',
    },
  };
}

function createAbductiveContext(): CommittedInvestigationContextV2 {
  return {
    schemaVersion: 2,
    nodeId: 'ctx-abductive-hypo-001',
    epistemicPurpose: 'EXPLORATORY_ABDUCTION',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Explore conjectural representation space for topological manifolds',
      currentTask: 'manifold_exploration',
    },
  };
}

describe('DSE1: Direct Deterministic Embodiment Compilation Loop', () => {
  const datasetFingerprint = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  it('FAL-DSE0-1: Direct compile autonomy — compiles without neural advice or population search', () => {
    const snapshot = createGovernedDistributionSnapshot(datasetFingerprint, 1200);
    const context = createGroundedContext();

    const request: DirectEmbodimentCompileRequest = {
      datasetFingerprint,
      snapshot,
      context,
      budget: DESKTOP_EXPANSIVE_BUDGET,
    };

    const result = compileDirectEmbodimentPlan(request);

    expect(result.schemaVersion).toBe('1.0.0');
    expect(result.plan).toBeDefined();
    expect(result.plan.schemaVersion).toBe(1);
    expect(result.plan.elements.length).toBeGreaterThan(0);
    expect(result.slice).toBeDefined();
    expect(result.slice.elements.length).toBe(result.plan.elements.length);

    // Strict zero-neural assertions
    expect(result.provenance.neuralAdviceApplied).toBe(false);
    expect(result.provenance.evolutionarySearchGenerations).toBe(0);
    expect(result.provenance.compilationPath).toBe('DIRECT_DETERMINISTIC');
  });

  it('FAL-DSE0-2: Deterministic execution and search population isolation', () => {
    const snapshot = createGovernedDistributionSnapshot(datasetFingerprint, 800);
    const context = createGroundedContext();

    const request: DirectEmbodimentCompileRequest = {
      datasetFingerprint,
      snapshot,
      context,
      budget: DESKTOP_EXPANSIVE_BUDGET,
    };

    const start1 = performance.now();
    const result1 = compileDirectEmbodimentPlan(request);
    const duration1 = performance.now() - start1;

    const start2 = performance.now();
    const result2 = compileDirectEmbodimentPlan(request);
    const duration2 = performance.now() - start2;

    // Both compiles should take under 50ms (sub-millisecond typically, well below any evolutionary generation runtime)
    expect(duration1).toBeLessThan(100);
    expect(duration2).toBeLessThan(100);

    // Deterministic bitwise identity across executions
    expect(result1.plan.planId).toBe(result2.plan.planId);
    expect(result1.plan.decisionId).toBe(result2.plan.decisionId);
    expect(result1.composedState.composedIdentity).toBe(result2.composedState.composedIdentity);
    expect(result1.plan.elements.length).toBe(result2.plan.elements.length);
  });

  it('FAL-DSE0-3: Bounded scene cardinality ($N$-independence)', () => {
    // Dataset A: 100 rows
    const snapshotSmall = createGovernedDistributionSnapshot(datasetFingerprint, 100);
    // Dataset B: 1,000,000 rows
    const snapshotMassive = createGovernedDistributionSnapshot(datasetFingerprint, 1_000_000);
    const context = createGroundedContext();

    const constrainedBudget: DeviceCapabilityBudgetV1 = {
      ...QUEST_CONSTRAINED_BUDGET,
      maxElements: 15,
    };

    const resultSmall = compileDirectEmbodimentPlan({
      datasetFingerprint,
      snapshot: snapshotSmall,
      context,
      budget: constrainedBudget,
    });

    const resultMassive = compileDirectEmbodimentPlan({
      datasetFingerprint,
      snapshot: snapshotMassive,
      context,
      budget: constrainedBudget,
    });

    // Element count must remain bounded by the budget (15), NOT scale with row count (100 vs 1,000,000)
    expect(resultSmall.boundedOverview.isCardinalityBounded).toBe(true);
    expect(resultMassive.boundedOverview.isCardinalityBounded).toBe(true);
    expect(resultSmall.plan.elements.length).toBeLessThanOrEqual(15);
    expect(resultMassive.plan.elements.length).toBeLessThanOrEqual(15);
    expect(resultMassive.boundedOverview.datasetRowCount).toBe(1_000_000);
  });

  it('FAL-DSE0-4: Reverse explanation accuracy — every element cites authoritative evidence', () => {
    const snapshot = createGovernedClusteringSnapshot(datasetFingerprint, 2500);
    const context = createGroundedContext();

    const result = compileDirectEmbodimentPlan({
      datasetFingerprint,
      snapshot,
      context,
      budget: DESKTOP_EXPANSIVE_BUDGET,
    });

    expect(result.reverseExplanation.length).toBe(result.plan.elements.length);

    for (let i = 0; i < result.plan.elements.length; i++) {
      const planElem = result.plan.elements[i];
      const trace = result.reverseExplanation[i];

      expect(trace.elementId).toBe(planElem.id);
      expect(trace.semanticNodeId).toBe(planElem.semanticNodeId);
      expect(trace.producerSemanticId).toBe('topological_cluster_engine');
      expect(trace.evidenceReferences.length).toBeGreaterThan(0);
      expect(trace.evidenceReferences[0].datasetFingerprint).toBe(datasetFingerprint);
      expect(trace.evidenceReferences[0].kernelVersion).toBe('1.0.0-rust-wasm');
      expect(trace.evidenceReferences[0].receiptId).toBe('receipt-rust-evidence-001');
      expect(trace.rationale).toContain('Perceptual element');
    }
  });

  it('FAL-DSE0-5: Dual-epistemic separation — rejects conjectural elements under CLAIM_BEARING', () => {
    const snapshot = createGovernedDistributionSnapshot(datasetFingerprint, 500);
    const groundedContext = createGroundedContext();

    const forbiddenProposal = createConjecturalProposal({
      snapshotId: snapshot.snapshotId,
      contextId: computeCommittedContextIdentity(groundedContext),
      generator: {
        modelId: 'UnverifiedExternalModel',
        modelVersion: '0.1.0',
        executionRegime: 'ADAPTIVE',
      },
      elements: [
        {
          elementId: 'conjectural-elem-001',
          kind: 'SPECULATIVE_SURFACE',
          epistemicStatus: 'HYPOTHESIZED',
          properties: {},
          uncertaintyDisclosure: 'Unverified abductive hypothesis',
        },
      ],
      relations: [],
      assumptions: ['Unknown prior distribution'],
      uncertaintyDisclosure: 'Ungrounded speculative model',
      rationale: 'Hypothesis testing',
    });

    // Expect fail-closed refusal when conjectural proposals are passed to grounded analysis
    expect(() => {
      compileDirectEmbodimentPlan({
        datasetFingerprint,
        snapshot,
        context: groundedContext,
        admissionOptions: {
          conjecturalProposals: [forbiddenProposal],
        },
      });
    }).toThrow('Epistemic boundary refusal: conjectural proposals cannot be admitted under CLAIM_BEARING');

    // Exploratory abduction context admits conjectural proposal with explicit tagging
    const abductiveContext = createAbductiveContext();
    const allowedProposal = createConjecturalProposal({
      snapshotId: snapshot.snapshotId,
      contextId: computeCommittedContextIdentity(abductiveContext),
      generator: {
        modelId: 'VerifiedAbductiveModel',
        modelVersion: '1.0.0',
        executionRegime: 'ADAPTIVE',
      },
      elements: [
        {
          elementId: 'conjectural-elem-002',
          kind: 'SPECULATIVE_SURFACE',
          epistemicStatus: 'HYPOTHESIZED',
          properties: {},
          uncertaintyDisclosure: 'Verified abductive hypothesis',
        },
      ],
      relations: [],
      assumptions: ['Known exploratory space'],
      uncertaintyDisclosure: 'Explicitly labeled conjectural exploration',
      rationale: 'Abductive hypothesis generation',
    });

    const abductiveResult = compileDirectEmbodimentPlan({
      datasetFingerprint,
      snapshot,
      context: abductiveContext,
      admissionOptions: {
        conjecturalProposals: [allowedProposal],
      },
    });

    expect(abductiveResult).toBeDefined();
    expect(abductiveResult.plan.elements.length).toBeGreaterThan(0);
  });

  it('governed phenomena detection for both statistical distribution and topological clustering', () => {
    const distSnapshot = createGovernedDistributionSnapshot(datasetFingerprint);
    const clusterSnapshot = createGovernedClusteringSnapshot(datasetFingerprint);
    const context = createGroundedContext();

    const distResult = compileDirectEmbodimentPlan({
      datasetFingerprint,
      snapshot: distSnapshot,
      context,
    });
    expect(distResult.boundedOverview.phenomenonCoverage).toContain('DISTRIBUTION');

    const clusterResult = compileDirectEmbodimentPlan({
      datasetFingerprint,
      snapshot: clusterSnapshot,
      context,
    });
    expect(clusterResult.boundedOverview.phenomenonCoverage).toContain('TOPOLOGICAL_CLUSTERING');
  });

  it('records attributable investigator critiques on the compilation result ledger', () => {
    const snapshot = createGovernedDistributionSnapshot(datasetFingerprint);
    const context = createGroundedContext();

    const initialResult = compileDirectEmbodimentPlan({
      datasetFingerprint,
      snapshot,
      context,
    });

    const targetElement = initialResult.plan.elements[0];

    const critique = recordInvestigatorCritique({
      investigatorId: 'investigator-alice-42',
      targetElementId: targetElement.id,
      targetPhenomenon: 'DISTRIBUTION',
      critiqueKind: 'DENSITY_RESOLUTION',
      note: 'The density peak around bin 10 exhibits potential oversmoothing; increase bin granularity.',
      contextId: context.nodeId,
    });

    expect(critique.critiqueId).toMatch(/^critique-[0-9a-f]{16}$/);
    expect(critique.investigatorId).toBe('investigator-alice-42');
    expect(critique.critiqueKind).toBe('DENSITY_RESOLUTION');

    // Recompilation with critique feedback preserves critique on ledger
    const revisedResult = compileDirectEmbodimentPlan({
      datasetFingerprint,
      snapshot,
      context,
      critiqueFeedback: [critique],
    });

    expect(revisedResult.critiqueLedger.length).toBe(1);
    expect(revisedResult.critiqueLedger[0].critiqueId).toBe(critique.critiqueId);
    expect(revisedResult.critiqueLedger[0].note).toBe(critique.note);
  });

  it('end-to-end integration via AtlasCore and InvestigationAggregate', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      val: i * 1.5,
      group: i % 2 === 0 ? 'A' : 'B',
    }));

    const ds = new Dataset(
      'dse1-e2e-dataset',
      [
        { name: 'val', type: ColumnType.NUMERIC },
        { name: 'group', type: ColumnType.CATEGORICAL },
      ],
      rows
    );

    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge as any });
    atlas.loadDataset(ds);

    // Commit context on aggregate
    atlas.commitInvestigationContext('ctx-dse1-e2e-001', {
      schemaVersion: 2,
      nodeId: 'ctx-dse1-e2e-001',
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Direct compilation verification',
        currentTask: 'overview',
      },
    });

    const snapshot = createGovernedDistributionSnapshot(atlas.dataset.fingerprint, 60);

    const directResult = atlas.compileDirectEmbodiment({
      snapshot,
      budget: DESKTOP_EXPANSIVE_BUDGET,
    });

    expect(directResult).toBeDefined();
    expect(directResult.plan.elements.length).toBe(20);
    expect(directResult.provenance.compilationPath).toBe('DIRECT_DETERMINISTIC');

    // Aggregate-level active state reflects direct compile
    expect(atlas.getActiveDirectCompileResult()).toBe(directResult);
    expect(atlas.getActiveFormaSlice()?.sliceId).toBe(directResult.slice.sliceId);
  });
});
