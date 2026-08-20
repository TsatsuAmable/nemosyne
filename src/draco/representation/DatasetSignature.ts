/**
 * DatasetSignature — Formal analytical contract capturing intrinsic dataset properties.
 *
 * Serves as the input for the RepresentationHypothesisEngine. Represents purely
 * structural, statistical, topological, and spectral characteristics without
 * prescribing rendering or layout choices.
 */

/**
 * Spectral characteristics extracted from time-series or sequential signals via FFT.
 */
export interface SpectralFacts {
  dominantFrequencies: number[];
  spectralEntropy: number;
  powerSpectrumPeak: number;
  directionalAnisotropy: number;
  characteristicScale: number;
  hasPeriodicity: boolean;
  periodicityConfidence: number;
}

export interface DatasetSignatureSchema {
  numericCount: number;
  categoricalCount: number;
  temporalCount: number;
  geoCount: number;
  textCount: number;
  idCount: number;
}

export interface DatasetSignatureCardinality {
  rowCount: number;
  nodeCount: number;
  edgeCount: number;
  depth: number;
}

export interface DatasetSignatureDistribution {
  hasOutliers: boolean;
  highVariance: boolean;
  maxSkewness: number;
  meanEntropy: number;
}

export interface DatasetSignatureDependence {
  maxCorrelation: number;
  significantPairsCount: number;
}

export interface DatasetSignatureClusterStructure {
  estimatedCount: number;
  separationHint: number;
  hasClusters: boolean;
}

export interface DatasetSignatureAnomalyStructure {
  outlierFraction: number;
  anomalyCount: number;
}

export interface DatasetSignatureTemporalStructure {
  isTimeSeries: boolean;
  intervalRegularity?: number;
  trendDirection: 'flat' | 'up' | 'down';
  hasSeasonality: boolean;
}

export interface DatasetSignatureSpatialStructure {
  isGeospatial: boolean;
  coordinateDimensions: number;
  boundingBoxVolume?: number;
}

export interface DatasetSignatureTopologicalStructure {
  topology: string;
  b0Count?: number;
  hasCycles?: boolean;
}

export interface DatasetSignatureProvenance {
  datasetFingerprint: string;
  timestamp: number;
  engineVersion: string;
}

/**
 * Complete immutable contract describing dataset structure.
 */
export interface DatasetSignature {
  schema: DatasetSignatureSchema;
  cardinality: DatasetSignatureCardinality;
  distribution: DatasetSignatureDistribution;
  dependence: DatasetSignatureDependence;
  clusterStructure: DatasetSignatureClusterStructure;
  anomalyStructure: DatasetSignatureAnomalyStructure;
  temporalStructure: DatasetSignatureTemporalStructure;
  spatialStructure: DatasetSignatureSpatialStructure;
  topologicalStructure: DatasetSignatureTopologicalStructure;
  spectralStructure: SpectralFacts | null;
  provenance: DatasetSignatureProvenance;
}

/**
 * Build a default minimal DatasetSignature from basic dimensional counts.
 */
export function minimalDatasetSignature(
  rowCount = 0,
  numericCols = 0,
  categoricalCols = 0,
  temporalCols = 0,
  fingerprint = 'unknown-fp',
  now = Date.now()
): DatasetSignature {
  return {
    schema: {
      numericCount: numericCols,
      categoricalCount: categoricalCols,
      temporalCount: temporalCols,
      geoCount: 0,
      textCount: 0,
      idCount: 0,
    },
    cardinality: {
      rowCount,
      nodeCount: rowCount,
      edgeCount: 0,
      depth: 0,
    },
    distribution: {
      hasOutliers: false,
      highVariance: false,
      maxSkewness: 0,
      meanEntropy: 0,
    },
    dependence: {
      maxCorrelation: 0,
      significantPairsCount: 0,
    },
    clusterStructure: {
      estimatedCount: 1,
      separationHint: 0,
      hasClusters: false,
    },
    anomalyStructure: {
      outlierFraction: 0,
      anomalyCount: 0,
    },
    temporalStructure: {
      isTimeSeries: temporalCols > 0,
      trendDirection: 'flat',
      hasSeasonality: false,
    },
    spatialStructure: {
      isGeospatial: false,
      coordinateDimensions: 0,
    },
    topologicalStructure: {
      topology: 'TABULAR',
    },
    spectralStructure: null,
    provenance: {
      datasetFingerprint: fingerprint,
      timestamp: now,
      engineVersion: '1.0.0',
    },
  };
}
