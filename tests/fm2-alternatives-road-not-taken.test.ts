import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

describe('FM2: Alternative-Aware Moneta / Road Not Taken', () => {
  function makeMultiDimensionalDataset(): Dataset {
    const rows = [];
    for (let i = 0; i < 25; i++) {
      rows.push({
        dim1: i * 1.5,
        dim2: (i % 5) * 2.0,
        category: i % 2 === 0 ? 'A' : 'B',
      });
    }
    return new Dataset(
      'multi-dim-ds',
      [
        { name: 'dim1', type: ColumnType.NUMERIC },
        { name: 'dim2', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
  }

  function makeTimeSeriesDataset(): Dataset {
    return new Dataset(
      'time-series-ds',
      [
        { name: 'timestamp', type: ColumnType.TEMPORAL },
        { name: 'metric', type: ColumnType.NUMERIC },
      ],
      [
        { timestamp: '2026-01-01T00:00:00Z', metric: 10 },
        { timestamp: '2026-01-02T00:00:00Z', metric: 20 },
        { timestamp: '2026-01-03T00:00:00Z', metric: 15 },
        { timestamp: '2026-01-04T00:00:00Z', metric: 30 },
      ]
    );
  }

  test('populates AlternativeCandidate list with eligibility, margins, and shared semantic anchors', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    const decision = atlas.arbitrateRepresentation();
    expect(decision).toBeDefined();
    expect(decision.alternatives).toBeDefined();
    expect(Array.isArray(decision.alternatives)).toBe(true);
    expect(decision.alternatives!.length).toBeGreaterThan(0);

    // atlasCore method
    const alternatives = atlas.getRepresentationAlternatives();
    expect(alternatives.length).toBe(decision.alternatives!.length);

    // Verify candidate attributes
    for (const alt of alternatives) {
      expect(typeof alt.candidateId).toBe('string');
      expect(typeof alt.family).toBe('string');
      expect(typeof alt.layout).toBe('string');
      expect(typeof alt.score).toBe('number');
      expect(alt.scoreMarginToWinner).toBeGreaterThanOrEqual(0);
      expect([
        'ELIGIBLE',
        'NEAR_MISS',
        'AMBIGUOUS',
        'ABSTAIN',
        'DISQUALIFIED',
      ]).toContain(alt.eligibility);
      expect(typeof alt.reason).toBe('string');
      expect(typeof alt.hardPassed).toBe('boolean');

      // Shared semantic anchors
      expect(alt.sharedSemanticAnchors).toBeDefined();
      expect(alt.sharedSemanticAnchors).toContain('numeric_dimensions');
      expect(alt.sharedSemanticAnchors).toContain('categorical_dimensions');
    }
  });

  test('previewAlternative returns embodiment and candidate without mutating active state or graph', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    atlas.arbitrateRepresentation();
    const alternatives = atlas.getRepresentationAlternatives();
    expect(alternatives.length).toBeGreaterThan(0);

    const activeDecisionBefore = atlas.activeRepresentationDecision;
    const activeStrategyBefore = atlas.activeSpatialStrategy;
    const graphNodesBefore = atlas.toState().investigationGraph?.nodes.length ?? 0;
    const graphEdgesBefore = atlas.toState().investigationGraph?.edges.length ?? 0;

    const targetAlt = alternatives[0];
    const preview = atlas.previewAlternative(targetAlt.candidateId);

    expect(preview).toBeDefined();
    expect(preview.candidate.candidateId).toBe(targetAlt.candidateId);
    expect(preview.embodiment.primaryLayout).toBe(targetAlt.layout);
    expect(preview.embodiment.spatialStrategy.id).toContain(targetAlt.candidateId);
    expect(preview.embodiment.spatialStrategy.provenance.datasetFingerprint).toBe(
      atlas.datasetFingerprint
    );

    // Assert strictly non-mutating
    expect(atlas.activeRepresentationDecision).toBe(activeDecisionBefore);
    expect(atlas.activeSpatialStrategy).toBe(activeStrategyBefore);
    expect(atlas.toState().investigationGraph?.nodes.length).toBe(graphNodesBefore);
    expect(atlas.toState().investigationGraph?.edges.length).toBe(graphEdgesBefore);
  });

  test('compareAlternative returns active decision, candidate, and shared anchors', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    atlas.arbitrateRepresentation();
    const alternatives = atlas.getRepresentationAlternatives();
    const targetAlt = alternatives[0];

    const comparison = atlas.compareAlternative(targetAlt.candidateId);
    expect(comparison.current).toBe(atlas.activeRepresentationDecision);
    expect(comparison.alternative.candidateId).toBe(targetAlt.candidateId);
    expect(comparison.sharedAnchors).toEqual(targetAlt.sharedSemanticAnchors);
    expect(comparison.sharedAnchors).toContain('numeric_dimensions');
  });

  test('branchToAlternative fails closed when attempting to branch to a disqualified candidate', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    // Time series dataset causes non-temporal or high-dimension candidates to be disqualified
    const ds = makeTimeSeriesDataset();
    atlas.loadDataset(ds);

    atlas.arbitrateRepresentation();
    const alternatives = atlas.getRepresentationAlternatives();
    const disqualified = alternatives.find((a) => a.eligibility === 'DISQUALIFIED');

    // If there is a disqualified alternative, branching to it MUST throw
    if (disqualified) {
      const nodesBefore = atlas.toState().investigationGraph?.nodes.length ?? 0;
      expect(() => atlas.branchToAlternative(disqualified.candidateId)).toThrow(
        /Cannot branch to disqualified alternative/
      );
      expect(atlas.toState().investigationGraph?.nodes.length).toBe(nodesBefore);
    }
  });

  test('branchToAlternative creates child branch node with branches_from edge, updates active representation and preserves parent state', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    // Initial arbitration
    atlas.arbitrateRepresentation();
    const alternatives = atlas.getRepresentationAlternatives();
    // Find an eligible or near-miss candidate to branch to
    const eligible = alternatives.find(
      (a) => a.eligibility !== 'DISQUALIFIED' && a.eligibility !== 'ABSTAIN'
    );
    expect(eligible).toBeDefined();

    const parentState = atlas.toState();
    const parentNodes = parentState.investigationGraph!.nodes;
    const parentActiveNodeId = parentState.investigationGraph!.activeNodeId!;
    const parentNodeRecord = parentNodes.find((n) => n.id === parentActiveNodeId)!;

    // Perform Road Not Taken branch
    const childNode = atlas.branchToAlternative(eligible!.candidateId);

    expect(childNode).toBeDefined();
    expect(childNode.parentId).toBe(parentActiveNodeId);
    expect(childNode.kind).toBe('representation_decision');
    expect(childNode.label).toContain(`Road Not Taken: ${eligible!.family}`);
    expect(childNode.metadata?.branchedFromAlternative).toBe(eligible!.candidateId);

    // State inspection after branch
    const postState = atlas.toState();
    const postGraph = postState.investigationGraph!;

    // Child node added and active
    expect(postGraph.activeNodeId).toBe(childNode.id);
    expect(postGraph.nodes.some((n) => n.id === childNode.id)).toBe(true);

    // Verify DAG edge
    const branchEdge = postGraph.edges.find(
      (e) => e.source === parentActiveNodeId && e.target === childNode.id
    );
    expect(branchEdge).toBeDefined();
    expect(branchEdge!.relationship).toBe('branches_from');

    // Active representation updated
    expect(atlas.activeRepresentationDecision?.chosenCandidateId).toBe(eligible!.candidateId);
    expect(atlas.activeRepresentationDecision?.chosenFamily).toBe(eligible!.family);
    expect(atlas.activeSpatialStrategy?.macroLayout.layout).toBe(eligible!.layout);

    // Verify parent node remains bitwise invariant
    const parentNodeAfter = postGraph.nodes.find((n) => n.id === parentActiveNodeId)!;
    expect(parentNodeAfter.id).toBe(parentNodeRecord.id);
    expect(parentNodeAfter.label).toBe(parentNodeRecord.label);
    expect(parentNodeAfter.datasetVersion).toBe(parentNodeRecord.datasetVersion);
    expect(parentNodeAfter.datasetFingerprint).toBe(parentNodeRecord.datasetFingerprint);
    expect(parentNodeAfter.timestamp).toBe(parentNodeRecord.timestamp);
  });

  test('branchToAlternative commits child context with optional intent override', () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    const activeNodeId = atlas.toState().investigationGraph!.activeNodeId!;
    atlas.commitInvestigationContext(activeNodeId, {
      schemaVersion: 2,
      nodeId: activeNodeId,
      epistemicPurpose: 'EXPLORATORY_ABDUCTION',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Initial question: dimension variance?',
        hypothesis: 'Primary dimensions drive variance.',
      },
      perspective: {
        schemaVersion: 1,
        mode: 'foreground',
      },
    });

    atlas.arbitrateRepresentation();
    const alternatives = atlas.getRepresentationAlternatives();
    const eligible = alternatives.find(
      (a) => a.eligibility !== 'DISQUALIFIED' && a.eligibility !== 'ABSTAIN'
    );
    expect(eligible).toBeDefined();

    // Branch with intent override
    const childNode = atlas.branchToAlternative(eligible!.candidateId, {
      schemaVersion: 1,
      researchQuestion: 'Overridden question: alternative cluster structure?',
      hypothesis: 'Alternative layout surfaces clusters better.',
    });

    const activeContext = atlas.getActiveInvestigationContext();
    expect(activeContext).toBeDefined();
    expect(activeContext!.nodeId).toBe(childNode.id);
    expect(activeContext!.epistemicPurpose).toBe('EXPLORATORY_ABDUCTION');
    expect(activeContext!.intent.researchQuestion).toBe(
      'Overridden question: alternative cluster structure?'
    );
    expect(activeContext!.intent.hypothesis).toBe(
      'Alternative layout surfaces clusters better.'
    );
    expect(activeContext?.perspective?.mode).toBe('foreground');
  });

  test('digest determinism: branched investigation computes reproducible digest reflecting alternative embodiment', async () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeMultiDimensionalDataset();
    atlas.loadDataset(ds);

    atlas.arbitrateRepresentation();
    const alternatives = atlas.getRepresentationAlternatives();
    const eligible = alternatives.find(
      (a) => a.eligibility !== 'DISQUALIFIED' && a.eligibility !== 'ABSTAIN'
    );
    expect(eligible).toBeDefined();

    const digestBefore = await atlas.computeDigest();
    expect(typeof digestBefore).toBe('string');
    expect(digestBefore.length).toBeGreaterThan(0);

    atlas.branchToAlternative(eligible!.candidateId);

    const digestAfter = await atlas.computeDigest();
    expect(typeof digestAfter).toBe('string');
    expect(digestAfter).not.toBe(digestBefore);

    // Recomputing without mutation must produce identical digest
    const digestRecompute = await atlas.computeDigest();
    expect(digestRecompute).toBe(digestAfter);
  });
});
