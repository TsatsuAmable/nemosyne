import { describe, it, expect } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import {
  AnalyticalState,
  EvidenceLedger,
  RepresentationState,
  DecisionHistory,
  ResearchContext,
  InvestigationGraph,
  InvestigationAggregate,
} from '../src/atlas/domain/index.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import type { Facts } from '../src/data/types.ts';

describe('Investigation Domain Aggregate Architecture', () => {
  const sampleColumns = [
    { name: 'id', type: 'TEXT' as const },
    { name: 'name', type: 'TEXT' as const },
    { name: 'value', type: 'NUMERIC' as const },
    { name: 'category', type: 'CATEGORICAL' as const },
  ];

  const sampleRows = [
    { id: '1', name: 'alpha', value: 10, category: 'A' },
    { id: '2', name: 'beta', value: 25, category: 'B' },
    { id: '3', name: 'gamma', value: 40, category: 'A' },
  ];

  const sampleDataset = new Dataset('test-data', sampleColumns, sampleRows);

  describe('AnalyticalState', () => {
    it('initializes with empty state and version 0', () => {
      const state = new AnalyticalState();
      expect(state.hasDataset).toBe(false);
      expect(state.datasetVersion).toBe(0);
      expect(state.original.rowCount).toBe(0);
      expect(state.current.rowCount).toBe(0);
    });

    it('loads dataset, sets original & current, and bumps version', () => {
      const state = new AnalyticalState();
      state.loadDataset(sampleDataset);
      expect(state.hasDataset).toBe(true);
      expect(state.datasetVersion).toBe(1);
      expect(state.original.rowCount).toBe(3);
      expect(state.current.rowCount).toBe(3);
    });

    it('updates current dataset without bumping version', () => {
      const state = new AnalyticalState();
      state.loadDataset(sampleDataset);
      const modified = new Dataset(
        'modified',
        sampleColumns,
        [{ id: '1', name: 'alpha', value: 10, category: 'A' }],
      );
      state.setCurrentDataset(modified);
      expect(state.datasetVersion).toBe(1);
      expect(state.current.rowCount).toBe(1);
      expect(state.original.rowCount).toBe(3);
    });

    it('manages kernel handle lifecycle with adopt and invalidate', () => {
      const state = new AnalyticalState();
      state.loadDataset(sampleDataset);

      let destroyedHandle = 0;
      const destroyer = (h: number) => {
        destroyedHandle = h;
      };

      const handle = state.ensureHandle(() => 42);
      expect(handle).toBe(42);

      state.adoptHandle(84, destroyer);
      expect(destroyedHandle).toBe(42);

      state.invalidateHandle(destroyer);
      expect(destroyedHandle).toBe(84);
    });
  });

  describe('EvidenceLedger', () => {
    it('appends events with sequential IDs and generates result IDs', () => {
      const ledger = new EvidenceLedger();
      const event = ledger.appendEvent(
        {
          timestamp: 1000,
          kind: 'load',
          command: { op: 'load' },
          datasetVersion: 1,
          datasetFingerprint: 'fp-1',
          stateHash: 'sh-1',
        },
        'session-test',
      );

      expect(event.eventId).toBe('session-test:1');
      expect(ledger.ledger.length).toBe(1);

      const resultId = ledger.nextResultId('fp-1', 1, 'filter');
      expect(resultId).toBe('fp-1:1:filter:1');
    });

    it('reconstructs AnalysisHistory from ledger events', () => {
      const ledger = new EvidenceLedger();
      ledger.appendEvent(
        {
          timestamp: 1000,
          kind: 'load',
          command: { op: 'load' },
          datasetVersion: 1,
          datasetFingerprint: 'fp-1',
          stateHash: 'sh-1',
        },
        'session-test',
      );

      const filteredJSON = {
        name: 'filtered',
        columns: [
          { name: 'id', type: 'TEXT' as const },
          { name: 'value', type: 'NUMERIC' as const },
        ],
        rows: [{ id: '1', value: 10 }],
      };

      ledger.appendEvent(
        {
          timestamp: 1001,
          kind: 'analysis',
          command: {
            datasetFingerprint: 'fp-1',
            datasetVersion: 1,
            operation: { op: 'filter', column: 'value', predicate: 'gt', threshold: 5 },
            algorithmVersion: '1.0.0',
            label: 'Filter value > 5',
          },
          result: {
            resultId: 'fp-1:1:filter:1',
            datasetFingerprint: 'fp-1',
            datasetVersion: 1,
            spec: {
              datasetFingerprint: 'fp-1',
              datasetVersion: 1,
              operation: { op: 'filter' },
              algorithmVersion: '1.0.0',
            },
            dataset: filteredJSON,
            provenance: null,
            implementationVersion: '1.0.0',
            outputHash: 'hash-1',
            evidenceStatus: 'exploratory',
          },
          datasetVersion: 1,
          datasetFingerprint: 'fp-1',
          stateHash: 'sh-2',
        },
        'session-test',
      );

      const history = ledger.getAnalysisHistory(sampleDataset);
      expect(history.canUndo).toBe(true);
      expect(history.current()?.datasetAfter?.rowCount).toBe(1);
    });
  });

  describe('ResearchContext', () => {
    it('generates session IDs and provides timestamps', () => {
      const context = new ResearchContext({ sessionId: 'custom-session-123' });
      expect(context.sessionId).toBe('custom-session-123');
      expect(typeof context.now()).toBe('number');
    });
  });

  describe('RepresentationState', () => {
    it('maps kernel facts into DracoFacts shape', () => {
      const rep = new RepresentationState();
      const mockFacts: Facts = {
        rowCount: 3,
        columnCount: 4,
        numeric: [{ name: 'value', min: 10, max: 40, mean: 25, median: 25, std: 15, var: 225, sum: 75, count: 3, skew: 0, kurtosis: 0, outlierCount: 0 }],
        categorical: [{ name: 'category', cardinality: 2, entropy: 0.9, top: [{ value: 'A', count: 2 }, { value: 'B', count: 1 }] }],
        temporal: [],
        temporalStats: [],
        correlation: [],
      };

      const dracoFacts = rep.toDracoFacts({ dataset: sampleDataset }, mockFacts);
      expect(dracoFacts.rowCount).toBe(3);
      expect(dracoFacts.numericColumns).toBe(1);
      expect(dracoFacts.columnStats['value'].mean).toBe(25);
    });

    it('returns minimal facts when kernel facts are absent', () => {
      const rep = new RepresentationState();
      const dracoFacts = rep.toDracoFacts({ dataset: sampleDataset }, null);
      expect(dracoFacts.rowCount).toBe(3);
      expect(dracoFacts.outlierCount).toBe(0);
      expect(dracoFacts.columnStats).toEqual({});
    });
  });

  describe('DecisionHistory', () => {
    it('tracks recommendations and records decisions', () => {
      const decisions = new DecisionHistory();
      expect(decisions.activeRecommendation).toBeNull();

      decisions.setRecommendation({
        targetIds: ['c1'],
        action: 'inspect-cluster',
        rationale: 'High variance cluster detected',
        evidence: 'Variance = 15.2',
        heuristicScore: 0.85,
        decision: 'pending',
      });

      expect(decisions.activeRecommendation?.decision).toBe('pending');

      decisions.recordDecision('accepted');
      expect(decisions.activeRecommendation?.decision).toBe('accepted');
      expect(decisions.history.length).toBe(1);
      expect(decisions.history[0].decision).toBe('accepted');
    });
  });

  describe('InvestigationGraph', () => {
    it('adds nodes and tracks active investigation node', () => {
      const graph = new InvestigationGraph();
      graph.addNode({
        id: 'node-1',
        parentId: null,
        datasetVersion: 1,
        datasetFingerprint: 'fp-1',
        label: 'Root Node',
        timestamp: 1000,
      });

      expect(graph.activeNodeId).toBe('node-1');
      expect(graph.nodes.length).toBe(1);
      expect(graph.getNode('node-1')?.label).toBe('Root Node');
    });
  });

  describe('InvestigationAggregate Root', () => {
    it('coordinates all sub-states and produces valid state snapshot', () => {
      const aggregate = new InvestigationAggregate({ sessionId: 'session-agg-test' });
      aggregate.loadDataset(sampleDataset);

      expect(aggregate.analytical.datasetVersion).toBe(1);
      expect(aggregate.ledger.ledger.length).toBe(1);
      expect(aggregate.graph.nodes.length).toBe(1);

      const state = aggregate.toState();
      expect(state.datasetVersion).toBe(1);
      expect(state.originalDataset?.name).toBe('test-data');
      expect(state.currentDataset?.name).toBe('test-data');
      expect(state.eventLedger.length).toBe(1);

      const restored = new InvestigationAggregate({ sessionId: 'session-restored' });
      restored.restoreState(state);

      expect(restored.analytical.datasetVersion).toBe(1);
      expect(restored.analytical.original.rowCount).toBe(3);
      expect(restored.analytical.current.rowCount).toBe(3);
      expect(restored.ledger.ledger.length).toBe(1);
      expect(restored.graph.nodes.length).toBe(1);
    });
  });

  describe('AtlasCore Coordinator with InvestigationAggregate', () => {
    it('exposes the domain aggregate and preserves backwards compatible API', () => {
      const atlas = new AtlasCore({ sessionId: 'session-atlas-test' });
      expect(atlas.aggregate).toBeInstanceOf(InvestigationAggregate);

      atlas.loadDataset(sampleDataset);
      expect(atlas.datasetVersion).toBe(1);
      expect(atlas.originalDataset.rowCount).toBe(3);
      expect(atlas.dataset.rowCount).toBe(3);
      expect(atlas.ledger.length).toBe(1);

      atlas.recordObservation('Test observation on data');
      expect(atlas.ledger.length).toBe(2);
      expect(atlas.ledger[1].observation).toBe('Test observation on data');

      atlas.recordIntervention('Test intervention on data');
      expect(atlas.ledger.length).toBe(3);
      expect(atlas.ledger[2].intervention).toBe('Test intervention on data');

      const state = atlas.toState();
      expect(state.eventLedger.length).toBe(3);

      const restoredAtlas = new AtlasCore({ sessionId: 'session-atlas-restored' });
      restoredAtlas.restoreState(state);
      expect(restoredAtlas.datasetVersion).toBe(1);
      expect(restoredAtlas.dataset.rowCount).toBe(3);
      expect(restoredAtlas.ledger.length).toBe(3);
    });
  });
});
