/**
 * DatasetSignature — Formal analytical contract capturing intrinsic dataset properties.
 *
 * Serves as the input for the Moneta representation reasoning pipeline. Values
 * that are not supported by evidence MUST remain absent; zero/false is a result,
 * not a synonym for "unknown". `cardinality.depth` retains a zero compatibility
 * sentinel because hard-constraint consumers require a number; its epistemic
 * source records whether that sentinel is evidence or merely unknown.
 */

import type { TopologyTypeValue } from '../types.ts';
import type { RepresentationFamily } from './RepresentationFamily.ts';

export type DatasetSignatureEvidenceSource =
  | 'measured'
  | 'derived'
  | 'heuristic'
  | 'prior'
  | 'investigator-declared'
  | 'unknown';

export interface DatasetSignatureFactEvidence {
  source: DatasetSignatureEvidenceSource;
  /** Canonical DatasetEvidence id when this fact came from the Rust evidence envelope. */
  evidenceId?: string;
  /** Stable method identifier when known. */
  method?: string;
  note?: string;
}

/**
 * Scalar/semantic facts in DatasetSignature. Provenance metadata and configured
 * preferences are intentionally excluded: this map describes evidence for the
 * dataset claims that can affect representation reasoning.
 */
export const DATASET_SIGNATURE_FACT_PATHS = [
  'schema.numericCount',
  'schema.categoricalCount',
  'schema.temporalCount',
  'schema.geoCount',
  'schema.textCount',
  'schema.idCount',
  'cardinality.rowCount',
  'cardinality.columnCount',
  'cardinality.edgeCount',
  'cardinality.depth',
  'distribution.hasOutliers',
  'distribution.outlierFraction',
  'distribution.anomalyCount',
  'distribution.highVariance',
  'distribution.maxSkewness',
  'distribution.meanEntropy',
  'distribution.kurtosisProfile',
  'dependence.maxCorrelation',
  'dependence.significantPairsCount',
  'dependence.rankDeficiency',
  'clusterStructure.estimatedCount',
  'clusterStructure.hasClusters',
  'clusterStructure.separationScore',
  'clusterStructure.densityVariation',
  'topologicalStructure.topology',
  'topologicalStructure.hasCycles',
  'topologicalStructure.b0Count',
  'topologicalStructure.persistentFeatureCount',
  'temporalStructure.isTimeSeries',
  'temporalStructure.trendDirection',
  'temporalStructure.hasSeasonality',
  'temporalStructure.periodicityCount',
  'spatialStructure.isGeospatial',
  'spatialStructure.coordinateDimensions',
  'spectralStructure.dominantFrequencies',
  'spectralStructure.spectralEntropy',
  'spectralStructure.powerSpectrumPeak',
  'spectralStructure.directionalAnisotropy',
  'spectralStructure.characteristicScale',
  'spectralStructure.hasPeriodicity',
  'spectralStructure.periodicityConfidence',
  'spectralStructure.periodicityHeuristicScore',
  'spectralStructure.method',
  'spectralStructure.observedCount',
  'spectralStructure.transformLength',
  'spectralStructure.sourceObservationsPerBin',
  'spectralStructure.frequencyResolution',
  'spectralStructure.maximumFrequency',
  'spectralStructure.windowFunction',
] as const;

export type DatasetSignatureFactPath = (typeof DATASET_SIGNATURE_FACT_PATHS)[number];

export interface DatasetSignatureEpistemic {
  facts: Record<DatasetSignatureFactPath, DatasetSignatureFactEvidence>;
}

export function createUnknownDatasetSignatureEpistemic(
  note = 'No supporting evidence supplied for this fact',
): DatasetSignatureEpistemic {
  return {
    facts: Object.fromEntries(
      DATASET_SIGNATURE_FACT_PATHS.map((path) => [path, { source: 'unknown' as const, note }]),
    ) as Record<DatasetSignatureFactPath, DatasetSignatureFactEvidence>,
  };
}

export function markDatasetSignatureFact(
  epistemic: DatasetSignatureEpistemic,
  path: DatasetSignatureFactPath,
  source: DatasetSignatureEvidenceSource,
  details: Omit<DatasetSignatureFactEvidence, 'source'> = {},
): void {
  epistemic.facts[path] = { source, ...details };
}

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
  method?: string;
  observedCount?: number;
  transformLength?: number;
  sourceObservationsPerBin?: number;
  frequencyResolution?: number;
  maximumFrequency?: number;
  windowFunction?: string;
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
  /**
   * Compatibility sentinel: zero means "no established hierarchy depth" unless
   * `epistemic.facts['cardinality.depth']` says the value is supported evidence.
   */
  depth: number;
}

