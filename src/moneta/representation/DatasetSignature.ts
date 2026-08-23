/**
 * DatasetSignature — Formal analytical contract capturing intrinsic dataset properties.
 *
 * Serves as the input for the Moneta representation reasoning pipeline.
 * Represents purely structural, statistical, topological, and spectral characteristics
 * derived by the Rust analytical kernel.
 */

import type { TopologyTypeValue } from '../types.ts';
import type { RepresentationFamily } from './RepresentationFamily.ts';

export interface SpectralFacts {
  dominantFrequencies: number[];
  spectralEntropy: number;
  powerSpectrumPeak: number;
  /** Present only when the analytical source actually computes anisotropy. */
  directionalAnisotropy?: number;
  /** Present only when the analytical source actually computes a characteristic scale. */
  characteristicScale?: number;
  hasPeriodicity: boolean;
  /** @deprecated Legacy kernel field. Prefer periodicityHeuristicScore when the value is heuristic. */
  periodicityConfidence?: number;
  /** Epistemically narrow name for a non-calibrated periodicity score. */
  periodicityHeuristicScore?: number;
}

export interface DatasetSignatureSchema {
  numericCount: number;
  categoricalCount: number;
  temporalCount: number;
  /** Optional because the current Rust dimensionality profile reports geospatiality separately. */
  geoCount?: number;
  /** Optional until the Rust structure-profile ABI classifies text columns explicitly. */
  textCount?: number;
  /** Optional until the Rust structure-profile ABI classifies identifier columns explicitly. */
  idCount?: number;
}

export interface DatasetSignatureCardinality {
  rowCount: number;
  columnCount: number;
  edgeCount: number;
  depth: number;
}

export interface DatasetSignatureDistribution {
  hasOutliers: boolean;
  outlierFraction: number;
  anomalyCount: number;
  highVariance: boolean;
  maxSkewness: number;
  meanEntropy: number;
  kurtosisProfile?: 'leptokurtic' | 'platykurtic' | 'mesokurtic';
}

export interface DatasetSignatureDependence {
  maxCorrelation: number;
  significantPairsCount: number;
  rankDeficiency: boolean;
}

export interface DatasetSignatureClusterStructure {
  estimatedCount: number;
  hasClusters: boolean;
  separationScore: number;
  densityVariation: number;
}

export interface DatasetSignatureTopologicalStructure {
  topology: TopologyTypeValue;
  hasCycles?: boolean;
  b0Count?: number;
  persistentFeatureCount?: number;
}

export interface DatasetSignatureTemporalStructure {
  isTimeSeries: boolean;
  trendDirection: 'flat' | 'up' | 'down';
  hasSeasonality: boolean;
  periodicityCount?: number;
}

export interface DatasetSignatureSpatialStructure {
  isGeospatial: boolean;
  coordinateDimensions: number;
}

export interface DatasetSignatureProvenance {
  datasetFingerprint: string;
  kernelVersion: string;
  analysisTimestamp: number;
  timestamp?: number;
  generatedAt?: number;
  engine?: string;
  version?: string;
  requirementsHash?: string;
}

export interface DatasetSignature {
  schema: DatasetSignatureSchema;
  cardinality: DatasetSignatureCardinality;
  distribution: DatasetSignatureDistribution;
  dependence: DatasetSignatureDependence;
  clusterStructure: DatasetSignatureClusterStructure;
  topologicalStructure: DatasetSignatureTopologicalStructure;
  temporalStructure: DatasetSignatureTemporalStructure;
  spatialStructure: DatasetSignatureSpatialStructure;
  spectralStructure?: SpectralFacts | null;
  provenance: DatasetSignatureProvenance;
  preferredFamilies?: RepresentationFamily[];
}

export function minimalDatasetSignature(
  rowCountOrFp: number | string = 'unknown',
  numericCountOrKernel: number | string = 'unknown',
  categoricalCountOrNow: number = Date.now(),
  temporalCount = 0,
  fingerprint = 'unknown',
  timestamp = Date.now()
): DatasetSignature {
  if (typeof rowCountOrFp === 'number') {
    const rowCount = rowCountOrFp;
    const numericCount = typeof numericCountOrKernel === 'number' ? numericCountOrKernel : 0;
    const categoricalCount = categoricalCountOrNow;
    return {
      schema: {
        numericCount,
        categoricalCount,
        temporalCount,
        geoCount: 0,
        textCount: 0,
        idCount: 0,
      },
      cardinality: {
        rowCount,
        columnCount: numericCount + categoricalCount + temporalCount,
        edgeCount: 0,
        depth: 1,
      },
      distribution: {
        hasOutliers: false,
        outlierFraction: 0,
        anomalyCount: 0,
        highVariance: false,
        maxSkewness: 0,
        meanEntropy: 0,
      },
      dependence: {
        maxCorrelation: 0,
        significantPairsCount: 0,
        rankDeficiency: false,
      },
      clusterStructure: {
        estimatedCount: 1,
        hasClusters: false,
        separationScore: 0,
        densityVariation: 0,
      },
      topologicalStructure: {
        topology: 'TABULAR',
      },
      temporalStructure: {
        isTimeSeries: temporalCount > 0,
        trendDirection: 'flat',
        hasSeasonality: false,
      },
      spatialStructure: {
        isGeospatial: false,
        coordinateDimensions: 0,
      },
      spectralStructure: null,
      provenance: {
        datasetFingerprint: fingerprint,
        kernelVersion: '0.1.0',
        analysisTimestamp: timestamp,
        timestamp,
      },
    };
  }

  const fp = String(rowCountOrFp);
  const kernel = String(numericCountOrKernel);
  const now = typeof categoricalCountOrNow === 'number' ? categoricalCountOrNow : Date.now();

  return {
    schema: {
      numericCount: 0,
      categoricalCount: 0,
      temporalCount: 0,
      geoCount: 0,
      textCount: 0,
      idCount: 0,
    },
    cardinality: {
      rowCount: 0,
      columnCount: 0,
      edgeCount: 0,
      depth: 0,
    },
    distribution: {
      hasOutliers: false,
      outlierFraction: 0,
      anomalyCount: 0,
      highVariance: false,
      maxSkewness: 0,
      meanEntropy: 0,
    },
    dependence: {
      maxCorrelation: 0,
      significantPairsCount: 0,
      rankDeficiency: false,
    },
    clusterStructure: {
      estimatedCount: 1,
      hasClusters: false,
      separationScore: 0,
      densityVariation: 0,
    },
    topologicalStructure: {
      topology: 'TABULAR',
    },
    temporalStructure: {
      isTimeSeries: false,
      trendDirection: 'flat',
      hasSeasonality: false,
    },
    spatialStructure: {
      isGeospatial: false,
      coordinateDimensions: 0,
    },
    spectralStructure: null,
    provenance: {
      datasetFingerprint: fp,
      kernelVersion: kernel,
      analysisTimestamp: now,
      timestamp: now,
    },
  };
}
