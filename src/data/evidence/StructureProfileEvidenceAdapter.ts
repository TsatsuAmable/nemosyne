import {
  DATASET_EVIDENCE_SCHEMA_VERSION,
  createDatasetEvidence,
  type AnalyticalEvidence,
  type AnalyticalMethodProvenance,
  type DatasetEvidence,
  type EvidenceCategory,
  type JsonValue,
} from './DatasetEvidence.ts';
import type { RustDatasetStructureProfile } from './RustStructureProfile.ts';

/**
 * Provenance limitation carried forward from the current Rust structure-profile
 * ABI. The kernel exposes suite-level provenance plus explicit manifests for
 * bounded clustering and spectral estimators, not yet every statistic. We
 * state that limitation instead of manufacturing false precision here.
 */
const PROFILE_PROVENANCE_LIMITATION =
  'Rust DatasetStructureProfile exposes suite-level provenance by default; bounded spectral and clustering estimators additionally expose parameter manifests at the kernel ABI.';

const HEURISTIC_TERMINOLOGY_LIMITATION =
  'Some DatasetStructureProfile values are bootstrap heuristics. Canonical DatasetEvidence uses heuristic terminology and does not interpret them as statistical confidence or significance.';

function provenance(
  profile: RustDatasetStructureProfile,
  method: string,
  parameters: Readonly<Record<string, JsonValue>> = {},
  samplingPolicy = 'full-dataset except kernel-bounded internal approximations',
  methodLimitations: readonly string[] = []
): AnalyticalMethodProvenance {
  return {
    method,
    methodVersion: profile.provenance.algorithmSuite,
    kernelVersion: profile.provenance.kernelVersion,
    parameters,
    deterministic: true,
    normalization: 'kernel-defined; see DatasetStructureProfile algorithm suite',
    missingDataPolicy: 'kernel-defined; reported separately by missingness profile',
    samplingPolicy,
    limitations: [
      PROFILE_PROVENANCE_LIMITATION,
      HEURISTIC_TERMINOLOGY_LIMITATION,
      ...methodLimitations,
    ],
  };
}

function item(
  profile: RustDatasetStructureProfile,
  id: string,
  category: EvidenceCategory,
  name: string,
  value: JsonValue,
  method: string,
  parameters: Readonly<Record<string, JsonValue>> = {},
  samplingPolicy = 'full-dataset except kernel-bounded internal approximations',
  methodLimitations: readonly string[] = []
): AnalyticalEvidence {
  return {
    id,
    category,
    name,
    value,
    provenance: provenance(profile, method, parameters, samplingPolicy, methodLimitations),
    uncertainty: { kind: 'none' },
  };
}

/**
 * Convert the authoritative Rust structure profile into the canonical V3
 * DatasetEvidence transport envelope.
 *
 * No analytical values are recomputed here. This adapter only names, groups,
 * validates, and transports facts already emitted by Rust/WASM. Legacy Rust
 * field names that overstate statistical meaning are intentionally translated
 * to epistemically narrower names at this canonical evidence boundary.
 */
