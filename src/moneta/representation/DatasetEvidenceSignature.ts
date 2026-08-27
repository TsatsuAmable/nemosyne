import {
  assertDatasetEvidence,
  type AnalyticalEvidence,
  type DatasetEvidence,
  type JsonValue,
} from '../../data/evidence/DatasetEvidence.ts';
import type { TopologyTypeValue } from '../types.ts';
import {
  createUnknownDatasetSignatureEpistemic,
  markDatasetSignatureFact,
  type DatasetSignature,
  type DatasetSignatureEpistemic,
  type DatasetSignatureEvidenceSource,
  type DatasetSignatureFactPath,
  type SpectralFacts,
} from './DatasetSignature.ts';

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

function optional(
  items: ReadonlyMap<string, AnalyticalEvidence>,
  id: string,
): AnalyticalEvidence | null {
  return items.get(id) ?? null;
}

function optionalObject(item: AnalyticalEvidence | null): Record<string, JsonValue> | null {
  return item ? objectValue(item.value, item.id) : null;
}

function markFromEvidence(
  epistemic: DatasetSignatureEpistemic,
  path: DatasetSignatureFactPath,
  source: DatasetSignatureEvidenceSource,
  item: AnalyticalEvidence,
  note?: string,
): void {
  markDatasetSignatureFact(epistemic, path, source, {
    evidenceId: item.id,
    method: item.provenance.method,
    ...(note ? { note } : {}),
  });
}

function markManyFromEvidence(
  epistemic: DatasetSignatureEpistemic,
  paths: readonly DatasetSignatureFactPath[],
  source: DatasetSignatureEvidenceSource,
  item: AnalyticalEvidence,
  note?: string,
): void {
  for (const path of paths) markFromEvidence(epistemic, path, source, item, note);
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
      spectral.dominantFrequenciesPerTimeUnit,
      'spectral.dominantFrequenciesPerTimeUnit',
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
    ...(typeof spectral.method === 'string' ? { method: spectral.method } : {}),
    ...(typeof spectral.observedCount === 'number'
      ? { observedCount: finiteNumber(spectral.observedCount, 'spectral.observedCount') }
      : {}),
    ...(typeof spectral.transformLength === 'number'
      ? { transformLength: finiteNumber(spectral.transformLength, 'spectral.transformLength') }
      : {}),
    ...(typeof spectral.sourceObservationsPerBin === 'number'
      ? {
          sourceObservationsPerBin: finiteNumber(
            spectral.sourceObservationsPerBin,
            'spectral.sourceObservationsPerBin',
          ),
        }
      : {}),
    ...(typeof spectral.frequencyResolutionPerTimeUnit === 'number'
      ? {
          frequencyResolution: finiteNumber(
            spectral.frequencyResolutionPerTimeUnit,
            'spectral.frequencyResolutionPerTimeUnit',
          ),
        }
      : {}),
    ...(typeof spectral.maximumFrequencyPerTimeUnit === 'number'
      ? {
          maximumFrequency: finiteNumber(
            spectral.maximumFrequencyPerTimeUnit,
            'spectral.maximumFrequencyPerTimeUnit',
          ),
        }
      : {}),
    ...(typeof spectral.windowFunction === 'string'
      ? { windowFunction: spectral.windowFunction }
      : {}),
  };
}

/**
 * Build the canonical Moneta DatasetSignature directly from provenance-bearing
 * Rust DatasetEvidence. No analytical value is recomputed or filled with a
 * TypeScript placeholder. The per-fact epistemic map preserves whether a Rust
 * value is a descriptive measurement, exact derivation, or explicitly named
 * bootstrap heuristic.
 */
