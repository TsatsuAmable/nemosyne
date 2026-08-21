import { describe, it, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  buildDatasetSignature,
  RepresentationHypothesisEngine,
  type SpectralFacts,
  type DracoFacts,
} from '../src/draco/index.ts';

describe('Phase 5: Spectral Analysis in Rust/WASM & AtlasCore', () => {
  const mockSpectralFacts: SpectralFacts = {
    dominantFrequencies: [0.0625, 0.125],
    spectralEntropy: 0.25,
    powerSpectrumPeak: 0.78,
    directionalAnisotropy: 0.0,
    characteristicScale: 16.0,
    hasPeriodicity: true,
    periodicityConfidence: 0.88,
  };

  it('returns null for computeSpectralFacts when kernel is not configured', () => {
    const atlas = new AtlasCore();
    const dataset = Dataset.fromJSON({
      name: 'test',
      columns: [{ name: 'val', type: 'numeric' }],
      rows: [{ val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }],
    });
    atlas.loadDataset(dataset);

    const facts = atlas.computeSpectralFacts();
    expect(facts).toBeNull();
  });

  it('delegates computeSpectralFacts to kernel when ready', () => {
    const mockKernel = {
      isReady: () => true,
      capabilities: () => 1 << 14,
      loadDatasetJson: () => 1,
      destroyDataset: () => {},
      computeSpectralFacts: () => mockSpectralFacts,
    };

    const atlas = new AtlasCore({ kernel: mockKernel as never });
    const dataset = Dataset.fromJSON({
      name: 'test',
      columns: [{ name: 'val', type: 'numeric' }],
      rows: [{ val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }],
    });
    atlas.loadDataset(dataset);

    const facts = atlas.computeSpectralFacts();
    expect(facts).toEqual(mockSpectralFacts);
  });

  it('populates spectralStructure in DatasetSignature when spectral facts are provided', () => {
    const baseFacts: DracoFacts = {
      topology: 'TIME_SERIES',
      rowCount: 64,
      nodeCount: 64,
      edgeCount: 0,
      depth: 1,
      numericColumns: 1,
      categoricalColumns: 0,
      temporalColumns: 1,
      hasTimeSeries: true,
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
      seasonalityHint: true,
      hasOutliers: false,
      hasHighVariance: false,
      numericSkew: 0,
      topCategory: null,
    };

    const sig = buildDatasetSignature(baseFacts, null, mockSpectralFacts, 'fp-spectral');
    expect(sig.spectralStructure).toEqual(mockSpectralFacts);
    expect(sig.spectralStructure?.hasPeriodicity).toBe(true);

    const decision = RepresentationHypothesisEngine.reason(baseFacts, null, undefined, {
      spectralFacts: mockSpectralFacts,
    });
    expect(decision.representationFamily).toBe('FREQUENCY');
    expect(decision.utilityScore).toBeGreaterThan(0.5);
    expect(decision.decisionStatus).not.toBe('INFEASIBLE');
    expect(decision.evidence.some((e) => e.fact.includes('spectral'))).toBe(true);
  });
});
