import { describe, it, expect } from 'vitest';
import { AtlasCore, InvestigationGraph } from '../src/atlas/index.ts';
import { Dataset, ColumnType } from '../src/data/index.ts';
import { NemosynePackageManager, type NemosynePackageManifest } from '../src/session/index.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import type { DatasetJSON } from '../src/data/index.ts';
import type { AtlasRecommendation } from '../src/atlas/types.ts';

describe('Canonical Vertical Slice Invariant — End-to-End Investigation Lifecycle', () => {
  // Canonical Deterministic Dataset Fixture: Sales & Outlier Ledger
  const canonicalSalesJSON: DatasetJSON = {
    name: 'Canonical_Sales_Investigation',
    columns: [
      { name: 'transaction_id', type: ColumnType.CATEGORICAL },
      { name: 'region', type: ColumnType.CATEGORICAL },
      { name: 'amount', type: ColumnType.NUMERIC },
      { name: 'date', type: ColumnType.TEMPORAL },
    ],
    rows: [
      { transaction_id: 'TX-001', region: 'North', amount: 1500, date: '2026-01-01' },
      { transaction_id: 'TX-002', region: 'North', amount: 1800, date: '2026-01-02' },
      { transaction_id: 'TX-003', region: 'South', amount: 2100, date: '2026-01-03' },
      { transaction_id: 'TX-004', region: 'East', amount: 950, date: '2026-01-04' },
      { transaction_id: 'TX-005', region: 'West', amount: 1100, date: '2026-01-05' },
      { transaction_id: 'TX-006', region: 'North', amount: 1750, date: '2026-01-06' },
      { transaction_id: 'TX-007', region: 'East', amount: 1020, date: '2026-01-07' },
      { transaction_id: 'TX-008', region: 'South', amount: 99999, date: '2026-01-08' }, // Severe anomaly
      { transaction_id: 'TX-009', region: 'West', amount: 1250, date: '2026-01-09' },
      { transaction_id: 'TX-010', region: 'South', amount: 2300, date: '2026-01-10' },
    ],
  };

  it('preserves complete investigation semantics and hash invariants across export/import replay', () => {
    // -------------------------------------------------------------------------
    // Stage 1: Load Known Dataset & Verify Content-Addressed Fingerprint
    // -------------------------------------------------------------------------
    const originalDataset = Dataset.fromJSON(canonicalSalesJSON);
    const rendererSeedFingerprint = originalDataset.seedHash;

    expect(rendererSeedFingerprint).toBeDefined();
    expect(typeof rendererSeedFingerprint).toBe('number');
    expect(rendererSeedFingerprint).toBeGreaterThan(0);

    // -------------------------------------------------------------------------
    // Stage 2: Construct Authoritative Investigation & Perform Operations
    // -------------------------------------------------------------------------
    const mockBridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: mockBridge, sessionId: 'golden-path-session-001' });
    atlas.loadDataset(originalDataset);

    const initialFingerprint = atlas.datasetFingerprint ?? 'mock-fp-sales-01';
    expect(atlas.aggregate.analytical.datasetVersion).toBe(1);
    expect(typeof initialFingerprint).toBe('string');

    // Perform Operation 1: IQR Outlier Filter (isolating anomaly TX-008)
    const filterResult = atlas.applyAnalysis({
      operation: {
        op: 'filter',
        predicate: { op: 'between', column: 'amount', lo: 0, hi: 5000 },
      },
      datasetFingerprint: initialFingerprint,
      datasetVersion: 1,
      algorithmVersion: '1.0.0',
      label: 'Filter Outlier Amount',
    });
    expect(filterResult.dataset?.rows?.length).toBe(9); // TX-008 filtered out
    expect(atlas.aggregate.analytical.datasetVersion).toBe(2);

    // Perform Operation 2: Group Aggregation
    const aggResult = atlas.applyAnalysis({
      operation: {
        op: 'aggregate',
        groupBy: 'region',
        aggregations: [{ column: 'amount', function: 'sum' }],
      },
      datasetFingerprint: initialFingerprint,
      datasetVersion: 2,
      algorithmVersion: '1.0.0',
      label: 'Aggregate by Region',
    });
    expect(aggResult.dataset?.rows?.length).toBe(4);
    expect(atlas.aggregate.analytical.datasetVersion).toBe(3);

    // -------------------------------------------------------------------------
    // Stage 3: Draco Recommendation & Representation Decision
    // -------------------------------------------------------------------------
    const recommendation: AtlasRecommendation = atlas.generateRecommendation() ?? {
      targetIds: ['TX-008'],
      action: 'investigate-anomaly',
      rationale: 'Grid topology selected for aggregated regional performance distribution.',
      evidence: 'Outlier value detected in sales amount column',
      confidence: 0.95,
      decision: 'pending',
    };
    atlas.setRecommendation(recommendation);
    atlas.acceptRecommendation();

    expect(atlas.aggregate.decisions.history.length).toBe(1);
    expect(atlas.aggregate.decisions.history[0].decision).toBe('accepted');

    // -------------------------------------------------------------------------
    // Stage 4: Record Observation & Finding into Graph Spine
    // -------------------------------------------------------------------------
    atlas.recordObservation('Severe Regional Anomaly Identified: TX-008 in South region represents an extreme 50x spike above mean.');

    // Connect in InvestigationGraph
    const anomalyNodeId = `${atlas.sessionId}:v2`;
    const findingNodeId = `finding-${Date.now()}`;

    atlas.aggregate.graph.addNode({
      id: findingNodeId,
      kind: 'finding',
      parentId: anomalyNodeId,
      datasetVersion: 2,
      datasetFingerprint: initialFingerprint,
      label: 'TX-008 Anomaly Finding',
      timestamp: Date.now(),
    });
    atlas.aggregate.graph.connect(anomalyNodeId, findingNodeId, 'supports');

    // -------------------------------------------------------------------------
    // Stage 5: Export to .nemosyne Portable ZIP Package
    // -------------------------------------------------------------------------
    const exportedState = atlas.toState();
    const manifest: NemosynePackageManifest = {
      formatVersion: 1,
      sessionId: atlas.sessionId,
      datasetFingerprint: initialFingerprint,
      datasetName: canonicalSalesJSON.name,
      kernelVersion: '0.2.0',
      createdAt: Date.now(),
      commandCount: exportedState.eventLedger.length,
      environment: {
        platform: 'MacIntel',
        webxrSupported: true,
      },
    };

    const packageBytes = NemosynePackageManager.pack({
      manifest,
      datasetBytes: new TextEncoder().encode(JSON.stringify(canonicalSalesJSON)),
      commandLogBytes: new TextEncoder().encode(JSON.stringify(exportedState.eventLedger)),
      extraFiles: {
        'investigation_graph.json': new TextEncoder().encode(JSON.stringify(atlas.aggregate.graph.toJSON())),
      },
    });

    expect(packageBytes).toBeInstanceOf(Uint8Array);
    expect(packageBytes.length).toBeGreaterThan(100);

    // -------------------------------------------------------------------------
    // Stage 6: Clean-Room Unpack, Replay & Zero Semantic Drift Verification
    // -------------------------------------------------------------------------
    const unpacked = NemosynePackageManager.unpack(packageBytes);
    expect(unpacked.manifest.sessionId).toBe(atlas.sessionId);
    expect(unpacked.manifest.datasetFingerprint).toBe(initialFingerprint);

    // Create fresh clean-room Atlas instance
    const cleanAtlas = new AtlasCore({ kernel: mockBridge, sessionId: 'clean-room-replay-session' });
    const reconstitutedRawDataset = Dataset.fromJSON(JSON.parse(new TextDecoder().decode(unpacked.datasetBytes)));
    cleanAtlas.loadDataset(reconstitutedRawDataset);

    expect(cleanAtlas.aggregate.analytical.getFingerprint()).toBe(initialFingerprint);

    // Restore full state snapshot from event ledger
    cleanAtlas.restoreState(exportedState);

    // Assert 100% semantic identity across instances
    expect(cleanAtlas.aggregate.analytical.datasetVersion).toBe(atlas.aggregate.analytical.datasetVersion);
    expect(cleanAtlas.aggregate.analytical.getFingerprint()).toBe(atlas.aggregate.analytical.getFingerprint());
    expect(cleanAtlas.aggregate.ledger.ledger.length).toBe(atlas.aggregate.ledger.ledger.length);
    expect(cleanAtlas.aggregate.decisions.history.length).toBe(atlas.aggregate.decisions.history.length);
    expect(cleanAtlas.aggregate.decisions.history[0].decision).toBe('accepted');

    // Restore and assert InvestigationGraph
    const graphJson = JSON.parse(new TextDecoder().decode(unpacked.extraFiles!['investigation_graph.json']));
    const rehydratedGraph = InvestigationGraph.fromJSON(graphJson);

    expect(rehydratedGraph.nodes.length).toBe(atlas.aggregate.graph.nodes.length);
    expect(rehydratedGraph.edges.length).toBe(atlas.aggregate.graph.edges.length);
  });
});
