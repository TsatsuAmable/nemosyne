import {
  assertDatasetEvidence,
  type AnalyticalEvidence,
  type DatasetEvidence,
  type JsonValue,
} from '../../data/evidence/DatasetEvidence.ts';
import type { TopologyTypeValue } from '../types.ts';
import type { DatasetSignature, SpectralFacts } from './DatasetSignature.ts';

function objectValue(value: JsonValue, label: string): Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`DatasetEvidence field '${label}' must be an object`);
  }
  return value as Record<string, JsonValue>;
}

function finiteNumber(value: JsonValue | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`DatasetEvidence field '${label}' must be a finite number`);
  }
  return value;
}

function booleanValue(value: JsonValue | undefined, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`DatasetEvidence field '${label}' must be a boolean`);
  }
  return value;
}

function stringValue(value: JsonValue | undefined, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`DatasetEvidence field '${label}' must be a string`);
  }
  return value;
}

function finiteNumberArray(value: JsonValue | undefined, label: string): number[] {
  if (!Array.isArray(value)) {
    throw new Error(`DatasetEvidence field '${label}' must be an array`);
  }
  return value.map((item, index) => finiteNumber(item, `${label}[${index}]`));
}

function evidenceMap(evidence: DatasetEvidence): Map<string, AnalyticalEvidence> {
  return new Map(evidence.evidence.map((item) => [item.id, item]));
}

function required(
  items: ReadonlyMap<string, AnalyticalEvidence>,
  id: string,
): AnalyticalEvidence {
  const item = items.get(id);
  if (!item) throw new Error(`DatasetEvidence missing required analytical fact: ${id}`);
  return item;
}

function optionalObject(
  items: ReadonlyMap<string, AnalyticalEvidence>,
  id: string,
): Record<string, JsonValue> | null {
  const item = items.get(id);
  return item ? objectValue(item.value, id) : null;
}

function inferTopology(
  graph: Record<string, JsonValue> | null,
  hierarchy: Record<string, JsonValue> | null,
  temporal: Record<string, JsonValue> | null,
  spatial: Record<string, JsonValue> | null,
): TopologyTypeValue {
  if (graph && booleanValue(graph.isGraph, 'graph.isGraph')) return 'GRAPH';
  if (hierarchy && booleanValue(hierarchy.isHierarchy, 'hierarchy.isHierarchy')) return 'HIERARCHY';
  if (temporal && booleanValue(temporal.isTimeSeries, 'temporal.isTimeSeries')) return 'TIME_SERIES';
  if (spatial && booleanValue(spatial.isGeospatial, 'spatial.isGeospatial')) return 'GEO';
  return 'TABULAR';
}

function spectralFacts(spectral: Record<string, JsonValue> | null): SpectralFacts | null {
  if (!spectral) return null;
  return {
    dominantFrequencies: finiteNumberArray(
      spectral.dominantFrequencies,
      'spectral.dominantFrequencies',
    ),
    spectralEntropy: finiteNumber(spectral.spectralEntropy, 'spectral.spectralEntropy'),
    powerSpectrumPeak: finiteNumber(spectral.powerSpectrumPeak, 'spectral.powerSpectrumPeak'),
    hasPeriodicity: booleanValue(
      spectral.heuristicPeriodicityDetected,
      'spectral.heuristicPeriodicityDetected',
    ),
    periodicityHeuristicScore: finiteNumber(
      spectral.periodicityHeuristicScore,
      'spectral.periodicityHeuristicScore',
    ),
  };
}

/**
 * Build the canonical Moneta DatasetSignature directly from provenance-bearing
 * Rust DatasetEvidence. No analytical value is recomputed or filled with a
 * TypeScript placeholder. Fields absent from the current Rust profile remain
 * absent/optional in the signature contract.
 */
