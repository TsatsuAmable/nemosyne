import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import '../setup-wasm.ts';
import { Dataset, ColumnType } from '../../src/data/Dataset.ts';
import { AtlasCore } from '../../src/atlas/AtlasCore.ts';
import { MonetaHypothesisEngine } from '../../src/moneta/representation/MonetaHypothesisEngine.ts';
import { representationDecisionToGraph } from '../../src/moneta/representation/RepresentationGraphAdapter.ts';
import { VRTopologyTranslator } from '../../src/moneta/VRTopologyTranslator.ts';
import { IntentCompiler } from '../../src/atlas/intent/IntentCompiler.ts';
import { DataOperationController } from '../../src/vr/coordinators/DataOperationController.ts';
import { TechnoCoreNode } from '../../src/vr/artifacts/TechnoCoreNode.ts';
import { ContextualTaskSurface } from '../../src/vr/ui/ContextualTaskSurface.ts';
import { InvestigatorJourneyCoordinator } from '../../src/vr/coordinators/InvestigatorJourneyCoordinator.ts';
import { WorldEventBus } from '../../src/utils/EventBus.ts';
import { makeKernelMockBridge } from '../helpers/kernelMock.ts';
import { makeFactProvider } from '../helpers/dracoFactsHelper.ts';

function createInvestigationDataset(): Dataset {
  const rows = Array.from({ length: 50 }, (_, i) => ({
    id: `tx_${i}`,
    amount: 10 + i * 5,
    risk: i % 5 === 0 ? 0.9 : 0.1,
    category: ['Retail', 'Tech', 'Energy', 'Finance'][i % 4],
    timestamp: `2026-08-25T00:${String(i).padStart(2, '0')}:00Z`,
  }));

  return new Dataset('InvestigationDataset', [
    { name: 'id', type: ColumnType.CATEGORICAL },
    { name: 'amount', type: ColumnType.NUMERIC },
    { name: 'risk', type: ColumnType.NUMERIC },
    { name: 'category', type: ColumnType.CATEGORICAL },
    { name: 'timestamp', type: ColumnType.TEMPORAL },
  ], rows);
}

