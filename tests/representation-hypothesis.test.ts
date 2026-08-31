import { describe, it, expect } from 'vitest';
import {
  MonetaHypothesisEngine,
  createDefaultRequirements,
  createSourceRelationshipGraphAuthority,
  type MonetaFacts,
} from '../src/moneta/index.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';

describe('Phase 3: MonetaHypothesisEngine', () => {
  const baseTabularFacts: MonetaFacts = {
    topology: 'TABULAR',
    rowCount: 50,
    nodeCount: 50,
    edgeCount: 0,
    depth: 0,
    numericColumns: 2,
    categoricalColumns: 1,
    temporalColumns: 0,
    hasTimeSeries: false,
    hasContinuousValues: true,
    density: 0.1,
    estimatedDensity: 0.1,
    outlierCount: 0,
    cardinalityOfColor: 2,
    hasHighCardinality: false,
    isLargeDataset: false,
    clusterCount: 1,
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'flat',
    seasonalityHint: false,
    hasOutliers: false,
    hasHighVariance: false,
    numericSkew: 0,
    topCategory: null,
  };

  it('selects TEMPORAL family when dataset has temporal dimension', () => {
    const temporalFacts: MonetaFacts = {
      ...baseTabularFacts,
      temporalColumns: 1,
      hasTimeSeries: true,
      trendDirection: 'up',
    };
    const req = createDefaultRequirements('temporal-trend');
    const decision = MonetaHypothesisEngine.reason(temporalFacts, null, req);

    expect(decision.representationFamily).toBe('TEMPORAL');
    expect(decision.utilityScore).toBeGreaterThan(0.5);
    expect(decision.evidence.length).toBeGreaterThan(0);
    expect(decision.embodiment.spatialStrategy).toBeDefined();
    expect(decision.embodiment.primaryLayout).toBe('TIME_RIBBON');
  });

  it('selects GRAPH family when source graph authority is explicit', () => {
    const graphFacts: MonetaFacts = {
      ...baseTabularFacts,
      topology: 'GRAPH',
      nodeCount: 40,
      edgeCount: 90,
    };
    const req = createDefaultRequirements('relationship-discovery');
    req.graphAuthority = createSourceRelationshipGraphAuthority('DIRECTED');
    const decision = MonetaHypothesisEngine.reason(graphFacts, null, req);

    expect(decision.representationFamily).toBe('GRAPH');
    expect(decision.embodiment.primaryLayout).toBe('FORCE_DIRECTED_3D');
  });

  it('rejects FREQUENCY when spectralStructure is null', () => {
    const decision = MonetaHypothesisEngine.reason(baseTabularFacts, null);
    const rejectedFreq = decision.rejectedAlternatives.find((r) => r.family === 'FREQUENCY');
    expect(rejectedFreq).toBeDefined();
    expect(rejectedFreq?.hardPassed).toBe(false);
    expect(rejectedFreq?.reason?.toLowerCase()).toContain('spectral');
  });

  it('wraps a valid SpatialStrategy with full provenance', () => {
    const decision = MonetaHypothesisEngine.reason(baseTabularFacts, null, undefined, {
      datasetFingerprint: 'fp-test-xyz',
    });

    expect(decision.embodiment.spatialStrategy.id).toBeDefined();
    expect(decision.embodiment.spatialStrategy.worldType).toBeDefined();
    expect(decision.provenance.datasetFingerprint).toBe('fp-test-xyz');
    expect(decision.datasetSignature.provenance.datasetFingerprint).toBe('fp-test-xyz');
  });

  it('fails closed at AtlasCore arbitrateRepresentation() without Rust DatasetEvidence', () => {
    const atlas = new AtlasCore();
    const dataset = Dataset.fromJSON({
      name: 'test-atlas-rep',
      columns: [
        { name: 'date', type: 'temporal' },
        { name: 'val', type: 'numeric' },
      ],
      rows: [
        { date: '2026-01-01', val: 10 },
        { date: '2026-01-02', val: 20 },
      ],
    });
    atlas.loadDataset(dataset);

    expect(() =>
      atlas.arbitrateRepresentation(createDefaultRequirements('temporal-trend')),
    ).toThrow(/analytical kernel unavailable|DatasetEvidence/i);
    expect(atlas.activeRepresentationDecision).toBeNull();
  });
});
