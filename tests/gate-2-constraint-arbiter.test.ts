/**
 * Gate 2 (Represent) Test Suite — Constraint Arbiter & Hierarchical Spatial Strategy
 */

import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
  ConstraintArbiter,
  RepresentationRequirementsSchema,
  createDefaultRequirements,
  type DracoFacts,
} from '../src/draco/index.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';

function createMockFacts(overrides: Partial<DracoFacts> = {}): DracoFacts {
  return {
    topology: 'TABULAR',
    rowCount: 100,
    nodeCount: 100,
    edgeCount: 0,
    depth: 1,
    numericColumns: 3,
    categoricalColumns: 2,
    temporalColumns: 0,
    hasTimeSeries: false,
    hasContinuousValues: true,
    density: 0,
    estimatedDensity: 1.5,
    outlierCount: 0,
    cardinalityOfColor: 4,
    hasHighCardinality: false,
    isLargeDataset: false,
    clusterCount: 4,
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'flat',
    seasonalityHint: false,
    hasOutliers: false,
    hasHighVariance: false,
    numericSkew: 0,
    topCategory: 'CatA',
    ...overrides,
  };
}

describe('Gate 2 (Represent): RepresentationRequirements Schema', () => {
  it('validates valid requirements successfully', () => {
    const req = createDefaultRequirements('explore', ['dimA', 'dimB', 'dimC']);
    const parsed = v.parse(RepresentationRequirementsSchema, req);
    expect(parsed.task).toBe('explore');
    expect(parsed.primaryDimensions).toEqual(['dimA', 'dimB', 'dimC']);
    expect(parsed.preservationGoal).toBe('cluster-separation');
  });

  it('rejects invalid task identifiers', () => {
    const invalid = {
      task: 'invalid-task-type',
      primaryDimensions: ['dimA'],
    };
    expect(() => v.parse(RepresentationRequirementsSchema, invalid)).toThrow();
  });

  it('populates default hardware envelope', () => {
    const req = createDefaultRequirements('identify-outliers');
    expect(req.hardwareConstraints?.deviceTier).toBe('quest3');
    expect(req.hardwareConstraints?.preferInstanced).toBe(true);
  });
});

