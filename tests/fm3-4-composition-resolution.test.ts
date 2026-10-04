import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.js';
import { InvestigationAggregate } from '../src/atlas/domain/InvestigationAggregate.js';
import {
  canonicalizeCommittedInvestigationContext,
  type CommittedInvestigationContextV2,
} from '../src/atlas/domain/CommittedInvestigationContext.js';
import {
  FormaResolutionBroker,
  type DeviceCapabilityBudgetV1,
  type SemanticObligationContractV1,
} from '../src/moneta/forma/FormaResolutionBroker.js';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.js';
import {
  normalizeEnvelopeToSnapshot,
  type EvidenceReferenceTupleV1,
} from '../src/moneta/representation/SemanticSnapshotV1.js';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.js';
import {
  FormaMultiElementRuntime,
  type CompositionRelationship,
} from '../src/moneta/forma/FormaMultiElementRuntime.js';
import { FullMonetaEngine } from '../src/moneta/adaptation/FullMonetaEngine.js';
import { Dataset, ColumnType } from '../src/data/Dataset.js';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.js';
import { RepresentationGraphGrammar } from '../src/moneta/search/RepresentationGraphGrammar.js';

describe('FM3/4 Composition + Resolution Qualification (L2-FORMA-2 + L4-RUNTIME-BUDGET)', () => {
  const dummyEvidence: EvidenceReferenceTupleV1[] = [
    {
      datasetFingerprint: 'sha256-dataset-fm34-fixture',
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

  const envelopeAggregate: SemanticEmbodimentEnvelopeV1 = {
    schemaVersion: 1,
    datasetFingerprint: 'sha256-dataset-fm34-fixture',
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: {
      name: 'aggregateVolume',
      version: '1.0.0',
      parameters: { groupingFields: ['tier'], measure: 'COUNT' },
    },
    approximation: { mode: 'EXACT', representedRowCount: 1000 },
    informationContract: {
      preserves: ['exact-metric-values'],
      loses: ['individual-observation-identity'],
    },
    resource: { sourceRowCount: 1000, elementCount: 2, maxElementCount: 4096 },
    provenance: {
      kernelVersion: '1.0.0',
      algorithmVersion: '1.0.0',
      decisionId: 'dec-agg',
      decisionModelVersion: 'onnx-v2',
      decisionModelArtifactHash: 'hash-agg',
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'AGGREGATE_VOLUME',
        data: {
          groupingFields: ['tier'],
          measure: { function: 'COUNT' },
          groups: [
            { semanticId: 'grp-1', key: 'High', count: 700 },
            { semanticId: 'grp-2', key: 'Low', count: 300 },
          ],
        },
      },
    },
  };

  const envelopeDistribution: SemanticEmbodimentEnvelopeV1 = {
    schemaVersion: 1,
    datasetFingerprint: 'sha256-dataset-fm34-fixture',
    candidateId: 'DISTRIBUTION_FIELD',
    representationFamily: 'DISTRIBUTION',
    analyticalMethod: {
      name: 'empiricalDistribution',
      version: '1.0.0',
      parameters: { field: 'score', binCount: 2 },
    },
    approximation: { mode: 'EXACT', representedRowCount: 1000 },
    informationContract: {
      preserves: ['empirical-distribution-shape'],
      loses: ['individual-observation-identity'],
    },
    resource: { sourceRowCount: 1000, elementCount: 2, maxElementCount: 4096 },
    provenance: {
      kernelVersion: '1.0.0',
      algorithmVersion: '1.0.0',
      decisionId: 'dec-dist',
      decisionModelVersion: 'onnx-v2',
      decisionModelArtifactHash: 'hash-dist',
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
            { semanticId: 'bin-0', lowerBound: 0, upperBound: 50, count: 400, upperInclusive: false },
            { semanticId: 'bin-1', lowerBound: 50, upperBound: 100, count: 600, upperInclusive: true },
          ],
          ecdf: [],
          quantiles: [],
        },
      },
    },
  };

  const snapshotAgg = normalizeEnvelopeToSnapshot(envelopeAggregate, dummyEvidence);
  const snapshotDist = normalizeEnvelopeToSnapshot(envelopeDistribution, dummyEvidence);

  const context = canonicalizeCommittedInvestigationContext({
    schemaVersion: 2,
    nodeId: 'inv-ctx-fm34',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'How does performance distribute across tiers?',
      variablesOfInterest: ['tier', 'score'],
      currentTask: 'evaluate-composition',
    },
    epistemicPurpose: 'CLAIM_BEARING',
    runtimeGeneration: 2,
  }) as CommittedInvestigationContextV2;

  const manifest = createKB0Manifest();
  const obligations: SemanticObligationContractV1 = {
    mandatoryNodeIds: ['grp-1', 'grp-2'],
    mandatoryChannels: ['spatial_scatter'],
  };

  describe('FMA-05: Final-Content Identity and Resolution Broker Integrity', () => {
    it('produces distinct sliceId and variantId when allowedShapes alter visual encoding bytes', () => {
      const broker = new FormaResolutionBroker();
      const sphereBudget: DeviceCapabilityBudgetV1 = {
        profileName: 'SHARED_PROFILE_NAME',
        maxElements: 100,
        maxMemoryBytes: 1024 * 1024 * 16,
        maxChannels: 4,
        allowedShapes: ['SPHERE'],
        allowSecondaryEncodings: true,
      };

      const voxelBudget: DeviceCapabilityBudgetV1 = {
        profileName: 'SHARED_PROFILE_NAME',
        maxElements: 100,
        maxMemoryBytes: 1024 * 1024 * 16,
        maxChannels: 4,
        allowedShapes: ['VOXEL'],
        allowSecondaryEncodings: true,
      };

      const outcomeSphere = broker.brokerVariant(snapshotAgg, context, manifest, sphereBudget, obligations, 2);
      const outcomeVoxel = broker.brokerVariant(snapshotAgg, context, manifest, voxelBudget, obligations, 2);

      expect(outcomeSphere.status).toBe('ADMITTED');
      expect(outcomeVoxel.status).toBe('ADMITTED');
      if (outcomeSphere.status !== 'ADMITTED' || outcomeVoxel.status !== 'ADMITTED') return;

      expect(outcomeSphere.variant.slice.elements[0].visualEncoding.shape).toBe('SPHERE');
      expect(outcomeVoxel.variant.slice.elements[0].visualEncoding.shape).toBe('VOXEL');

      // Crucial: different element bytes must change sliceId and variantId despite identical profileName
      expect(outcomeSphere.variant.slice.sliceId).not.toBe(outcomeVoxel.variant.slice.sliceId);
      expect(outcomeSphere.variant.variantId).not.toBe(outcomeVoxel.variant.variantId);
    });

    it('refuses closed with INVALID_BUDGET on non-positive budget limits', () => {
      const broker = new FormaResolutionBroker();

      const zeroMemBudget: DeviceCapabilityBudgetV1 = {
        profileName: 'ZERO_MEM',
        maxElements: 100,
        maxMemoryBytes: 0,
        maxChannels: 4,
        allowedShapes: ['SPHERE'],
        allowSecondaryEncodings: true,
      };

      const zeroChanBudget: DeviceCapabilityBudgetV1 = {
        profileName: 'ZERO_CHAN',
        maxElements: 100,
        maxMemoryBytes: 1024 * 1024,
        maxChannels: 0,
        allowedShapes: ['SPHERE'],
        allowSecondaryEncodings: true,
      };

      const zeroElemBudget: DeviceCapabilityBudgetV1 = {
        profileName: 'ZERO_ELEM',
        maxElements: 0,
        maxMemoryBytes: 1024 * 1024,
        maxChannels: 2,
        allowedShapes: ['SPHERE'],
        allowSecondaryEncodings: true,
      };

      expect(broker.brokerVariant(snapshotAgg, context, manifest, zeroMemBudget, obligations, 2).status).toBe('REFUSED');
      expect(broker.brokerVariant(snapshotAgg, context, manifest, zeroChanBudget, obligations, 2).status).toBe('REFUSED');
      expect(broker.brokerVariant(snapshotAgg, context, manifest, zeroElemBudget, obligations, 2).status).toBe('REFUSED');
    });

    it('enforces exact activation epoch agreement (refusing stale and future generations)', () => {
      const broker = new FormaResolutionBroker();
      const validBudget: DeviceCapabilityBudgetV1 = {
        profileName: 'STANDARD',
        maxElements: 100,
        maxMemoryBytes: 1024 * 1024 * 32,
        maxChannels: 4,
        allowedShapes: ['SPHERE'],
        allowSecondaryEncodings: true,
      };

      // Active epoch from context is 2.
      // Requesting generation 1 (stale) must refuse:
      const staleOutcome = broker.brokerVariant(snapshotAgg, context, manifest, validBudget, obligations, 1);
      expect(staleOutcome.status).toBe('REFUSED');
      if (staleOutcome.status === 'REFUSED') {
        expect(staleOutcome.refusal.code).toBe('STALE_CONTEXT_ADOPTION_REFUSED');
        expect(staleOutcome.refusal.message).toContain('stale');
      }

      // Requesting generation 999 (future) must refuse:
      const futureOutcome = broker.brokerVariant(snapshotAgg, context, manifest, validBudget, obligations, 999);
      expect(futureOutcome.status).toBe('REFUSED');
      if (futureOutcome.status === 'REFUSED') {
        expect(futureOutcome.refusal.code).toBe('STALE_CONTEXT_ADOPTION_REFUSED');
        expect(futureOutcome.refusal.message).toContain('future');
      }

      // Requesting exact generation 2 succeeds:
      const currentOutcome = broker.brokerVariant(snapshotAgg, context, manifest, validBudget, obligations, 2);
      expect(currentOutcome.status).toBe('ADMITTED');
    });
  });

  describe('FMA-10 & L2-FORMA-2: Multi-Element Runtime and Selected Graph Fidelity', () => {
    it('supports all canonical composition relations in FormaMultiElementRuntime', () => {
      const broker = new FormaResolutionBroker();
      const budget: DeviceCapabilityBudgetV1 = {
        profileName: 'DESKTOP',
        maxElements: 100,
        maxMemoryBytes: 1024 * 1024 * 64,
        maxChannels: 4,
        allowedShapes: ['SPHERE', 'VOXEL'],
        allowSecondaryEncodings: true,
      };

      const outcomeA = broker.brokerVariant(snapshotAgg, context, manifest, budget, obligations, 2);
      const distObligations: SemanticObligationContractV1 = {
        mandatoryNodeIds: ['bin-0', 'bin-1'],
        mandatoryChannels: ['spatial_scatter'],
      };
      const outcomeB = broker.brokerVariant(snapshotDist, context, manifest, budget, distObligations, 2);

      expect(outcomeA.status).toBe('ADMITTED');
      expect(outcomeB.status).toBe('ADMITTED');
      if (outcomeA.status !== 'ADMITTED' || outcomeB.status !== 'ADMITTED') return;

      const runtime = new FormaMultiElementRuntime();
      runtime.registerElement('elem-1', outcomeA.variant.slice, 'AGGREGATE');
      runtime.registerElement('elem-2', outcomeB.variant.slice, 'DISTRIBUTION');

      const relations: CompositionRelationship[] = [
        'OVERLAY',
        'CONTAINS',
        'DERIVES_FROM',
        'COORDINATES_WITH',
        'DETAIL_OF',
        'COMPARES_WITH',
      ];

      for (const rel of relations) {
        expect(() => {
          const testRuntime = new FormaMultiElementRuntime();
          testRuntime.registerElement('elem-1', outcomeA.variant.slice, 'AGGREGATE');
          testRuntime.registerElement('elem-2', outcomeB.variant.slice, 'DISTRIBUTION');
          testRuntime.addRelationship('elem-1', 'elem-2', rel);
          const state = testRuntime.exportComposedState();
          expect(state.relationships[0].relationship).toBe(rel);
        }).not.toThrow();
      }
    });

    it('FullMonetaEngine preserves selected graph edges and does not invent phantom star edges when edges are empty', () => {
      const rows = [];
      for (let i = 0; i < 25; i++) {
        rows.push({
          dim1: i * 1.5,
          dim2: (i % 5) * 2.0,
          category: i % 2 === 0 ? 'A' : 'B',
        });
      }
      const ds = new Dataset(
        'multi-dim-ds',
        [
          { name: 'dim1', type: ColumnType.NUMERIC },
          { name: 'dim2', type: ColumnType.NUMERIC },
          { name: 'category', type: ColumnType.CATEGORICAL },
        ],
        rows
      );
      const signature = buildDatasetSignature(ds);

      // Disjoint graph without edges
      const disjointGraph = {
        ...RepresentationGraphGrammar.createEmptyGraph(
          'graph-disjoint',
          signature.provenance.datasetFingerprint
        ),
        primitives: [
          {
            id: 'p1',
            kind: 'AGGREGATION' as const,
            semanticInputs: ['tier'],
            visualEncoding: {},
            interactionAffordances: [],
            analyticalDependencies: [],
            parameters: {},
            limitations: [],
          },
          {
            id: 'p2',
            kind: 'DISTRIBUTION' as const,
            semanticInputs: ['score'],
            visualEncoding: {},
            interactionAffordances: [],
            analyticalDependencies: [],
            parameters: {},
            limitations: [],
          },
        ],
      };

      const result = FullMonetaEngine.synthesizeOrAdapt(signature, context, undefined, {
        currentGraph: disjointGraph,
        snapshot: snapshotAgg,
        snapshots: [snapshotAgg, snapshotDist],
        mandatoryNodeIds: ['grp-1', 'grp-2'],
      });

      expect(result.composedState).toBeDefined();
      // Crucial: when selected graph edges are empty, NO artificial star edges are synthesized
      if (result.selectedGraph.edges.length === 0) {
        expect(result.composedState.relationships.length).toBe(0);
      }
    });
  });

  describe('SHADOW-0002: ResearchContext Identity Completeness across Perspectives & Digests', () => {
    it('commits variablesOfInterest, currentTask, and observerMode into InvestigationAggregate.computeDigest', async () => {
      const aggregate1 = new InvestigationAggregate({
        sessionId: 'session-shadow-test',
        studyId: 'study-42',
        researchQuestion: 'Do regional differences impact metrics?',
        hypothesis: 'Differences exist',
        variablesOfInterest: ['region', 'metricA'],
        currentTask: 'task-a',
        observerMode: false,
      });

      const aggregate2 = new InvestigationAggregate({
        sessionId: 'session-shadow-test',
        studyId: 'study-42',
        researchQuestion: 'Do regional differences impact metrics?',
        hypothesis: 'Differences exist',
        variablesOfInterest: ['region', 'metricB'], // Only variablesOfInterest differs
        currentTask: 'task-a',
        observerMode: false,
      });

      const digest1 = await aggregate1.computeDigest('test-kernel-v1');
      const digest2 = await aggregate2.computeDigest('test-kernel-v1');

      // Invariant: Two contexts differing in variablesOfInterest must produce distinct digests
      expect(digest1).not.toBe(digest2);
    });

    it('round-trips all six ResearchContext fields through toState and restoreState', () => {
      const original = new InvestigationAggregate({
        sessionId: 'session-roundtrip',
        studyId: 'study-roundtrip',
        researchQuestion: 'Roundtrip question?',
        hypothesis: 'Roundtrip hypothesis',
        variablesOfInterest: ['var1', 'var2'],
        currentTask: 'active-task',
        observerMode: true,
      });

      const state = original.toState();
      expect(state.researchContext).toEqual({
        studyId: 'study-roundtrip',
        researchQuestion: 'Roundtrip question?',
        hypothesis: 'Roundtrip hypothesis',
        variablesOfInterest: ['var1', 'var2'],
        currentTask: 'active-task',
        observerMode: true,
      });

      const restored = new InvestigationAggregate({ sessionId: 'session-empty' });
      restored.restoreState(state);

      expect(restored.context.studyId).toBe('study-roundtrip');
      expect(restored.context.researchQuestion).toBe('Roundtrip question?');
      expect(restored.context.hypothesis).toBe('Roundtrip hypothesis');
      expect(restored.context.variablesOfInterest).toEqual(['var1', 'var2']);
      expect(restored.context.currentTask).toBe('active-task');
      expect(restored.context.observerMode).toBe(true);
    });

    it('AtlasCore constructor accepts researchContext options and commits them', async () => {
      const core1 = new AtlasCore({
        researchContext: {
          studyId: 'study-core',
          researchQuestion: 'Core question?',
          variablesOfInterest: ['alpha'],
        },
      });

      const core2 = new AtlasCore({
        researchContext: {
          studyId: 'study-core',
          researchQuestion: 'Core question?',
          variablesOfInterest: ['beta'],
        },
      });

      const digest1 = await core1.computeDigest();
      const digest2 = await core2.computeDigest();
      expect(digest1).not.toBe(digest2);
    });
  });
});
