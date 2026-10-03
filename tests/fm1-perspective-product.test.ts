import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  checkContextCompatibility,
  CONTEXT_INCOMPATIBLE,
  type CommittedInvestigationContextV2,
} from '../src/atlas/domain/CommittedInvestigationContext.ts';
import {
  computeIntentIdentity,
  type InvestigationIntentV1,
} from '../src/atlas/domain/InvestigationIntent.ts';
import {
  INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
} from '../src/atlas/domain/InvestigationPerspective.ts';
import { createRequirementsFromContext } from '../src/moneta/representation/RepresentationRequirements.ts';
import {
  compileFormaSpatialSlice,
} from '../src/moneta/forma/FormaSpatialCompiler.ts';
import { compileFormaAdmission } from '../src/moneta/forma/FormaAdmission.ts';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.ts';
import {
  normalizeEnvelopeToSnapshot,
  type EvidenceReferenceTupleV1,
} from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';

describe('FM1: Question & Perspective Product Path Integration', () => {
  const dummyEvidence: EvidenceReferenceTupleV1[] = [
    {
      datasetFingerprint: 'sha256-dataset-fm1-test-abc',
      kernelVersion: '1.0.0',
      bundleContentDigest: 'sha256-bundle-001',
      receiptId: 'receipt-fm1-001',
      receiptContentDigest: 'sha256-receipt-digest-001',
      consumerId: 'descriptive-summary/v1',
      requirementProfileId: 'profile-001',
      requirementProfileDigest: 'sha256-profile-digest-001',
      admissionPolicyId: 'policy-001',
      admissionPolicyDigest: 'sha256-policy-digest-001',
    },
  ];

  const sampleEnvelope: SemanticEmbodimentEnvelopeV1 = {
    schemaVersion: 1,
    datasetFingerprint: 'sha256-dataset-fm1-test-abc',
    candidateId: 'AGGREGATE_VOLUME',
    representationFamily: 'AGGREGATE',
    analyticalMethod: {
      name: 'aggregateVolume',
      version: '1.0.0',
      parameters: { groupingFields: ['tier'], measure: 'COUNT' },
    },
    approximation: {
      mode: 'EXACT',
      representedRowCount: 4,
    },
    informationContract: {
      preserves: ['exact-metric-values'],
      loses: ['individual-observation-identity'],
    },
    resource: {
      sourceRowCount: 4,
      elementCount: 4,
      maxElementCount: 4096,
    },
    provenance: {
      kernelVersion: '1.0.0',
      algorithmVersion: '1.0.0',
      decisionId: 'decision-fm1-123',
      decisionModelVersion: 'bootstrap-v5',
      decisionModelArtifactHash: undefined,
    },
    result: {
      status: 'READY',
      payload: {
        kind: 'AGGREGATE_VOLUME',
        data: {
          groupingFields: ['tier'],
          measure: { function: 'COUNT' },
          groups: [
            { semanticId: 'tier-1', key: 'Alpha', count: 100 },
            { semanticId: 'tier-2', key: 'Beta', count: 200 },
            { semanticId: 'tier-3', key: 'Gamma', count: 300 },
            { semanticId: 'tier-4', key: 'Delta', count: 400 },
          ],
        },
      },
    },
  };

  const sampleSnapshot = normalizeEnvelopeToSnapshot(sampleEnvelope, dummyEvidence);
  const kb0Manifest = createKB0Manifest();

  function makeSampleDataset(): Dataset {
    return new Dataset(
      'sample-ds',
      [
        { name: 'val1', type: ColumnType.NUMERIC },
        { name: 'val2', type: ColumnType.NUMERIC },
      ],
      [
        { val1: 1.0, val2: 2.0 },
        { val1: 3.0, val2: 4.0 },
        { val1: 5.0, val2: 6.0 },
        { val1: 7.0, val2: 8.0 },
      ]
    );
  }

  describe('AtlasCore and Investigation context lifecycle', () => {
    test('loading a dataset initializes active context with CLAIM_BEARING purpose bound to root node', () => {
      const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
      atlas.loadDataset(makeSampleDataset());

      const activeContext = atlas.getActiveInvestigationContext();
      expect(activeContext).toBeDefined();
      expect(activeContext?.schemaVersion).toBe(2);
      expect(activeContext?.epistemicPurpose).toBe('CLAIM_BEARING');
      expect(activeContext?.nodeId).toContain(':v1');
    });

    test('committing a new context establishes fresh epoch and content-addressed contextId', () => {
      const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
      atlas.loadDataset(makeSampleDataset());
      const rootNodeId = atlas.getActiveInvestigationContext()!.nodeId;

      const act1 = atlas.commitInvestigationContext(rootNodeId, {
        schemaVersion: 2,
        nodeId: rootNodeId,
        epistemicPurpose: 'CLAIM_BEARING',
        intent: {
          schemaVersion: 1,
          researchQuestion: 'Does X drive Y?',
          variablesOfInterest: ['val1', 'val2'],
          currentTask: 'distribution-analysis',
        },
      });

      expect(act1.contextId).toMatch(/^sha256-committed-context-v2-/);
      expect(act1.revision).toBe(2);

      const active = atlas.getActiveInvestigationContext();
      expect(active?.intent.researchQuestion).toBe('Does X drive Y?');
      expect(active?.intent.variablesOfInterest).toEqual(['val1', 'val2']);
    });

    test('changing epistemic purpose invalidates stale async bindings with CONTEXT_INCOMPATIBLE', () => {
      const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
      atlas.loadDataset(makeSampleDataset());
      const rootNodeId = atlas.getActiveInvestigationContext()!.nodeId;

      const claimAct = atlas.commitInvestigationContext(rootNodeId, {
        schemaVersion: 2,
        nodeId: rootNodeId,
        epistemicPurpose: 'CLAIM_BEARING',
        intent: { schemaVersion: 1, researchQuestion: 'Verification task' },
      });

      const bindingBefore = {
        contextId: claimAct.contextId,
        nodeId: claimAct.nodeId,
        activationEpoch: claimAct.activationEpoch,
      };

      // Switch to EXPLORATORY_ABDUCTION
      atlas.commitInvestigationContext(rootNodeId, {
        schemaVersion: 2,
        nodeId: rootNodeId,
        epistemicPurpose: 'EXPLORATORY_ABDUCTION',
        intent: { schemaVersion: 1, researchQuestion: 'Verification task' },
      });

      const activeAct = atlas.aggregate.contextLedger.current();
      const compatibility = checkContextCompatibility(bindingBefore, activeAct);
      expect(compatibility.ok).toBe(false);
      if (!compatibility.ok) {
        expect(compatibility.code).toBe(CONTEXT_INCOMPATIBLE);
      }
    });
  });

  describe('Question-aware representation arbitration and provenance', () => {
    test('arbitrateRepresentation captures context, intent, and research question in provenance and explanation', () => {
      const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
      atlas.loadDataset(makeSampleDataset());
      const rootNodeId = atlas.getActiveInvestigationContext()!.nodeId;

      atlas.commitInvestigationContext(rootNodeId, {
        schemaVersion: 2,
        nodeId: rootNodeId,
        epistemicPurpose: 'CLAIM_BEARING',
        intent: {
          schemaVersion: 1,
          researchQuestion: 'What is the empirical distribution of val1?',
          variablesOfInterest: ['val1'],
          currentTask: 'distribution-analysis',
        },
      });

      const decision = atlas.arbitrateRepresentation();
      expect(decision).toBeDefined();
      expect(decision.provenance.contextIdentity).toMatch(/^sha256-committed-context-v2-/);
      expect(decision.provenance.intentIdentity).toMatch(/^sha256-intent-v1-/);
      expect(decision.explanation).toContain('What is the empirical distribution of val1?');
    });

    test('metamorphic test: irrelevant whitespace in intent yields identical canonical identity and decision', () => {
      const intentWithWhitespace: InvestigationIntentV1 = {
        schemaVersion: 1,
        researchQuestion: '   Are groups separated?   ',
        hypothesis: '  Hypothesis A  ',
      };
      const cleanIntent: InvestigationIntentV1 = {
        schemaVersion: 1,
        researchQuestion: 'Are groups separated?',
        hypothesis: 'Hypothesis A',
      };

      expect(computeIntentIdentity(intentWithWhitespace)).toBe(computeIntentIdentity(cleanIntent));
    });

    test('known-answer test: two materially different research tasks yield distinct requirements and rankings', () => {
      const contextDistribution: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'node-dist',
        epistemicPurpose: 'CLAIM_BEARING',
        intent: {
          schemaVersion: 1,
          currentTask: 'distribution-analysis',
          variablesOfInterest: ['val1'],
        },
      };

      const contextClusters: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'node-clust',
        epistemicPurpose: 'CLAIM_BEARING',
        intent: {
          schemaVersion: 1,
          currentTask: 'cluster-comparison',
          variablesOfInterest: ['val1', 'val2'],
        },
      };

      const reqDistribution = createRequirementsFromContext(contextDistribution);
      const reqClusters = createRequirementsFromContext(contextClusters);

      expect(reqDistribution.task).toBe('distribution-analysis');
      expect(reqClusters.task).toBe('cluster-comparison');
      expect(reqDistribution.primaryDimensions).toEqual(['val1']);
      expect(reqClusters.primaryDimensions).toEqual(['val1', 'val2']);
      expect(reqDistribution.preservationGoals).not.toEqual(reqClusters.preservationGoals);
    });

    test('representation decision reflects perspectiveIdentity when a perspective is active', () => {
      const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
      atlas.loadDataset(makeSampleDataset());

      atlas.setInvestigationPerspective({
        schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
        mode: 'foreground',
        temporalForegrounding: 'recency',
      });

      const decision = atlas.arbitrateRepresentation();
      expect(decision.provenance.perspectiveIdentity).toMatch(/^sha256-perspective-v1-/);
    });
  });

  describe('Perspective foregrounding in Forma without analytical mutation', () => {
    test('recency vs historical vs uncertainty perspective adapts visual encoding while preserving analytical snapshot', () => {
      const baseContext: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'node-perspective-01',
        epistemicPurpose: 'CLAIM_BEARING',
        intent: {
          schemaVersion: 1,
          researchQuestion: 'Do metric tiers differ?',
        },
      };

      const recencyContext: CommittedInvestigationContextV2 = {
        ...baseContext,
        perspective: {
          schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
          mode: 'foreground',
          temporalForegrounding: 'recency',
        },
      };

      const historicalContext: CommittedInvestigationContextV2 = {
        ...baseContext,
        perspective: {
          schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
          mode: 'foreground',
          temporalForegrounding: 'historical',
        },
      };

      const uncertaintyContext: CommittedInvestigationContextV2 = {
        ...baseContext,
        perspective: {
          schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
          mode: 'foreground',
          uncertaintyForegrounding: 'interval',
        },
      };

      const sliceRecency = compileFormaSpatialSlice(sampleSnapshot, recencyContext, kb0Manifest, 'SPATIAL_SCATTER_V1');
      const sliceHistorical = compileFormaSpatialSlice(sampleSnapshot, historicalContext, kb0Manifest, 'SPATIAL_SCATTER_V1');
      const sliceUncertainty = compileFormaSpatialSlice(sampleSnapshot, uncertaintyContext, kb0Manifest, 'SPATIAL_SCATTER_V1');

      expect(sliceRecency.status).toBe('COMPILED');
      expect(sliceHistorical.status).toBe('COMPILED');
      expect(sliceUncertainty.status).toBe('COMPILED');

      if (
        sliceRecency.status !== 'COMPILED' ||
        sliceHistorical.status !== 'COMPILED' ||
        sliceUncertainty.status !== 'COMPILED'
      ) {
        return;
      }

      // CRITICAL SCIENTIFIC INVARIANT: Snapshot identity and analytical coverage are 100% invariant
      expect(sliceRecency.slice.snapshotId).toBe(sampleSnapshot.snapshotId);
      expect(sliceHistorical.slice.snapshotId).toBe(sampleSnapshot.snapshotId);
      expect(sliceUncertainty.slice.snapshotId).toBe(sampleSnapshot.snapshotId);

      // Node count is untouched: no rows/nodes filtered
      expect(sliceRecency.slice.elements.length).toBe(sampleSnapshot.body.nodes.length);
      expect(sliceHistorical.slice.elements.length).toBe(sampleSnapshot.body.nodes.length);
      expect(sliceUncertainty.slice.elements.length).toBe(sampleSnapshot.body.nodes.length);

      // Visual encodings legitimately differ based on perspective
      // In recency: node at index 3 (recent) is amber (#f59e0b) with opacity 1.0, while node 0 is opacity 0.45
      expect(sliceRecency.slice.elements[3].visualEncoding.colorHex).toBe('#f59e0b');
      expect(sliceRecency.slice.elements[3].visualEncoding.opacity).toBe(1.0);
      expect(sliceRecency.slice.elements[0].visualEncoding.opacity).toBe(0.45);

      // In historical: node at index 0 (early) is purple (#a855f7) with opacity 1.0, while node 3 is opacity 0.45
      expect(sliceHistorical.slice.elements[0].visualEncoding.colorHex).toBe('#a855f7');
      expect(sliceHistorical.slice.elements[0].visualEncoding.opacity).toBe(1.0);
      expect(sliceHistorical.slice.elements[3].visualEncoding.opacity).toBe(0.45);

      // In uncertainty: channel is interval-bounded
      expect(sliceUncertainty.slice.elements[0].channel).toBe('spatial_radial_scatter_interval_bounded');

      // Reverse explanation explicitly includes perspective notes
      expect(sliceRecency.slice.reverseExplanation[3].rationale).toContain('recency foregrounded');
      expect(sliceHistorical.slice.reverseExplanation[0].rationale).toContain('historical foregrounded');
      expect(sliceUncertainty.slice.reverseExplanation[0].rationale).toContain('interval bounded');
    });

    test('request_derivation perspective annotates explanation while leaving snapshot unchanged', () => {
      const derivationContext: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'node-deriv',
        epistemicPurpose: 'CLAIM_BEARING',
        intent: { schemaVersion: 1 },
        perspective: {
          schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
          mode: 'request_derivation',
        },
      };

      const outcome = compileFormaSpatialSlice(sampleSnapshot, derivationContext, kb0Manifest);
      expect(outcome.status).toBe('COMPILED');
      if (outcome.status === 'COMPILED') {
        expect(outcome.slice.snapshotId).toBe(sampleSnapshot.snapshotId);
        expect(outcome.slice.reverseExplanation[0].rationale).toContain('derivation requested');
      }
    });

    test('population-narrowing view fields throw and refuse fail-closed', () => {
      const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
      atlas.loadDataset(makeSampleDataset());

      for (const forbiddenKey of ['filter', 'threshold', 'limit', 'predicate', 'subset']) {
        expect(() =>
          atlas.setInvestigationPerspective({
            schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
            mode: 'foreground',
            [forbiddenKey]: 'any-value',
          })
        ).toThrow(/narrow the analysed population/);
      }
    });
  });

  describe('FormaAdmission context binding and plan identity', () => {
    test('distinct contexts on the same node produce distinct planIds and admissionIds', () => {
      const contextClaim: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'node-same',
        epistemicPurpose: 'CLAIM_BEARING',
        intent: { schemaVersion: 1, researchQuestion: 'Verification' },
      };

      const contextExploratory: CommittedInvestigationContextV2 = {
        schemaVersion: 2,
        nodeId: 'node-same',
        epistemicPurpose: 'EXPLORATORY_ABDUCTION',
        intent: { schemaVersion: 1, researchQuestion: 'Verification' },
      };

      const outcomeClaim = compileFormaAdmission(sampleSnapshot, contextClaim, 'PRODUCTION');
      const outcomeExploratory = compileFormaAdmission(sampleSnapshot, contextExploratory, 'PRODUCTION');

      expect(outcomeClaim.status).toBe('ADMITTED');
      expect(outcomeExploratory.status).toBe('ADMITTED');

      if (outcomeClaim.status === 'ADMITTED' && outcomeExploratory.status === 'ADMITTED') {
        expect(outcomeClaim.result.body.planId).not.toBe(outcomeExploratory.result.body.planId);
        expect(outcomeClaim.result.admissionId).not.toBe(outcomeExploratory.result.admissionId);
      }
    });
  });

  describe('Historical investigation digest invariance', () => {
    test('investigation digest is unaffected by context ledger presence', async () => {
      const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
      atlas.loadDataset(makeSampleDataset());

      const digest1 = await atlas.computeDigest();

      // Add perspectives and contexts to the aggregate
      atlas.setInvestigationPerspective({
        schemaVersion: INVESTIGATION_PERSPECTIVE_SCHEMA_V1,
        mode: 'foreground',
        temporalForegrounding: 'recency',
      });

      const digest2 = await atlas.computeDigest();

      // Digest must be strictly invariant
      expect(digest2).toBe(digest1);
    });
  });
});