export interface DatasetSignatureDistribution {
  hasOutliers?: boolean;
  outlierFraction?: number;
  anomalyCount?: number;
  highVariance?: boolean;
  maxSkewness?: number;
  meanEntropy?: number;
  kurtosisProfile?: 'leptokurtic' | 'platykurtic' | 'mesokurtic';
}

export interface DatasetSignatureDependence {
  maxCorrelation?: number;
  significantPairsCount?: number;
  rankDeficiency?: boolean;
}

export interface DatasetSignatureClusterStructure {
  estimatedCount?: number;
  hasClusters?: boolean;
  separationScore?: number;
  densityVariation?: number;
}

export interface DatasetSignatureTopologicalStructure {
  topology: TopologyTypeValue;
  hasCycles?: boolean;
  b0Count?: number;
  persistentFeatureCount?: number;
}

export interface DatasetSignatureTemporalStructure {
  isTimeSeries?: boolean;
  trendDirection?: 'flat' | 'up' | 'down';
  hasSeasonality?: boolean;
  periodicityCount?: number;
}

export interface DatasetSignatureSpatialStructure {
  isGeospatial?: boolean;
  coordinateDimensions?: number;
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
  /**
   * Present on canonical/builders created by Nemosyne. Optional only so older
   * persisted/test fixtures can be loaded during migration; absence means the
   * source class is itself unknown and MUST NOT be assumed to be kernel evidence.
   */
  epistemic?: DatasetSignatureEpistemic;
  preferredFamilies?: RepresentationFamily[];
}

function markObservedMinimalFacts(
  epistemic: DatasetSignatureEpistemic,
  temporalCount: number,
): void {
  for (const path of [
    'schema.numericCount',
    'schema.categoricalCount',
    'schema.temporalCount',
    'cardinality.rowCount',
    'cardinality.columnCount',
    'cardinality.edgeCount',
  ] as const) {
    markDatasetSignatureFact(epistemic, path, 'derived', {
      note: 'Directly supplied structural/cardinality input to minimalDatasetSignature',
    });
  }
  markDatasetSignatureFact(epistemic, 'topologicalStructure.topology', 'prior', {
    note: 'Minimal signature defaults to TABULAR; this is not analytical topology evidence',
  });
  if (temporalCount > 0) {
    epistemic.facts['temporalStructure.isTimeSeries'].note =
      'Temporal columns alone do not prove time-series structure';
  }
}

export function minimalDatasetSignature(
  rowCountOrFp: number | string = 'unknown',
  numericCountOrKernel: number | string = 'unknown',
  categoricalCountOrNow: number = Date.now(),
  temporalCount = 0,
  fingerprint = 'unknown',
  timestamp = Date.now()
): DatasetSignature {
  const epistemic = createUnknownDatasetSignatureEpistemic();

  if (typeof rowCountOrFp === 'number') {
    const rowCount = rowCountOrFp;
    const numericCount = typeof numericCountOrKernel === 'number' ? numericCountOrKernel : 0;
    const categoricalCount = categoricalCountOrNow;
    markObservedMinimalFacts(epistemic, temporalCount);
    return {
      schema: {
        numericCount,
        categoricalCount,
        temporalCount,
      },
      cardinality: {
        rowCount,
        columnCount: numericCount + categoricalCount + temporalCount,
        edgeCount: 0,
        depth: 0,
      },
      distribution: {},
      dependence: {},
      clusterStructure: {},
      topologicalStructure: {
        topology: 'TABULAR',
      },
      temporalStructure: {},
      spatialStructure: {},
      spectralStructure: null,
      provenance: {
        datasetFingerprint: fingerprint,
        kernelVersion: 'unknown',
        analysisTimestamp: timestamp,
        timestamp,
        engine: 'minimal-signature',
      },
      epistemic,
    };
  }

  const fp = String(rowCountOrFp);
  const kernel = String(numericCountOrKernel);
  const now = typeof categoricalCountOrNow === 'number' ? categoricalCountOrNow : Date.now();
  markDatasetSignatureFact(epistemic, 'topologicalStructure.topology', 'prior', {
    note: 'Legacy minimal signature defaults to TABULAR with no analytical topology evidence',
  });

  return {
    schema: {
      numericCount: 0,
      categoricalCount: 0,
      temporalCount: 0,
    },
    cardinality: {
      rowCount: 0,
      columnCount: 0,
      edgeCount: 0,
      depth: 0,
    },
    distribution: {},
    dependence: {},
    clusterStructure: {},
    topologicalStructure: {
      topology: 'TABULAR',
    },
    temporalStructure: {},
    spatialStructure: {},
    spectralStructure: null,
    provenance: {
      datasetFingerprint: fp,
      kernelVersion: kernel,
      analysisTimestamp: now,
      timestamp: now,
      engine: 'minimal-signature',
    },
    epistemic,
  };
}
