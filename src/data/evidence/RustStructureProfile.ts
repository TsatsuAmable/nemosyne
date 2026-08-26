/**
 * Typed transport mirror of Rust `DatasetStructureProfile`.
 *
 * This file is intentionally a transport contract only. Analytical values are
 * computed by Rust/WASM; TypeScript must not recompute or repair them here.
 */

export interface RustDimensionalityProfile {
  totalColumns: number;
  numericColumns: number;
  categoricalColumns: number;
  temporalColumns: number;
  constantColumns: number;
  redundantColumns: number;
  effectiveDimensions: number;
}

export interface RustNumericDistributionSummary {
  column: string;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  outlierCount: number;
  isMultimodal: boolean;
  isHeavyTailed: boolean;
}

export interface RustDistributionProfile {
  numericSummaries: RustNumericDistributionSummary[];
  globalHasOutliers: boolean;
  globalHighVariance: boolean;
  maxSkewness: number;
}

export interface RustCorrelationPairSummary {
  columnA: string;
  columnB: string;
  r: number;
  isStrong: boolean;
}

export interface RustCorrelationProfile {
  pairs: RustCorrelationPairSummary[];
  maxCorrelation: number;
  significantPairsCount: number;
  isRankDeficient: boolean;
}

export interface RustClusterProfile {
  estimatedCount: number;
  hasClusters: boolean;
  separationScore: number;
  densityVariation: number;
  stabilityConfidence: number;
  method: string;
  eligibleObservationCount: number;
  sampleCount: number;
  samplingSeed: number | null;
  sourceObservationsPerSample: number;
  normalization: string;
  maximumCandidateClusters: number;
  iterations: number;
  silhouetteSampleCount: number;
}

export interface RustDensityProfile {
  globalDensity: number;
  localDensityVariation: number;
  modeCount: number;
  isSparse: boolean;
}

export interface RustPeriodicityProfile {
  /** Cycles per time-coordinate unit. */
  frequency: number;
  /** Period in the same time-coordinate unit. */
  periodTimeUnits: number;
  /** Historical uncalibrated heuristic score, not statistical confidence. */
  confidence: number;
}

export interface RustTemporalProfile {
  isTimeSeries: boolean;
  timeColumn: string | null;
  trendDirection: string;
  trendStrength: number;
  hasSeasonality: boolean;
  periodicities: RustPeriodicityProfile[];
}

export interface RustGraphProfile {
  isGraph: boolean;
  nodeCount: number;
  edgeCount: number;
  hasCycles: boolean;
  isConnected: boolean;
}

export interface RustHierarchyProfile {
  isHierarchy: boolean;
  depth: number;
  branchingFactor: number;
}

export interface RustSpatialProfile {
  isGeospatial: boolean;
  coordinateDimensions: number;
  latColumn: string | null;
  lonColumn: string | null;
}

export interface RustAnomalyProfile {
  totalAnomalies: number;
  anomalyFraction: number;
  hasAnomalies: boolean;
  maxAnomalyScore: number;
}

export interface RustMissingnessProfile {
  totalMissing: number;
  missingFraction: number;
  hasMissingness: boolean;
  columnMissingness: Record<string, number>;
}

export interface RustCategoryBucketSummary {
  value: string;
  count: number;
  fraction: number;
}

export interface RustCategoricalColumnSummary {
  column: string;
  cardinality: number;
  entropy: number;
  topCategories: RustCategoryBucketSummary[];
  isHighCardinality: boolean;
}

export interface RustCategoricalProfile {
  summaries: RustCategoricalColumnSummary[];
  meanEntropy: number;
  hasHighCardinality: boolean;
}

export interface RustSpectralProfile {
  /** Cycles per actual time-coordinate unit. */
  dominantFrequencies: number[];
  spectralEntropy: number;
  powerSpectrumPeak: number;
  hasPeriodicity: boolean;
  periodicityConfidence: number;
  method: string;
  observedCount: number;
  transformLength: number;
  sourceObservationsPerBin: number;
  /** Cycles per time-coordinate unit. */
  frequencyResolution: number;
  /** Nyquist frequency in cycles per time-coordinate unit. */
  maximumFrequency: number;
  windowFunction: string;
}

export interface RustAnalysisProvenance {
  kernelVersion: string;
  datasetFingerprint: string;
  timestampMs: number;
  algorithmSuite: string;
}

export interface RustDatasetStructureProfile {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  dimensionality: RustDimensionalityProfile;
  distributions: RustDistributionProfile;
  correlations: RustCorrelationProfile;
  clusters: RustClusterProfile;
  density: RustDensityProfile;
  temporal: RustTemporalProfile | null;
  graph: RustGraphProfile | null;
  hierarchy: RustHierarchyProfile | null;
  spatial: RustSpatialProfile | null;
  anomalies: RustAnomalyProfile;
  missingness: RustMissingnessProfile;
  categorical: RustCategoricalProfile;
  spectral: RustSpectralProfile | null;
  provenance: RustAnalysisProvenance;
}
