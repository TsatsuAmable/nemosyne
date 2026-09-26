import type { WasmRuntimeBridgeFull } from '../../src/atlas/AtlasCore.ts';
import type { RustDatasetStructureProfile } from '../../src/data/evidence/index.ts';
import type {
  DatasetJSON,
  Facts,
  JSONValue,
  OperationSpec,
  Provenance,
} from '../../src/data/types.ts';

export interface MonetaStructureProfileFixtureOptions {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  numericColumns: number;
  categoricalColumns: number;
  temporalColumns?: number;
  fingerprint?: string;
  clusterCount?: number;
  hasClusters?: boolean;
  separationScore?: number;
}

export function createMonetaStructureProfile(
  options: MonetaStructureProfileFixtureOptions
): RustDatasetStructureProfile {
  const temporalColumns = options.temporalColumns ?? 0;
  const clusterCount = options.clusterCount ?? 1;
  const hasClusters = options.hasClusters ?? clusterCount > 1;
  const fingerprint = options.fingerprint ?? `sha256:test:${options.datasetName}`;
  const separationScore = options.separationScore ?? (hasClusters ? 0.8 : 0);
  // Mirrors the Rust producer's bounded bottom-k sampling contract
  // (wasm/src/data/profile.rs): above MAX_CLUSTER_SAMPLE_ROWS (65,536) the
  // estimator switches to the fixed-seed bottom-k method and reports the
  // sampled count and per-sample source ratio instead of the full population.
  const sampleCount = Math.min(options.rowCount, 65_536);
  const isBoundedSampling = options.rowCount > 65_536;

  return {
    datasetName: options.datasetName,
    rowCount: options.rowCount,
    columnCount: options.columnCount,
    dimensionality: {
      totalColumns: options.columnCount,
      numericColumns: options.numericColumns,
      categoricalColumns: options.categoricalColumns,
      temporalColumns,
      constantColumns: 0,
      redundantColumns: 0,
      effectiveDimensions: Math.max(1, options.numericColumns),
    },
    distributions: {
      numericSummaries: [],
      globalHasOutliers: false,
      globalHighVariance: false,
      maxSkewness: 0,
    },
    correlations: {
      pairs: [],
      maxCorrelation: 0,
      pairsAboveMagnitudeThreshold: 0,
      isRankDeficient: false,
    },
    clusters: {
      estimatedCount: clusterCount,
      hasClusters,
      separationScore,
      // Mirrors the Rust producer (wasm/src/data/profile.rs): the partition
      // score is 0.0 whenever no partition is detected, and otherwise the
      // affine silhouette rescaling (best_silhouette * 0.9) clamped to
      // [0.1, 1.0]. The previous literal inverted the no-clusters case to 1.
      heuristicSilhouettePartitionScore: hasClusters
        ? Math.min(1, Math.max(0.1, separationScore * 0.9))
        : 0,
      method: isBoundedSampling
        ? 'fixed-seed-bottom-k-complete-row-kmeans'
        : 'full-complete-row-kmeans',
      eligibleObservationCount: options.rowCount,
      sampleCount,
      samplingSeed: isBoundedSampling ? 0x4e4d5359 : null,
      sourceObservationsPerSample: sampleCount > 0 ? options.rowCount / sampleCount : 0,
      normalization: 'per-dimension-min-max-over-all-complete-rows',
      maximumCandidateClusters: 3,
      iterations: 5,
      silhouetteSampleCount: Math.min(sampleCount, 50),
    },
    density: {
      // Mirrors the Rust producer's row-count thresholds (wasm/src/data/
      // profile.rs): >= 50 rows -> 0.7, >= 20 -> 0.4, else 0.15. The previous
      // literal 0.5 is not a value the kernel can emit.
      heuristicScaleDensityProxy: options.rowCount >= 50 ? 0.7 : options.rowCount >= 20 ? 0.4 : 0.15,
      modeCount: clusterCount,
      // Mirrors the Rust producer: sparse is a row-count threshold (< 15).
      heuristicSparseByRowCount: options.rowCount < 15,
    },
    temporal: null,
    graph: null,
    hierarchy: null,
    spatial: null,
    anomalies: {
      totalAnomalies: 0,
      anomalyFraction: 0,
      hasAnomalies: false,
      maxAnomalyScore: 0,
    },
    missingness: {
      totalMissing: 0,
      missingFraction: 0,
      hasMissingness: false,
      columnMissingness: {},
    },
    categorical: {
      summaries: [],
      meanEntropy: 0,
      hasHighCardinality: false,
    },
    spectral: null,
    provenance: {
      kernelVersion: 'wasm-kernel-test-fixture',
      datasetFingerprint: fingerprint,
      timestampMs: 1,
      algorithmSuite: 'structure-profile-v1',
    },
  };
}

export function createMonetaKernelFixture(
  profile: RustDatasetStructureProfile
): WasmRuntimeBridgeFull {
  let loaded: DatasetJSON | null = null;
  let lastProvenance: Provenance | null = null;

  const facts = (): Facts => ({
    rowCount: profile.rowCount,
    columnCount: profile.columnCount,
    numeric: [],
    correlation: [],
    categorical: [],
    temporal: [],
    temporalStats: [],
  });

  return {
    isReady: () => true,
    capabilities: () => 0,
    loadDatasetJson: (obj) => {
      loaded = obj;
      return 7;
    },
    loadCsv: () => 0,
    loadJson: () => 0,
    loadSample: () => 0,
    sampleKeys: () => [],
    getDatasetJson: () => loaded,
    destroyDataset: () => {},
    runOperation: (_handle: number, operation: OperationSpec) => {
      lastProvenance = {
        kernel: 'nemosyne-wasm',
        kernelVersion: profile.provenance.kernelVersion,
        operation: operation.op,
        parameters: operation as unknown as JSONValue,
        inputFingerprint: profile.provenance.datasetFingerprint,
        outputFingerprint: profile.provenance.datasetFingerprint,
        timestamp: profile.provenance.timestampMs,
      };
      return 8;
    },
    executeOperation: () => null,
    statistics: facts,
    inferTopology: () => 'TABULAR',
    inferEncodings: () => ({}),
    parseDatasetBytes: () => null,
    kernelVersion: () => profile.provenance.kernelVersion,
    kernelProvenance: () => lastProvenance,
    datasetFingerprint: () => profile.provenance.datasetFingerprint,
    computeDatasetStructureProfile: () => profile,
  };
}