export function structureProfileToDatasetEvidence(
  profile: RustDatasetStructureProfile
): DatasetEvidence {
  const evidence: AnalyticalEvidence[] = [
    item(
      profile,
      'cardinality:dataset',
      'cardinality',
      'dataset-cardinality',
      { rowCount: profile.rowCount, columnCount: profile.columnCount },
      'structure-profile/cardinality'
    ),
    item(
      profile,
      'schema:dimensionality',
      'schema',
      'dataset-dimensionality',
      {
        totalColumns: profile.dimensionality.totalColumns,
        numericColumns: profile.dimensionality.numericColumns,
        categoricalColumns: profile.dimensionality.categoricalColumns,
        temporalColumns: profile.dimensionality.temporalColumns,
        constantColumns: profile.dimensionality.constantColumns,
        redundantColumns: profile.dimensionality.redundantColumns,
        effectiveDimensions: profile.dimensionality.effectiveDimensions,
      },
      'structure-profile/dimensionality'
    ),
    item(
      profile,
      'distribution:numeric',
      'distribution',
      'numeric-distributions',
      {
        summaries: profile.distributions.numericSummaries.map((summary) => ({
          column: summary.column,
          mean: summary.mean,
          median: summary.median,
          stdDev: summary.stdDev,
          variance: summary.variance,
          min: summary.min,
          max: summary.max,
          iqr: summary.iqr,
          skewness: summary.skewness,
          kurtosis: summary.kurtosis,
          outlierCount: summary.outlierCount,
          isMultimodal: summary.isMultimodal,
          isHeavyTailed: summary.isHeavyTailed,
        })),
        globalHasOutliers: profile.distributions.globalHasOutliers,
        globalHighVariance: profile.distributions.globalHighVariance,
        maxSkewness: profile.distributions.maxSkewness,
      },
      'structure-profile/distributions'
    ),
    item(
      profile,
      'density:global',
      'density',
      'density-profile',
      {
        globalDensity: profile.density.globalDensity,
        heuristicLocalDensityVariation: profile.density.localDensityVariation,
        heuristicModeCount: profile.density.modeCount,
        isSparse: profile.density.isSparse,
      },
      'structure-profile/density'
    ),
    item(
      profile,
      'cluster:global',
      'cluster',
      'cluster-profile',
      {
        heuristicEstimatedCount: profile.clusters.estimatedCount,
        heuristicPartitionDetected: profile.clusters.hasClusters,
        heuristicSeparationScore: profile.clusters.separationScore,
        heuristicDensityVariation: profile.clusters.densityVariation,
        legacySilhouetteDerivedScore: profile.clusters.stabilityConfidence,
        method: profile.clusters.method,
        eligibleObservationCount: profile.clusters.eligibleObservationCount,
        sampleCount: profile.clusters.sampleCount,
        samplingSeed: profile.clusters.samplingSeed,
        sourceObservationsPerSample: profile.clusters.sourceObservationsPerSample,
        normalization: profile.clusters.normalization,
        maximumCandidateClusters: profile.clusters.maximumCandidateClusters,
        iterations: profile.clusters.iterations,
        silhouetteSampleCount: profile.clusters.silhouetteSampleCount,
      },
      'structure-profile/clusters',
      {
        estimator: profile.clusters.method,
        eligibleObservationCount: profile.clusters.eligibleObservationCount,
        sampleCount: profile.clusters.sampleCount,
        samplingSeed: profile.clusters.samplingSeed,
        sourceObservationsPerSample: profile.clusters.sourceObservationsPerSample,
        normalization: profile.clusters.normalization,
        maximumCandidateClusters: profile.clusters.maximumCandidateClusters,
        iterations: profile.clusters.iterations,
        silhouetteSampleCount: profile.clusters.silhouetteSampleCount,
      },
      profile.clusters.sourceObservationsPerSample <= 1
        ? 'full complete-row population'
        : 'fixed-seed content-hash bottom-k sample of complete rows; full population used for normalization bounds',
      [
        'Cluster count and separation are bootstrap k-means heuristics over candidate k=2..3; bounded runs inherit fixed-seed bottom-k sampling error.',
      ]
    ),
    item(
      profile,
      'anomaly:global',
      'anomaly',
      'anomaly-profile',
      {
        totalAnomalies: profile.anomalies.totalAnomalies,
        anomalyFraction: profile.anomalies.anomalyFraction,
        heuristicAnomalyDetected: profile.anomalies.hasAnomalies,
        maxAnomalyScore: profile.anomalies.maxAnomalyScore,
      },
      'structure-profile/anomalies'
    ),
    item(
      profile,
      'dependency:correlations',
      'dependency',
      'correlation-profile',
      {
        pairs: profile.correlations.pairs.map((pair) => ({
          columnA: pair.columnA,
          columnB: pair.columnB,
          r: pair.r,
          isStrongByMagnitudeThreshold: pair.isStrong,
        })),
        maxAbsolutePearsonCorrelation: profile.correlations.maxCorrelation,
        strongCorrelationPairCount: profile.correlations.significantPairsCount,
        heuristicRankDeficiency: profile.correlations.isRankDeficient,
      },
      'structure-profile/correlations'
    ),
    item(
      profile,
      'distribution:categorical',
      'distribution',
      'categorical-profile',
      {
        summaries: profile.categorical.summaries.map((summary) => ({
          column: summary.column,
          cardinality: summary.cardinality,
          entropy: summary.entropy,
          topCategories: summary.topCategories.map((bucket) => ({
            value: bucket.value,
            count: bucket.count,
            fraction: bucket.fraction,
          })),
          isHighCardinality: summary.isHighCardinality,
        })),
        meanEntropy: profile.categorical.meanEntropy,
        hasHighCardinality: profile.categorical.hasHighCardinality,
      },
      'structure-profile/categorical'
    ),
    item(
      profile,
      'schema:missingness',
      'schema',
      'missingness-profile',
      {
        totalMissing: profile.missingness.totalMissing,
        missingFraction: profile.missingness.missingFraction,
        hasMissingness: profile.missingness.hasMissingness,
        columnMissingness: profile.missingness.columnMissingness,
      },
      'structure-profile/missingness'
    ),
  ];

  if (profile.temporal) {
    evidence.push(
      item(
        profile,
        'temporal:global',
        'temporal',
        'temporal-profile',
        {
          isTimeSeries: profile.temporal.isTimeSeries,
          timeColumn: profile.temporal.timeColumn,
          trendDirection: profile.temporal.trendDirection,
          heuristicTrendStrength: profile.temporal.trendStrength,
          heuristicSeasonalityDetected: profile.temporal.hasSeasonality,
          periodicities: profile.temporal.periodicities.map((periodicity) => ({
            frequency: periodicity.frequency,
            periodSamples: periodicity.periodSamples,
            heuristicScore: periodicity.confidence,
          })),
        },
        'structure-profile/temporal'
      )
    );
  }

  if (profile.spectral) {
    evidence.push(
      item(
        profile,
        'spectral:global',
        'spectral',
        'spectral-profile',
        {
          dominantFrequencies: profile.spectral.dominantFrequencies,
          spectralEntropy: profile.spectral.spectralEntropy,
          powerSpectrumPeak: profile.spectral.powerSpectrumPeak,
          heuristicPeriodicityDetected: profile.spectral.hasPeriodicity,
          periodicityHeuristicScore: profile.spectral.periodicityConfidence,
          method: profile.spectral.method,
          observedCount: profile.spectral.observedCount,
          transformLength: profile.spectral.transformLength,
          sourceObservationsPerBin: profile.spectral.sourceObservationsPerBin,
          frequencyResolution: profile.spectral.frequencyResolution,
          maximumFrequency: profile.spectral.maximumFrequency,
          windowFunction: profile.spectral.windowFunction,
        },
        'structure-profile/spectral',
        {
          estimator: profile.spectral.method,
          observedCount: profile.spectral.observedCount,
          transformLength: profile.spectral.transformLength,
          sourceObservationsPerBin: profile.spectral.sourceObservationsPerBin,
          frequencyResolution: profile.spectral.frequencyResolution,
          maximumFrequency: profile.spectral.maximumFrequency,
          windowFunction: profile.spectral.windowFunction,
        },
        profile.spectral.sourceObservationsPerBin === 1
          ? 'full observed sequence; one exact FFT'
          : 'full observed sequence; deterministic contiguous mean-pooling before bounded FFT',
        [
          'Mean pooling preserves full-sequence coverage but suppresses frequencies above the reported maximumFrequency.',
        ]
      )
    );
  }

  if (profile.graph) {
    evidence.push(
      item(
        profile,
        'topology:graph',
        'topology',
        'graph-profile',
        {
          isGraph: profile.graph.isGraph,
          nodeCount: profile.graph.nodeCount,
          edgeCount: profile.graph.edgeCount,
          hasCycles: profile.graph.hasCycles,
          isConnected: profile.graph.isConnected,
        },
        'structure-profile/graph'
      )
    );
  }

  if (profile.hierarchy) {
    evidence.push(
      item(
        profile,
        'topology:hierarchy',
        'topology',
        'hierarchy-profile',
        {
          isHierarchy: profile.hierarchy.isHierarchy,
          depth: profile.hierarchy.depth,
          branchingFactor: profile.hierarchy.branchingFactor,
        },
        'structure-profile/hierarchy'
      )
    );
  }

  if (profile.spatial) {
    evidence.push(
      item(
        profile,
        'scale:spatial',
        'scale',
        'spatial-profile',
        {
          isGeospatial: profile.spatial.isGeospatial,
          coordinateDimensions: profile.spatial.coordinateDimensions,
          latColumn: profile.spatial.latColumn,
          lonColumn: profile.spatial.lonColumn,
        },
        'structure-profile/spatial'
      )
    );
  }

  return createDatasetEvidence({
    schemaVersion: DATASET_EVIDENCE_SCHEMA_VERSION,
    datasetFingerprint: profile.provenance.datasetFingerprint,
    kernelVersion: profile.provenance.kernelVersion,
    evidence,
  });
}
