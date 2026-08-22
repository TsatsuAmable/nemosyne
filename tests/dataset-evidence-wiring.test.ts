import { describe, expect, it } from 'vitest';
import {
  DATASET_EVIDENCE_SCHEMA_VERSION,
  structureProfileToDatasetEvidence,
  validateDatasetEvidence,
  type RustDatasetStructureProfile,
} from '../src/data/evidence/index.ts';

function profile(): RustDatasetStructureProfile {
  return {
    datasetName: 'fixture',
    rowCount: 42,
    columnCount: 3,
    dimensionality: {
      totalColumns: 3,
      numericColumns: 2,
      categoricalColumns: 1,
      temporalColumns: 0,
      constantColumns: 0,
      redundantColumns: 0,
      effectiveDimensions: 2,
    },
    distributions: {
      numericSummaries: [
        {
          column: 'x', mean: 2, median: 2, stdDev: 1, variance: 1, min: 0, max: 4,
          iqr: 2, skewness: 0, kurtosis: 0, outlierCount: 0,
          isMultimodal: false, isHeavyTailed: false,
        },
      ],
      globalHasOutliers: false,
      globalHighVariance: false,
      maxSkewness: 0,
    },
    correlations: { pairs: [], maxCorrelation: 0, significantPairsCount: 0, isRankDeficient: false },
    clusters: { estimatedCount: 1, hasClusters: false, separationScore: 0, densityVariation: 0.1, stabilityConfidence: 0 },
    density: { globalDensity: 0.5, localDensityVariation: 0.1, modeCount: 1, isSparse: false },
    temporal: null,
    graph: null,
    hierarchy: null,
    spatial: null,
    anomalies: { totalAnomalies: 0, anomalyFraction: 0, hasAnomalies: false, maxAnomalyScore: 0 },
    missingness: { totalMissing: 0, missingFraction: 0, hasMissingness: false, columnMissingness: {} },
    categorical: { summaries: [], meanEntropy: 0, hasHighCardinality: false },
    spectral: null,
    provenance: {
      kernelVersion: 'wasm-kernel-3',
      datasetFingerprint: 'sha256:fixture',
      timestampMs: 123,
      algorithmSuite: 'structure-profile-v1',
    },
  };
}

describe('Rust structure profile → DatasetEvidence wiring', () => {
  it('transports Rust facts into a validated V3 evidence envelope without recomputation', () => {
    const result = structureProfileToDatasetEvidence(profile());

    expect(result.schemaVersion).toBe(DATASET_EVIDENCE_SCHEMA_VERSION);
    expect(result.datasetFingerprint).toBe('sha256:fixture');
    expect(result.kernelVersion).toBe('wasm-kernel-3');
    expect(validateDatasetEvidence(result)).toEqual([]);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'cardinality:dataset', category: 'cardinality' }),
        expect.objectContaining({ id: 'schema:dimensionality', category: 'schema' }),
        expect.objectContaining({ id: 'cluster:global', category: 'cluster' }),
      ]),
    );
  });

  it('preserves the current kernel provenance limitation explicitly', () => {
    const result = structureProfileToDatasetEvidence(profile());
    const first = result.evidence[0];

    expect(first.provenance.methodVersion).toBe('structure-profile-v1');
    expect(first.provenance.kernelVersion).toBe('wasm-kernel-3');
    expect(first.provenance.parameters).toEqual({});
    expect(first.provenance.limitations.join(' ')).toMatch(/suite-level provenance/i);
    expect(first.provenance.limitations.join(' ')).toMatch(/bootstrap heuristics/i);
  });

  it('narrows misleading legacy Rust names at the canonical evidence boundary', () => {
    const source = profile();
    source.correlations.significantPairsCount = 2;
    source.clusters.hasClusters = true;
    source.clusters.separationScore = 0.72;
    source.clusters.stabilityConfidence = 0.648;

    const result = structureProfileToDatasetEvidence(source);
    const dependency = result.evidence.find((item) => item.id === 'dependency:correlations');
    const cluster = result.evidence.find((item) => item.id === 'cluster:global');

    expect(dependency?.value).toEqual(expect.objectContaining({ strongCorrelationPairCount: 2 }));
    expect(JSON.stringify(dependency?.value)).not.toMatch(/significant/i);
    expect(cluster?.value).toEqual(
      expect.objectContaining({
        heuristicPartitionDetected: true,
        heuristicSeparationScore: 0.72,
        legacySilhouetteDerivedScore: 0.648,
      }),
    );
    expect(JSON.stringify(cluster?.value)).not.toMatch(/confidence/i);
  });

  it('includes optional analytical domains only when Rust emitted them', () => {
    const withSpectral = profile();
    withSpectral.spectral = {
      dominantFrequencies: [0.125],
      spectralEntropy: 0.2,
      powerSpectrumPeak: 0.9,
      hasPeriodicity: true,
      periodicityConfidence: 0.8,
    };

    const result = structureProfileToDatasetEvidence(withSpectral);
    const spectral = result.evidence.find((item) => item.category === 'spectral');
    expect(spectral).toBeDefined();
    expect(spectral?.value).toEqual(expect.objectContaining({ periodicityHeuristicScore: 0.8 }));
    expect(JSON.stringify(spectral?.value)).not.toMatch(/confidence/i);
    expect(result.evidence.some((item) => item.category === 'temporal')).toBe(false);
  });
});
