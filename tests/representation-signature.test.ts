import { describe, it, expect } from 'vitest';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import type { DracoFacts } from '../src/moneta/types.ts';
import type { Facts } from '../src/data/types.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  createMonetaKernelFixture,
  createMonetaStructureProfile,
} from './helpers/moneta-kernel-fixture.ts';

describe('Phase 2: Extract DatasetSignature from AtlasCore Facts', () => {
  it('builds a source-aware compatibility signature from DracoFacts and kernel Facts', () => {
    const mockDracoFacts: DracoFacts = {
      topology: 'TABULAR',
      rowCount: 100,
      nodeCount: 100,
      edgeCount: 0,
      depth: 0,
      numericColumns: 3,
      categoricalColumns: 2,
      temporalColumns: 1,
      hasTimeSeries: true,
      hasContinuousValues: true,
      density: 0.8,
      estimatedDensity: 0.8,
      outlierCount: 5,
      cardinalityOfColor: 5,
      hasHighCardinality: false,
      isLargeDataset: false,
      clusterCount: 3,
      columnStats: {
        colA: { mean: 10, median: 9, stdDev: 2, skew: 0.45, kurtosis: 1.2, min: 2, max: 20 },
      },
      correlationMatrix: {
        colA: { colB: 0.75 },
      },
      categoryDistribution: {
        catA: { topCategories: [], entropy: 1.5 },
      },
      trendDirection: 'up',
      seasonalityHint: true,
      hasOutliers: true,
      hasHighVariance: true,
      numericSkew: 0.45,
      topCategory: 'cat1',
    };

    const mockKernelFacts: Facts = {
      rowCount: 100,
      columnCount: 6,
      numeric: [
        {
          name: 'colA',
          count: 100,
          sum: 1000,
          mean: 10,
          median: 9,
          std: 2,
          var: 4,
          min: 2,
          max: 20,
          skew: 0.45,
          kurtosis: 1.2,
          outlierCount: 5,
        },
      ],
      categorical: [
        {
          name: 'catA',
          cardinality: 5,
          entropy: 1.5,
          top: [],
        },
      ],
      correlation: [
        { a: 'colA', b: 'colB', value: 0.75 },
      ],
      temporal: [],
      temporalStats: [],
    };

    const sig = buildDatasetSignature(mockDracoFacts, mockKernelFacts, null, 'fp-tabular');

    expect(sig.schema.numericCount).toBe(3);
    expect(sig.schema.categoricalCount).toBe(2);
    expect(sig.schema.temporalCount).toBe(1);
    expect(sig.cardinality.rowCount).toBe(100);
    expect(sig.distribution.hasOutliers).toBe(true);
    expect(sig.distribution.highVariance).toBeUndefined();
    expect(sig.distribution.maxSkewness).toBe(0.45);
    expect(sig.distribution.meanEntropy).toBe(1.5);
    expect(sig.dependence.maxCorrelation).toBe(0.75);
    expect(sig.dependence.significantPairsCount).toBe(1);
    // RF-045: cluster fields require authoritative Rust DatasetEvidence, not legacy envelope
    expect(sig.clusterStructure.estimatedCount).toBeUndefined();
    expect(sig.clusterStructure.hasClusters).toBeUndefined();
    expect(sig.temporalStructure.isTimeSeries).toBe(true);
    expect(sig.temporalStructure.trendDirection).toBe('up');
    expect(sig.temporalStructure.hasSeasonality).toBe(true);
    expect(sig.provenance.datasetFingerprint).toBe('fp-tabular');
    expect(sig.epistemic?.facts['distribution.meanEntropy'].source).toBe('measured');
    expect(sig.epistemic?.facts['distribution.highVariance'].source).toBe('unknown');
    // cluster fields absent kernel evidence are unknown
    expect(sig.epistemic?.facts['clusterStructure.hasClusters'].source).toBe('unknown');
  });

  it('does not infer cycles from graph topology or edge presence', () => {
    const mockFacts: DracoFacts = {
      topology: 'GRAPH',
      rowCount: 50,
      nodeCount: 50,
      edgeCount: 120,
      depth: 0,
      numericColumns: 1,
      categoricalColumns: 1,
      temporalColumns: 0,
      hasTimeSeries: false,
      hasContinuousValues: false,
      density: 0.6,
      estimatedDensity: 0.6,
      outlierCount: 0,
      cardinalityOfColor: 2,
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
      topCategory: null,
    };

    const sig = buildDatasetSignature(mockFacts);
    expect(sig.topologicalStructure.topology).toBe('GRAPH');
    expect(sig.topologicalStructure.hasCycles).toBeUndefined();
    expect(sig.epistemic?.facts['topologicalStructure.hasCycles'].source).toBe('unknown');
    expect(sig.cardinality.edgeCount).toBe(120);
    expect(sig.spatialStructure.isGeospatial).toBeUndefined();
  });

  it('does not manufacture coordinate dimensionality from a GEO topology label', () => {
    const mockFacts: DracoFacts = {
      topology: 'GEO',
      rowCount: 200,
      nodeCount: 200,
      edgeCount: 0,
      depth: 0,
      numericColumns: 3,
      categoricalColumns: 0,
      temporalColumns: 0,
      hasTimeSeries: false,
      hasContinuousValues: true,
      density: 0.1,
      estimatedDensity: 0.1,
      outlierCount: 0,
      cardinalityOfColor: 0,
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

    const sig = buildDatasetSignature(mockFacts);
    expect(sig.spatialStructure.isGeospatial).toBe(true);
    expect(sig.spatialStructure.coordinateDimensions).toBeUndefined();
    expect(sig.epistemic?.facts['spatialStructure.coordinateDimensions'].source).toBe('unknown');
  });

  it('computes canonical dataset signature via AtlasCore', () => {
    const profile = createMonetaStructureProfile({
      datasetName: 'test-dataset',
      rowCount: 5,
      columnCount: 2,
      numericColumns: 1,
      categoricalColumns: 1,
    });
    const atlas = new AtlasCore({ kernel: createMonetaKernelFixture(profile) });
    const dataset = Dataset.fromJSON({
      name: 'test-dataset',
      columns: [
        { name: 'val', type: 'numeric' },
        { name: 'cat', type: 'categorical' },
      ],
      rows: [
        { val: 1, cat: 'a' },
        { val: 2, cat: 'b' },
        { val: 3, cat: 'a' },
        { val: 4, cat: 'b' },
        { val: 5, cat: 'a' },
      ],
    });
    atlas.loadDataset(dataset);

    const sig = atlas.computeDatasetSignature();
    expect(sig).toBeDefined();
    expect(sig.cardinality.rowCount).toBe(5);
    expect(sig.provenance.datasetFingerprint).toBe(profile.provenance.datasetFingerprint);
    // RF-045: cluster evidence from Rust structure-profile is heuristic (bounded profile)
    expect(sig.epistemic?.facts['clusterStructure.hasClusters'].source).toBe('heuristic');
    expect(atlas.activeDatasetSignature).toBe(sig);
  });
});