describe('Gate 2 (Represent): ConstraintArbiter Strategy Selection', () => {
  it('guarantees deterministic selection given identical inputs', () => {
    const facts = createMockFacts();
    const req = createDefaultRequirements('explore', ['x', 'y', 'z']);

    const strat1 = ConstraintArbiter.arbitrate(facts, req, { datasetFingerprint: 'fp123', now: 1000 });
    const strat2 = ConstraintArbiter.arbitrate(facts, req, { datasetFingerprint: 'fp123', now: 1000 });

    expect(strat1.id).toBe(strat2.id);
    expect(strat1.macroLayout.layout).toBe(strat2.macroLayout.layout);
    expect(strat1.score).toBe(strat2.score);
    expect(strat1.rejectionLog.length).toBe(strat2.rejectionLog.length);
  });

  it('selects TIME_RIBBON for temporal-trend task and dataset with time-series', () => {
    const facts = createMockFacts({
      hasTimeSeries: true,
      temporalColumns: 1,
      trendDirection: 'up',
    });
    const req = createDefaultRequirements('temporal-trend', ['timestamp', 'value']);
    req.preservationGoal = 'temporal-ordering';

    const strategy = ConstraintArbiter.arbitrate(facts, req);
    expect(strategy.macroLayout.layout).toBe('TIME_RIBBON');
    expect(strategy.interactionStrategy.primaryInteraction).toBe('CHRONO_DIAL');
    expect(strategy.interactionStrategy.detailLens).toBe('TIME_DIAL');
    expect(strategy.score).toBeGreaterThanOrEqual(0.85);
  });

  it('selects RADIAL_ORBITAL for hierarchical topology with trace-lineage task', () => {
    const facts = createMockFacts({
      topology: 'HIERARCHY',
      depth: 4,
      nodeCount: 250,
    });
    const req = createDefaultRequirements('trace-lineage', ['parent', 'child', 'weight']);
    req.preservationGoal = 'hierarchy-depth';

    const strategy = ConstraintArbiter.arbitrate(facts, req);
    expect(strategy.macroLayout.layout).toBe('RADIAL_ORBITAL');
    expect(strategy.interactionStrategy.primaryInteraction).toBe('DRILL_DOWN');
    expect(strategy.macroLayout.positionSemantics).toBe('STRUCTURAL');
  });

  it('selects GEO_SURFACE for geospatial topology with spatial-proximity task', () => {
    const facts = createMockFacts({
      topology: 'GEO',
      numericColumns: 2,
    });
    const req = createDefaultRequirements('spatial-proximity', ['latitude', 'longitude', 'magnitude']);
    req.preservationGoal = 'density-gradient';

    const strategy = ConstraintArbiter.arbitrate(facts, req);
    expect(strategy.macroLayout.layout).toBe('GEO_SURFACE');
    expect(strategy.macroLayout.positionSemantics).toBe('SEMANTIC');
    expect(strategy.datumEncoding.geometry).toBe('GEO_COLUMN');
  });

  it('generates a machine-readable rejection log explaining discarded alternatives', () => {
    const facts = createMockFacts({ hasTimeSeries: false, temporalColumns: 0 });
    const req = createDefaultRequirements('explore', ['dim1', 'dim2']);

    const strategy = ConstraintArbiter.arbitrate(facts, req);
    expect(strategy.rejectionLog.length).toBeGreaterThan(0);

    const temporalRejection = strategy.rejectionLog.find((r) => r.layout === 'TIME_RIBBON');
    expect(temporalRejection).toBeDefined();
    expect(temporalRejection?.reason).toContain('lacks temporal columns');

    const geoRejection = strategy.rejectionLog.find((r) => r.layout === 'GEO_SURFACE');
    expect(geoRejection).toBeDefined();
    expect(geoRejection?.reason).toContain('lacks spatial coordinates');
  });
});

describe('Gate 2 (Represent): AtlasCore Integration', () => {
  it('arbitrates spatial strategy directly from AtlasCore', () => {
    // Build a typed dataset large enough for the CLUSTER_REGIONS candidate
    // (scale minN=20). Dataset.fromJSON requires column objects with a `type`
    // and object rows; string columns / array rows would yield undefined types
    // and a zero-numeric signature, which no candidate can satisfy.
    const clusterRows = [
      ...Array.from({ length: 10 }, (_, i) => ({ feat1: 1 + i * 0.1, feat2: 2 + i * 0.1, feat3: 3 + i * 0.1, cluster: 'A' })),
      ...Array.from({ length: 10 }, (_, i) => ({ feat1: 10 + i * 0.1, feat2: 11 + i * 0.1, feat3: 12 + i * 0.1, cluster: 'B' })),
      ...Array.from({ length: 10 }, (_, i) => ({ feat1: 20 + i * 0.1, feat2: 21 + i * 0.1, feat3: 22 + i * 0.1, cluster: 'C' })),
    ];
    const dataset = Dataset.fromJSON({
      name: 'ClusterTest',
      columns: [
        { name: 'feat1', type: 'numeric' },
        { name: 'feat2', type: 'numeric' },
        { name: 'feat3', type: 'numeric' },
        { name: 'cluster', type: 'categorical' },
      ],
      rows: clusterRows,
    });

    const atlas = new AtlasCore();
    atlas.loadDataset(dataset);
    const req = createDefaultRequirements('compare-clusters', ['feat1', 'feat2', 'feat3']);

    const strategy = atlas.arbitrateSpatialStrategy(req);
    expect(strategy).toBeDefined();
    expect(strategy.id).toContain('strat:');
    expect(strategy.interactionStrategy.detailLens).toBe('CLUSTER_ZONE');
    expect(atlas.activeSpatialStrategy).toBe(strategy);
  });
});
