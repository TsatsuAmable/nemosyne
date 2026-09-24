import { describe, it, expect } from 'vitest';
import { buildDatasetSignature } from '../src/moneta/representation/SignatureBuilder.ts';
import { datasetEvidenceToSignature } from '../src/moneta/representation/DatasetEvidenceSignature.ts';
import { structureProfileToDatasetEvidence } from '../src/data/evidence/StructureProfileEvidenceAdapter.ts';
import type { DracoFacts } from '../src/moneta/types.ts';
import type { Facts } from '../src/data/types.ts';
import { createMonetaStructureProfile } from './helpers/moneta-kernel-fixture.ts';

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
    colA: {
      mean: 10,
      median: 9,
      stdDev: 2,
      skew: 0.45,
      kurtosis: 1.2,
      min: 2,
      max: 20,
    },
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
  topCategory: null,
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

describe('DatasetSignature provenance for maxCorrelation', () => {
  it('marks dependence.maxCorrelation as derived from Rust kernel pairs', () => {
    const sig = buildDatasetSignature(mockDracoFacts, mockKernelFacts, null, 'fp-tabular');
    const fact = sig.epistemic?.facts['dependence.maxCorrelation'];
    expect(fact).toBeDefined();
    expect(fact?.source).toBe('derived');
    expect(fact?.note).toContain('Rust kernel correlation');
    expect(sig.dependence.maxCorrelation).toBe(0.75);
  });
  it('preserves direct Rust evidence provenance and identity on the canonical evidence path', () => {
    const profile = createMonetaStructureProfile({
      datasetName: 'max-correlation-evidence',
      rowCount: 50,
      columnCount: 2,
      numericColumns: 2,
      categoricalColumns: 0,
    });
    profile.correlations.maxCorrelation = 0.75;
    profile.correlations.pairs = [
      {
        columnA: 'colA',
        columnB: 'colB',
        r: 0.75,
        exceedsMagnitudeThreshold: true,
      },
    ];
    profile.correlations.pairsAboveMagnitudeThreshold = 1;

    const sig = datasetEvidenceToSignature(structureProfileToDatasetEvidence(profile));
    const fact = sig.epistemic?.facts['dependence.maxCorrelation'];

    expect(sig.dependence.maxCorrelation).toBe(0.75);
    expect(fact?.source).toBe('measured');
    expect(fact?.evidenceId).toBe('dependency:correlations');
  });
});