export function datasetEvidenceToSignature(evidence: DatasetEvidence): DatasetSignature {
  assertDatasetEvidence(evidence);
  const items = evidenceMap(evidence);

  const cardinality = objectValue(required(items, 'cardinality:dataset').value, 'cardinality:dataset');
  const dimensionality = objectValue(required(items, 'schema:dimensionality').value, 'schema:dimensionality');
  const numeric = objectValue(required(items, 'distribution:numeric').value, 'distribution:numeric');
  const categorical = objectValue(required(items, 'distribution:categorical').value, 'distribution:categorical');
  const density = objectValue(required(items, 'density:global').value, 'density:global');
  const clusters = objectValue(required(items, 'cluster:global').value, 'cluster:global');
  const anomalies = objectValue(required(items, 'anomaly:global').value, 'anomaly:global');
  const dependency = objectValue(required(items, 'dependency:correlations').value, 'dependency:correlations');

  const graph = optionalObject(items, 'topology:graph');
  const hierarchy = optionalObject(items, 'topology:hierarchy');
  const temporal = optionalObject(items, 'temporal:global');
  const spatial = optionalObject(items, 'scale:spatial');
  const spectral = optionalObject(items, 'spectral:global');
  const topology = inferTopology(graph, hierarchy, temporal, spatial);

  const isTimeSeries = temporal
    ? booleanValue(temporal.isTimeSeries, 'temporal.isTimeSeries')
    : false;
  const trendDirectionRaw = temporal
    ? stringValue(temporal.trendDirection, 'temporal.trendDirection')
    : 'flat';
  if (!['flat', 'up', 'down'].includes(trendDirectionRaw)) {
    throw new Error(`DatasetEvidence temporal trend direction is unsupported: ${trendDirectionRaw}`);
  }
  const periodicities = temporal?.periodicities;
  if (periodicities !== undefined && !Array.isArray(periodicities)) {
    throw new Error("DatasetEvidence field 'temporal.periodicities' must be an array");
  }

  const isGeospatial = spatial
    ? booleanValue(spatial.isGeospatial, 'spatial.isGeospatial')
    : false;
  const coordinateDimensions = spatial
    ? finiteNumber(spatial.coordinateDimensions, 'spatial.coordinateDimensions')
    : 0;

  return {
    schema: {
      numericCount: finiteNumber(dimensionality.numericColumns, 'dimensionality.numericColumns'),
      categoricalCount: finiteNumber(
        dimensionality.categoricalColumns,
        'dimensionality.categoricalColumns',
      ),
      temporalCount: finiteNumber(dimensionality.temporalColumns, 'dimensionality.temporalColumns'),
      ...(isGeospatial ? { geoCount: coordinateDimensions } : {}),
    },
    cardinality: {
      rowCount: finiteNumber(cardinality.rowCount, 'cardinality.rowCount'),
      columnCount: finiteNumber(cardinality.columnCount, 'cardinality.columnCount'),
      edgeCount: graph ? finiteNumber(graph.edgeCount, 'graph.edgeCount') : 0,
      depth: hierarchy ? finiteNumber(hierarchy.depth, 'hierarchy.depth') : 0,
    },
    distribution: {
      hasOutliers: booleanValue(numeric.globalHasOutliers, 'numeric.globalHasOutliers'),
      outlierFraction: finiteNumber(anomalies.anomalyFraction, 'anomalies.anomalyFraction'),
      anomalyCount: finiteNumber(anomalies.totalAnomalies, 'anomalies.totalAnomalies'),
      highVariance: booleanValue(numeric.globalHighVariance, 'numeric.globalHighVariance'),
      maxSkewness: finiteNumber(numeric.maxSkewness, 'numeric.maxSkewness'),
      meanEntropy: finiteNumber(categorical.meanEntropy, 'categorical.meanEntropy'),
    },
    dependence: {
      maxCorrelation: finiteNumber(
        dependency.maxAbsolutePearsonCorrelation,
        'dependency.maxAbsolutePearsonCorrelation',
      ),
      significantPairsCount: finiteNumber(
        dependency.strongCorrelationPairCount,
        'dependency.strongCorrelationPairCount',
      ),
      rankDeficiency: booleanValue(
        dependency.heuristicRankDeficiency,
        'dependency.heuristicRankDeficiency',
      ),
    },
    clusterStructure: {
      estimatedCount: finiteNumber(clusters.heuristicEstimatedCount, 'clusters.heuristicEstimatedCount'),
      hasClusters: booleanValue(
        clusters.heuristicPartitionDetected,
        'clusters.heuristicPartitionDetected',
      ),
      separationScore: finiteNumber(
        clusters.heuristicSeparationScore,
        'clusters.heuristicSeparationScore',
      ),
      densityVariation: finiteNumber(
        clusters.heuristicDensityVariation,
        'clusters.heuristicDensityVariation',
      ),
    },
    topologicalStructure: {
      topology,
      ...(graph ? { hasCycles: booleanValue(graph.hasCycles, 'graph.hasCycles') } : {}),
    },
    temporalStructure: {
      isTimeSeries,
      trendDirection: trendDirectionRaw as 'flat' | 'up' | 'down',
      hasSeasonality: temporal
        ? booleanValue(
            temporal.heuristicSeasonalityDetected,
            'temporal.heuristicSeasonalityDetected',
          )
        : false,
      ...(Array.isArray(periodicities) ? { periodicityCount: periodicities.length } : {}),
    },
    spatialStructure: {
      isGeospatial,
      coordinateDimensions,
    },
    spectralStructure: spectralFacts(spectral),
    provenance: {
      datasetFingerprint: evidence.datasetFingerprint,
      kernelVersion: evidence.kernelVersion,
      analysisTimestamp: 0,
      timestamp: 0,
      engine: 'DatasetEvidence',
      version: evidence.schemaVersion,
    },
  };
}