describe('P1-U: Whole-Product 10-Phase Investigator Journey E2E', () => {
  it('executes full 10-phase canonical investigator lifecycle without analytical compromise', () => {
    const bus = new WorldEventBus();
    const journey = new InvestigatorJourneyCoordinator(bus);
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });

    // =========================================================================
    // Phase 1: LOAD — Ingest Canonical Dataset
    // =========================================================================
    expect(journey.currentPhase).toBe('LOAD');
    const dataset = createInvestigationDataset();
    atlas.loadDataset(dataset);
    expect(atlas.dataset.name).toBe(dataset.name);
    expect(atlas.dataset.rowCount).toBe(50);
    expect(atlas.aggregate.analytical.current.name).toBe('InvestigationDataset');

    journey.transitionTo('LOAD', { datasetName: dataset.name });
    expect(journey.state.activeDatasetName).toBe('InvestigationDataset');

    // =========================================================================
    // Phase 2: ORIENT — Establish Spatial Perspective & Baseline Topology
    // =========================================================================
    journey.transitionTo('ORIENT');
    expect(journey.currentPhase).toBe('ORIENT');
    const factProvider = makeFactProvider();
    const facts = factProvider.facts({ dataset });
    expect(facts).not.toBeNull();
    expect(facts!.rowCount).toBe(50);
    expect(facts!.numericColumns).toBe(2);

    // =========================================================================
    // Phase 3: EXPLORE_ASK — Natural Language / Intent Query
    // =========================================================================
    journey.transitionTo('EXPLORE_ASK');
    expect(journey.currentPhase).toBe('EXPLORE_ASK');
    const compiler = new IntentCompiler();
    const intentResult = compiler.compile('detect outliers in amount', dataset.toJSON());
    expect(intentResult.confidence).toBeGreaterThan(0.5);
    expect(intentResult.operation).toBeDefined();
    expect(intentResult.kind).toBe('anomaly');

    // =========================================================================
    // Phase 4: MANIPULATE_REPRESENTATION — Moneta Semantic Decision & Embodiment
    // =========================================================================
    journey.transitionTo('MANIPULATE_REPRESENTATION');
    expect(journey.currentPhase).toBe('MANIPULATE_REPRESENTATION');
    // This legacy lifecycle test does not pass the compiled analytical intent
    // into Moneta, so the decision is deliberately the generic EXPLORE default.
    // Candidate-specific behavior is covered by the Stream M production tests.
    const decision = MonetaHypothesisEngine.reason(facts!);
    expect(decision.chosenFamily).toBeDefined();

    const graph = representationDecisionToGraph(decision);
    expect(graph.primitives.length).toBeGreaterThan(0);

    const artifact = VRTopologyTranslator.synthesizeArtifact(
      { spec: { layout: decision.embodiment.primaryLayout, geometry: decision.embodiment.primaryGeometry, behavior: 'STATIC', interaction: 'INSPECT_CELL' }, facts: facts!, cost: decision.utilityScore },
      { dataset, encodings: { color: 'category', size: 'amount' } }
    );
    expect(artifact.group).toBeInstanceOf(THREE.Group);

    // Dataset-level semantic representations must never fabricate row-derived
    // geometry when this synchronous helper has no authoritative Rust payload.
    // Observation/layout representations may still synthesize directly.
    if (
      decision.chosenCandidateId === 'DISTRIBUTION_FIELD' ||
      decision.chosenCandidateId === 'AGGREGATE_VOLUME'
    ) {
      expect(artifact.nodeMeshes).toHaveLength(0);
      expect(artifact.group.userData.semanticEmbodimentStatus).toBe('PENDING');
    } else {
      expect(artifact.nodeMeshes.length).toBeGreaterThan(0);
    }

    // =========================================================================
    // Phase 5: INSPECT_STRUCTURE — Contextual Task Surface Probing
    // =========================================================================
    journey.transitionTo('INSPECT_STRUCTURE');
    expect(journey.currentPhase).toBe('INSPECT_STRUCTURE');
    const taskSurface = new ContextualTaskSurface({} as any);
    taskSurface.setTopology('TABULAR');
    taskSurface.setIntent('Analyse');
    const actions = taskSurface.getAvailableActions();
    expect(actions.some((a) => a.id === 'filter_range')).toBe(true);

    // =========================================================================
    // Phase 6: TEST_FALSIFY — Data Operation & Falsification
    // =========================================================================
    journey.transitionTo('TEST_FALSIFY');
    expect(journey.currentPhase).toBe('TEST_FALSIFY');
    const opController = new DataOperationController({
      eventBus: bus,
      getArtifact: () => artifact,
      atlas,
    });
    opController.setOriginalDataset(dataset);
    opController.apply('filter');
    expect(opController.analysisHistory.length).toBe(1);

    // =========================================================================
    // Phase 7: COMPARE — Investigation Multi-Branch Forking
    // =========================================================================
    journey.transitionTo('COMPARE');
    expect(journey.currentPhase).toBe('COMPARE');
    const rootNode = atlas.aggregate.graph.nodes[0];
    const branchNode = {
      id: 'node_hypothesis_outliers',
      parentId: rootNode?.id ?? null,
      datasetVersion: 1,
      datasetFingerprint: 'fp_hypothesis',
      label: 'Hypothesis: High Risk Cluster',
      timestamp: Date.now(),
    };
    atlas.aggregate.graph.addNode(branchNode);
    if (rootNode) {
      atlas.aggregate.graph.addEdge({
        id: 'edge_branch_1',
        source: rootNode.id,
        target: branchNode.id,
        relationship: 'branches_from' as const,
      });
    }
    expect(atlas.aggregate.graph.nodes.length).toBeGreaterThanOrEqual(2);
    journey.transitionTo('COMPARE', { branchCount: 2 });
    expect(journey.state.branchCount).toBe(2);

    // =========================================================================
    // Phase 8: CAPTURE_FINDING — Record Structured Evidence Finding
    // =========================================================================
    journey.transitionTo('CAPTURE_FINDING');
    expect(journey.currentPhase).toBe('CAPTURE_FINDING');
    atlas.aggregate.ledger.recordFinding(
      {
        title: 'High Risk Spike in Category Tech',
        description: 'Observed 10 items with risk > 0.8 in category Tech.',
        confidence: 'definitive',
        observationIds: [],
        resultIds: [],
        datasetVersion: 1,
        datasetFingerprint: 'fp_hypothesis',
      },
      atlas.aggregate.sessionId
    );
    expect(atlas.aggregate.ledger.findings.length).toBe(1);
    journey.transitionTo('CAPTURE_FINDING', { findingsCount: 1 });
    expect(journey.state.findingsCount).toBe(1);

    // =========================================================================
    // Phase 9: NAVIGATE_MEMORY_PALACE — Spatial Landmarks & TechnoCore
    // =========================================================================
    journey.transitionTo('NAVIGATE_MEMORY_PALACE');
    expect(journey.currentPhase).toBe('NAVIGATE_MEMORY_PALACE');
    const technoCore = new TechnoCoreNode();
    expect(technoCore.group.userData.role).toBe('technocore');
    expect(technoCore.lensMode).toBe('off');

    const nextMode = technoCore.nextLensMode();
    expect(nextMode).toBe('statistical');
    journey.transitionTo('NAVIGATE_MEMORY_PALACE', { lensMode: nextMode });
    expect(journey.state.activeLensMode).toBe('statistical');

    // =========================================================================
    // Phase 10: SHARE_REPLAY — State Integrity & Journey History Audit
    // =========================================================================
    journey.transitionTo('SHARE_REPLAY');
    expect(journey.currentPhase).toBe('SHARE_REPLAY');
    expect(journey.history.length).toBeGreaterThanOrEqual(10);
    expect(journey.history.map((h) => h.phase)).toContain('LOAD');
    expect(journey.history.map((h) => h.phase)).toContain('SHARE_REPLAY');
  });
});