export function datasetEvidenceToSignature(evidence: DatasetEvidence): DatasetSignature {
  assertDatasetEvidence(evidence);
  const items = evidenceMap(evidence);
  const epistemic = createUnknownDatasetSignatureEpistemic(
    'Canonical DatasetEvidence did not provide this fact',
  );

  const cardinalityItem = required(items, 'cardinality:dataset');
  const dimensionalityItem = required(items, 'schema:dimensionality');
  const numericItem = required(items, 'distribution:numeric');
  const categoricalItem = required(items, 'distribution:categorical');
  const densityItem = required(items, 'density:global');
  const clustersItem = required(items, 'cluster:global');
  const anomaliesItem = required(items, 'anomaly:global');
  const dependencyItem = required(items, 'dependency:correlations');

  const cardinality = objectValue(cardinalityItem.value, cardinalityItem.id);
  const dimensionality = objectValue(dimensionalityItem.value, dimensionalityItem.id);
  const numeric = objectValue(numericItem.value, numericItem.id);
  const categorical = objectValue(categoricalItem.value, categoricalItem.id);
  objectValue(densityItem.value, densityItem.id);
  const clusters = objectValue(clustersItem.value, clustersItem.id);
  const anomalies = objectValue(anomaliesItem.value, anomaliesItem.id);
  const dependency = objectValue(dependencyItem.value, dependencyItem.id);

  const graphItem = optional(items, 'topology:graph');
  const hierarchyItem = optional(items, 'topology:hierarchy');
  const temporalItem = optional(items, 'temporal:global');
  const spatialItem = optional(items, 'scale:spatial');
  const spectralItem = optional(items, 'spectral:global');

  const graph = optionalObject(graphItem);
  const hierarchy = optionalObject(hierarchyItem);
  const temporal = optionalObject(temporalItem);
  const spatial = optionalObject(spatialItem);
  const spectral = optionalObject(spectralItem);
  const topology = inferTopology(graph, hierarchy, temporal, spatial);

  markManyFromEvidence(
    epistemic,
    ['cardinality.rowCount', 'cardinality.columnCount'],
    'derived',
    cardinalityItem,
    'Exact structural cardinality from the Rust dataset lineage',
  );
  markManyFromEvidence(
    epistemic,
    ['schema.numericCount', 'schema.categoricalCount', 'schema.temporalCount'],
    'derived',
    dimensionalityItem,
    'Exact schema classification emitted by Rust',
  );

  markFromEvidence(
    epistemic,
    'distribution.hasOutliers',
    'heuristic',
    numericItem,
    'Outlier presence depends on the kernel outlier rule and is not a calibrated probability',
  );
  markFromEvidence(epistemic, 'distribution.maxSkewness', 'measured', numericItem);
  markFromEvidence(
    epistemic,
    'distribution.highVariance',
    'heuristic',
    numericItem,
    'High-variance is a kernel threshold classification, not a scale-free scientific fact',
  );
  markFromEvidence(epistemic, 'distribution.meanEntropy', 'measured', categoricalItem);
  markManyFromEvidence(
    epistemic,
    ['distribution.outlierFraction', 'distribution.anomalyCount'],
    'heuristic',
    anomaliesItem,
    'Anomaly quantities inherit the kernel anomaly rule',
  );

  markFromEvidence(epistemic, 'dependence.maxCorrelation', 'measured', dependencyItem);
  markFromEvidence(
    epistemic,
    'dependence.significantPairsCount',
    'heuristic',
    dependencyItem,
    'Pair count uses a magnitude threshold; it is not statistical significance',
  );
  markFromEvidence(
    epistemic,
    'dependence.rankDeficiency',
    'heuristic',
    dependencyItem,
    'Rust field is explicitly heuristicRankDeficiency',
  );

  markManyFromEvidence(
    epistemic,
    [
      'clusterStructure.estimatedCount',
      'clusterStructure.hasClusters',
      'clusterStructure.separationScore',
      'clusterStructure.densityVariation',
    ],
    'heuristic',
    clustersItem,
    'Bounded Rust clustering profile; heuristic terminology is preserved',
  );

  const topologyEvidence = graphItem ?? hierarchyItem ?? temporalItem ?? spatialItem;
  if (topologyEvidence) {
    markFromEvidence(
      epistemic,
      'topologicalStructure.topology',
      'derived',
      topologyEvidence,
      'Topology is derived from authoritative Rust structure-profile evidence',
    );
  } else {
    markDatasetSignatureFact(epistemic, 'topologicalStructure.topology', 'derived', {
      method: 'structure-profile/topology-absence',
      note: 'No structured topology profile was emitted; canonical structure profile classifies the dataset as TABULAR',
    });
  }

  const edgeCount = graph ? finiteNumber(graph.edgeCount, 'graph.edgeCount') : 0;
  if (graphItem) {
    markFromEvidence(epistemic, 'cardinality.edgeCount', 'derived', graphItem);
    markFromEvidence(
      epistemic,
      'topologicalStructure.hasCycles',
      'derived',
      graphItem,
      'Exact directed-cycle result from Rust graph analysis',
    );
  } else {
    markDatasetSignatureFact(epistemic, 'cardinality.edgeCount', 'derived', {
      method: 'structure-profile/graph-absence',
      note: 'No graph profile was emitted by the authoritative structure profile',
    });
  }

  const depth = hierarchy ? finiteNumber(hierarchy.depth, 'hierarchy.depth') : 0;
  if (hierarchyItem) {
    markFromEvidence(epistemic, 'cardinality.depth', 'derived', hierarchyItem);
  }

  const temporalStructure: DatasetSignature['temporalStructure'] = {};
  if (temporal && temporalItem) {
    temporalStructure.isTimeSeries = booleanValue(temporal.isTimeSeries, 'temporal.isTimeSeries');
    const trendDirectionRaw = stringValue(temporal.trendDirection, 'temporal.trendDirection');
    if (!['flat', 'up', 'down'].includes(trendDirectionRaw)) {
      throw new Error(`DatasetEvidence temporal trend direction is unsupported: ${trendDirectionRaw}`);
    }
    temporalStructure.trendDirection = trendDirectionRaw as 'flat' | 'up' | 'down';
    temporalStructure.hasSeasonality = booleanValue(
      temporal.heuristicSeasonalityDetected,
      'temporal.heuristicSeasonalityDetected',
    );
    const periodicities = temporal.periodicities;
    if (periodicities !== undefined && !Array.isArray(periodicities)) {
      throw new Error("DatasetEvidence field 'temporal.periodicities' must be an array");
    }
    if (Array.isArray(periodicities)) temporalStructure.periodicityCount = periodicities.length;

    markFromEvidence(epistemic, 'temporalStructure.isTimeSeries', 'derived', temporalItem);
    markFromEvidence(
      epistemic,
      'temporalStructure.trendDirection',
      'heuristic',
      temporalItem,
      'Trend direction discretizes an analytical slope into a categorical label',
    );
    markFromEvidence(
      epistemic,
      'temporalStructure.hasSeasonality',
      'heuristic',
      temporalItem,
      'Rust field is explicitly heuristicSeasonalityDetected',
    );
    if (Array.isArray(periodicities)) {
      markFromEvidence(epistemic, 'temporalStructure.periodicityCount', 'derived', temporalItem);
    }
  }

  const spatialStructure: DatasetSignature['spatialStructure'] = {};
  let geoCount: number | undefined;
  if (spatial && spatialItem) {
    const isGeospatial = booleanValue(spatial.isGeospatial, 'spatial.isGeospatial');
    const coordinateDimensions = finiteNumber(
      spatial.coordinateDimensions,
      'spatial.coordinateDimensions',
    );
    spatialStructure.isGeospatial = isGeospatial;
    spatialStructure.coordinateDimensions = coordinateDimensions;
    if (isGeospatial) geoCount = coordinateDimensions;
    markManyFromEvidence(
      epistemic,
      ['spatialStructure.isGeospatial', 'spatialStructure.coordinateDimensions'],
      'derived',
      spatialItem,
    );
    if (isGeospatial) markFromEvidence(epistemic, 'schema.geoCount', 'derived', spatialItem);
  }

  const spectralStructure = spectralFacts(spectral);
  if (spectralItem && spectralStructure) {
    markManyFromEvidence(
      epistemic,
      [
        'spectralStructure.dominantFrequencies',
        'spectralStructure.spectralEntropy',
        'spectralStructure.powerSpectrumPeak',
      ],
      'measured',
      spectralItem,
    );
    markManyFromEvidence(
      epistemic,
      ['spectralStructure.hasPeriodicity', 'spectralStructure.periodicityHeuristicScore'],
      'heuristic',
      spectralItem,
      'Periodicity detection/score is explicitly heuristic',
    );
    const derivedSpectralFacts: Array<[DatasetSignatureFactPath, unknown]> = [
      ['spectralStructure.method', spectralStructure.method],
      ['spectralStructure.observedCount', spectralStructure.observedCount],
      ['spectralStructure.transformLength', spectralStructure.transformLength],
      ['spectralStructure.sourceObservationsPerBin', spectralStructure.sourceObservationsPerBin],
      ['spectralStructure.frequencyResolution', spectralStructure.frequencyResolution],
      ['spectralStructure.maximumFrequency', spectralStructure.maximumFrequency],
      ['spectralStructure.windowFunction', spectralStructure.windowFunction],
    ];
    for (const [path, value] of derivedSpectralFacts) {
      if (value !== undefined) markFromEvidence(epistemic, path, 'derived', spectralItem);
    }
  }

  return {
    schema: {
      numericCount: finiteNumber(dimensionality.numericColumns, 'dimensionality.numericColumns'),
      categoricalCount: finiteNumber(
        dimensionality.categoricalColumns,
        'dimensionality.categoricalColumns',
      ),
      temporalCount: finiteNumber(dimensionality.temporalColumns, 'dimensionality.temporalColumns'),
      ...(geoCount !== undefined ? { geoCount } : {}),
    },
    cardinality: {
      rowCount: finiteNumber(cardinality.rowCount, 'cardinality.rowCount'),
      columnCount: finiteNumber(cardinality.columnCount, 'cardinality.columnCount'),
      edgeCount,
      depth,
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
    temporalStructure,
    spatialStructure,
    spectralStructure,
    provenance: {
      datasetFingerprint: evidence.datasetFingerprint,
      kernelVersion: evidence.kernelVersion,
      analysisTimestamp: 0,
      timestamp: 0,
      engine: 'DatasetEvidence',
      version: evidence.schemaVersion,
    },
    epistemic,
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