/**
 * Ensure a caller-provided signature does not disagree with the authoritative
 * evidence-derived signature on any field used by the current FitnessModel.
 */
export function assertDecisionRelevantSignatureMatchesEvidence(
  provided: DatasetSignature,
  authoritative: DatasetSignature,
): void {
  const checks: Array<[unknown, unknown, string]> = [
    [provided.provenance.datasetFingerprint, authoritative.provenance.datasetFingerprint, 'dataset fingerprint'],
    [provided.provenance.kernelVersion, authoritative.provenance.kernelVersion, 'kernel version'],
    [provided.cardinality.rowCount, authoritative.cardinality.rowCount, 'row count'],
    [provided.cardinality.columnCount, authoritative.cardinality.columnCount, 'column count'],
    [provided.cardinality.edgeCount, authoritative.cardinality.edgeCount, 'edge count'],
    [provided.cardinality.depth, authoritative.cardinality.depth, 'hierarchy depth'],
    [provided.schema.numericCount, authoritative.schema.numericCount, 'numeric column count'],
    [provided.schema.categoricalCount, authoritative.schema.categoricalCount, 'categorical column count'],
    [provided.schema.temporalCount, authoritative.schema.temporalCount, 'temporal column count'],
    [provided.distribution.hasOutliers, authoritative.distribution.hasOutliers, 'outlier presence'],
    [provided.distribution.highVariance, authoritative.distribution.highVariance, 'high variance'],
    [provided.clusterStructure.hasClusters, authoritative.clusterStructure.hasClusters, 'cluster presence'],
    [provided.clusterStructure.densityVariation, authoritative.clusterStructure.densityVariation, 'density variation'],
    [provided.topologicalStructure.topology, authoritative.topologicalStructure.topology, 'topology'],
    [provided.temporalStructure.isTimeSeries, authoritative.temporalStructure.isTimeSeries, 'time-series structure'],
    [provided.spectralStructure?.hasPeriodicity ?? false, authoritative.spectralStructure?.hasPeriodicity ?? false, 'spectral periodicity'],
  ];

  for (const [actual, expected, label] of checks) {
    if (actual !== expected) {
      throw new Error(
        `DatasetEvidence / DatasetSignature mismatch for ${label}: evidence=${String(expected)}, signature=${String(actual)}`,
      );
    }
  }
}
