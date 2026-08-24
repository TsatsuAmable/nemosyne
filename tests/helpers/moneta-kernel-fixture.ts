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
  densityVariation?: number;
}

export function createMonetaStructureProfile(
  options: MonetaStructureProfileFixtureOptions,
): RustDatasetStructureProfile {
  const temporalColumns = options.temporalColumns ?? 0;
  const clusterCount = options.clusterCount ?? 1;
  const hasClusters = options.hasClusters ?? clusterCount > 1;
  const densityVariation = options.densityVariation ?? 0.2;
  const fingerprint = options.fingerprint ?? `sha256:test:${options.datasetName}`;

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
      significantPairsCount: 0,
      isRankDeficient: false,
    },
    clusters: {
      estimatedCount: clusterCount,
      hasClusters,
      separationScore: options.separationScore ?? (hasClusters ? 0.8 : 0),
      densityVariation,
      stabilityConfidence: hasClusters ? 0.8 : 1,
    },
    density: {
      globalDensity: 0.5,
      localDensityVariation: densityVariation,
      modeCount: clusterCount,
      isSparse: false,
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
  profile: RustDatasetStructureProfile,
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
