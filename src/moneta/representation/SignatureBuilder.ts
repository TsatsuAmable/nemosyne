/**
 * SignatureBuilder — compatibility builder for DatasetSignature.
 *
 * Canonical V3 decisions should prefer DatasetEvidenceSignature. This builder
 * must nevertheless be truthful: unsupported analytical values remain absent
 * and its epistemic map records whether each populated fact is measured,
 * derived, heuristic, prior, or unknown.
 */

import type { Dataset } from '../../data/Dataset.ts';
import type { Facts } from '../../data/types.ts';
import {
  createUnknownDatasetSignatureEpistemic,
  markDatasetSignatureFact,
  type DatasetSignature,
  type DatasetSignatureEpistemic,
  type DatasetSignatureEvidenceSource,
  type DatasetSignatureFactPath,
  type SpectralFacts,
} from './DatasetSignature.ts';
import type { RepresentationFamily } from './RepresentationFamily.ts';
import type { MonetaFacts } from '../types.ts';
import type { TopologyType } from '../../types/topology.ts';

function mark(
  epistemic: DatasetSignatureEpistemic,
  paths: readonly DatasetSignatureFactPath[],
  source: DatasetSignatureEvidenceSource,
  note: string,
): void {
  for (const path of paths) markDatasetSignatureFact(epistemic, path, source, { note });
}

function markSpectralFacts(
  epistemic: DatasetSignatureEpistemic,
  spectral: SpectralFacts | null | undefined,
): void {
  if (!spectral) return;
  const measured = [
    'spectralStructure.dominantFrequencies',
    'spectralStructure.spectralEntropy',
    'spectralStructure.powerSpectrumPeak',
  ] as const;
  mark(epistemic, measured, 'measured', 'Supplied spectral analytical result');
  if (spectral.directionalAnisotropy !== undefined) {
    markDatasetSignatureFact(epistemic, 'spectralStructure.directionalAnisotropy', 'measured');
  }
  if (spectral.characteristicScale !== undefined) {
    markDatasetSignatureFact(epistemic, 'spectralStructure.characteristicScale', 'measured');
  }
  markDatasetSignatureFact(epistemic, 'spectralStructure.hasPeriodicity', 'heuristic', {
    note: 'Periodicity detection is a non-calibrated analytical heuristic',
  });
  if (spectral.periodicityConfidence !== undefined) {
    markDatasetSignatureFact(epistemic, 'spectralStructure.periodicityConfidence', 'heuristic');
  }
  if (spectral.periodicityHeuristicScore !== undefined) {
    markDatasetSignatureFact(epistemic, 'spectralStructure.periodicityHeuristicScore', 'heuristic');
  }
  for (const [path, value] of [
    ['spectralStructure.method', spectral.method],
    ['spectralStructure.observedCount', spectral.observedCount],
    ['spectralStructure.transformLength', spectral.transformLength],
    ['spectralStructure.sourceObservationsPerBin', spectral.sourceObservationsPerBin],
    ['spectralStructure.frequencyResolution', spectral.frequencyResolution],
    ['spectralStructure.maximumFrequency', spectral.maximumFrequency],
    ['spectralStructure.windowFunction', spectral.windowFunction],
  ] as const) {
    if (value !== undefined) markDatasetSignatureFact(epistemic, path, 'derived');
  }
}

function meanCategoricalEntropy(facts: Facts): number | undefined {
  if (facts.categorical.length === 0) return undefined;
  return facts.categorical.reduce((sum, category) => sum + category.entropy, 0) /
    facts.categorical.length;
}

function correlationSummary(facts: Facts): {
  maxCorrelation: number;
  significantPairsCount: number;
} {
  let maxCorrelation = 0;
  let significantPairsCount = 0;
  for (const corr of facts.correlation) {
    const absolute = Math.abs(corr.value);
    if (absolute > maxCorrelation) maxCorrelation = absolute;
    if (absolute >= 0.5) significantPairsCount += 1;
  }
  return { maxCorrelation, significantPairsCount };
}

function numericSummary(facts: Facts): {
  totalOutliers: number;
  maxSkewness: number;
} {
  let totalOutliers = 0;
  let maxSkewness = 0;
  for (const stat of facts.numeric) {
    totalOutliers += stat.outlierCount;
    maxSkewness = Math.max(maxSkewness, Math.abs(stat.skew));
  }
  return { totalOutliers, maxSkewness };
}

export function buildDatasetSignature(
  datasetOrFacts: Dataset | MonetaFacts,
  facts?: Facts | null,
  fingerprintOrSpectral?: string | SpectralFacts | null,
  kernelOrFingerprint?: string,
  spectralFacts?: SpectralFacts | null,
  now = Date.now(),
  userHints?: { preferredFamilies?: RepresentationFamily[] }
): DatasetSignature {
  const epistemic = createUnknownDatasetSignatureEpistemic();

  if ('topology' in datasetOrFacts && 'rowCount' in datasetOrFacts && !('columns' in datasetOrFacts)) {
    const mf = datasetOrFacts as MonetaFacts;
    const spectral = (typeof fingerprintOrSpectral === 'object'
      ? fingerprintOrSpectral
      : spectralFacts) as SpectralFacts | null;
    const fingerprintPassedDirectly = typeof fingerprintOrSpectral === 'string';
    const fp = fingerprintPassedDirectly
      ? fingerprintOrSpectral
      : typeof kernelOrFingerprint === 'string'
        ? kernelOrFingerprint
        : 'unknown';
    const kernelVersion = fingerprintPassedDirectly && typeof kernelOrFingerprint === 'string'
      ? kernelOrFingerprint
      : 'unknown';

    mark(
      epistemic,
      [
        'schema.numericCount',
        'schema.categoricalCount',
        'schema.temporalCount',
        'cardinality.rowCount',
        'cardinality.columnCount',
        'cardinality.edgeCount',
        'topologicalStructure.topology',
      ],
      'derived',
      'Direct structural value supplied by the legacy MonetaFacts adapter',
    );

    const distribution: DatasetSignature['distribution'] = {};
    const dependence: DatasetSignature['dependence'] = {};
    const clusterStructure: DatasetSignature['clusterStructure'] = {};
    const temporalStructure: DatasetSignature['temporalStructure'] = {};
    const spatialStructure: DatasetSignature['spatialStructure'] = {};

    if (facts) {
      const numeric = numericSummary(facts);
      const correlations = correlationSummary(facts);
      distribution.hasOutliers = numeric.totalOutliers > 0;
      distribution.outlierFraction = numeric.totalOutliers / Math.max(1, facts.rowCount);
      distribution.anomalyCount = numeric.totalOutliers;
      distribution.maxSkewness = numeric.maxSkewness;
      dependence.maxCorrelation = correlations.maxCorrelation;
      dependence.significantPairsCount = correlations.significantPairsCount;
      mark(
        epistemic,
        [
          'distribution.hasOutliers',
          'distribution.outlierFraction',
          'distribution.anomalyCount',
          'distribution.maxSkewness',
          'dependence.maxCorrelation',
          'dependence.significantPairsCount',
        ],
        'measured',
        'Computed by supplied Rust kernel Facts',
      );
      const entropy = meanCategoricalEntropy(facts);
      if (entropy !== undefined) {
        distribution.meanEntropy = entropy;
        markDatasetSignatureFact(epistemic, 'distribution.meanEntropy', 'measured', {
          note: 'Mean of categorical entropies emitted by supplied Rust kernel Facts',
        });
      }
    } else {
      // MonetaFacts is a compatibility envelope containing several historical
      // heuristics. Per RF-045, we MUST NOT fabricate analytical evidence.
      // Only structural/cardinality facts directly observable from the envelope
      // are preserved as 'derived'; all analytical facts remain absent/unknown.
      if (typeof mf.hasOutliers === 'boolean' || Number.isFinite(mf.outlierCount)) {
        const count = Number.isFinite(mf.outlierCount) ? mf.outlierCount : 0;
        // These are structural observations about the envelope itself, not kernel measurements
        distribution.hasOutliers = mf.hasOutliers === true || count > 0;
        distribution.anomalyCount = count;
        distribution.outlierFraction = count / Math.max(1, mf.rowCount);
        mark(
          epistemic,
          ['distribution.hasOutliers', 'distribution.anomalyCount', 'distribution.outlierFraction'],
          'derived',
          'Direct observation of the legacy MonetaFacts envelope content',
        );
      }
      // Do NOT populate: highVariance, maxSkewness, clusterCount, hasCycles, etc.
      // These are analytical facts requiring kernel evidence. Absent kernel Facts,
      // they remain structurally absent (undefined) with epistemic source 'unknown'.
      // The createUnknownDatasetSignatureEpistemic() already initializes all facts to 'unknown'.
    }

    // hierarchyDepth: compatibility sentinel (0 = no established hierarchy).
    // Marked as 'unknown' in epistemic since it is not analytical evidence.
    const hierarchyDepth = 0;
    markDatasetSignatureFact(epistemic, 'cardinality.depth', 'unknown', {
      note: 'Compatibility sentinel; not analytical hierarchy evidence',
    });

    // topologicalStructure: only the explicit topology from the envelope.
    // hasCycles is NOT inferred from edge presence; requires authoritative Rust cycle result.
    const topologicalStructure: DatasetSignature['topologicalStructure'] = {
      topology: mf.topology as TopologyType,
    };
    markDatasetSignatureFact(epistemic, 'topologicalStructure.topology', 'derived', {
      note: 'Explicit topology from legacy MonetaFacts envelope',
    });

    if (mf.topology === 'TIME_SERIES') {
      temporalStructure.isTimeSeries = true;
      markDatasetSignatureFact(epistemic, 'temporalStructure.isTimeSeries', 'derived');
    } else if (mf.hasTimeSeries === true) {
      temporalStructure.isTimeSeries = true;
      markDatasetSignatureFact(epistemic, 'temporalStructure.isTimeSeries', 'heuristic');
    }
    if (temporalStructure.isTimeSeries === true) {
      temporalStructure.trendDirection = mf.trendDirection;
      markDatasetSignatureFact(epistemic, 'temporalStructure.trendDirection', 'heuristic');
      if (mf.seasonalityHint === true || spectral?.hasPeriodicity === true) {
        temporalStructure.hasSeasonality = true;
        markDatasetSignatureFact(epistemic, 'temporalStructure.hasSeasonality', 'heuristic');
      }
    }

    if (mf.topology === 'GEO' || mf.topology === 'VECTOR_FIELD') {
      spatialStructure.isGeospatial = true;
      markDatasetSignatureFact(epistemic, 'spatialStructure.isGeospatial', 'derived', {
        note: 'Derived from explicit topology; coordinate dimensionality remains unknown',
      });
    }

    markSpectralFacts(epistemic, spectral);

    return {
      schema: {
        numericCount: mf.numericColumns,
        categoricalCount: mf.categoricalColumns,
        temporalCount: mf.temporalColumns,
      },
      cardinality: {
        rowCount: mf.rowCount,
        columnCount: mf.numericColumns + mf.categoricalColumns + mf.temporalColumns,
        edgeCount: mf.edgeCount,
        depth: hierarchyDepth,
      },
      distribution,
      dependence,
      clusterStructure,
      topologicalStructure,
      temporalStructure,
      spatialStructure,
      spectralStructure: spectral ?? null,
      provenance: {
        datasetFingerprint: String(fp),
        kernelVersion,
        analysisTimestamp: now,
        timestamp: now,
        engine: facts ? 'legacy-kernel-facts-adapter' : 'legacy-moneta-facts-adapter',
      },
      epistemic,
      preferredFamilies: userHints?.preferredFamilies,
    };
  }

  const dataset = datasetOrFacts as Dataset;
  const hasKernelFacts = facts != null;
  const fp = typeof fingerprintOrSpectral === 'string'
    ? fingerprintOrSpectral
    : dataset.fingerprint ?? 'unknown';
  const kernelVersion = hasKernelFacts && typeof kernelOrFingerprint === 'string'
    ? kernelOrFingerprint
    : 'unknown';
  const spectral = (typeof fingerprintOrSpectral === 'object'
    ? fingerprintOrSpectral
    : spectralFacts) ?? null;

  const rowCount = hasKernelFacts ? facts.rowCount : dataset.rowCount ?? dataset.rows?.length ?? 0;
  const colCount = hasKernelFacts ? facts.columnCount : dataset.columnCount ?? dataset.columns?.length ?? 0;

  let numericCount = 0;
  let categoricalCount = 0;
  let temporalCount = 0;
  let textCount = 0;
  let idCount = 0;

  for (const col of dataset.columns ?? []) {
    const typeStr = String(col.type).toUpperCase();
    if (typeStr === 'NUMERIC') numericCount += 1;
    else if (typeStr === 'CATEGORICAL') categoricalCount += 1;
    else if (typeStr === 'TEMPORAL') temporalCount += 1;
    else if (typeStr === 'ID') idCount += 1;
    else textCount += 1;
  }

  mark(
    epistemic,
    [
      'schema.numericCount',
      'schema.categoricalCount',
      'schema.temporalCount',
      'schema.textCount',
      'schema.idCount',
      'cardinality.rowCount',
      'cardinality.columnCount',
      'cardinality.edgeCount',
    ],
    'derived',
    'Direct Dataset schema/cardinality observation',
  );

  const explicitTopology = (dataset as { topology?: TopologyType }).topology;
  let topology: TopologyType = explicitTopology ?? 'TABULAR';
  if (dataset.edges && dataset.edges.length > 0) topology = 'GRAPH';
  markDatasetSignatureFact(
    epistemic,
    'topologicalStructure.topology',
    explicitTopology || (dataset.edges && dataset.edges.length > 0) ? 'derived' : 'prior',
    {
      note: explicitTopology || (dataset.edges && dataset.edges.length > 0)
        ? 'Derived from explicit Dataset topology/edges'
        : 'Legacy Dataset path defaults unclassified structure to TABULAR',
    },
  );

  const distribution: DatasetSignature['distribution'] = {};
  const dependence: DatasetSignature['dependence'] = {};
  const clusterStructure: DatasetSignature['clusterStructure'] = {};
  const temporalStructure: DatasetSignature['temporalStructure'] = {};
  const spatialStructure: DatasetSignature['spatialStructure'] = {};

  if (hasKernelFacts) {
    const numeric = numericSummary(facts);
    const correlations = correlationSummary(facts);
    distribution.hasOutliers = numeric.totalOutliers > 0;
    distribution.outlierFraction = numeric.totalOutliers / Math.max(1, rowCount);
    distribution.anomalyCount = numeric.totalOutliers;
    distribution.maxSkewness = numeric.maxSkewness;
    dependence.maxCorrelation = correlations.maxCorrelation;
    dependence.significantPairsCount = correlations.significantPairsCount;
    mark(
      epistemic,
      [
        'distribution.hasOutliers',
        'distribution.outlierFraction',
        'distribution.anomalyCount',
        'distribution.maxSkewness',
        'dependence.maxCorrelation',
        'dependence.significantPairsCount',
      ],
      'measured',
      'Computed by supplied Rust kernel Facts',
    );

    const entropy = meanCategoricalEntropy(facts);
    if (entropy !== undefined) {
      distribution.meanEntropy = entropy;
      markDatasetSignatureFact(epistemic, 'distribution.meanEntropy', 'measured');
    }

    const primaryTemporal = facts.temporalStats[0];
    if (primaryTemporal) {
      temporalStructure.isTimeSeries = true;
      temporalStructure.trendDirection = primaryTemporal.trendDirection;
      temporalStructure.hasSeasonality = primaryTemporal.seasonalityHint;
      markDatasetSignatureFact(epistemic, 'temporalStructure.isTimeSeries', 'measured');
      markDatasetSignatureFact(epistemic, 'temporalStructure.trendDirection', 'measured');
      markDatasetSignatureFact(epistemic, 'temporalStructure.hasSeasonality', 'heuristic', {
        note: 'Kernel field is explicitly a seasonality hint, not calibrated evidence',
      });
    }
  }

  if (topology === 'TIME_SERIES' && temporalStructure.isTimeSeries !== true) {
    temporalStructure.isTimeSeries = true;
    markDatasetSignatureFact(epistemic, 'temporalStructure.isTimeSeries', 'derived');
  }
  if (topology === 'GEO' || topology === 'VECTOR_FIELD') {
    spatialStructure.isGeospatial = true;
    markDatasetSignatureFact(epistemic, 'spatialStructure.isGeospatial', 'derived', {
      note: 'Derived from explicit topology; coordinate dimensionality remains unknown',
    });
  }

  markSpectralFacts(epistemic, spectral);

  return {
    schema: {
      numericCount,
      categoricalCount,
      temporalCount,
      textCount,
      idCount,
    },
    cardinality: {
      rowCount,
      columnCount: colCount,
      edgeCount: dataset.edges?.length ?? 0,
      depth: 0,
    },
    distribution,
    dependence,
    clusterStructure,
    topologicalStructure: { topology },
    temporalStructure,
    spatialStructure,
    spectralStructure: spectral,
    provenance: {
      datasetFingerprint: String(fp),
      kernelVersion,
      analysisTimestamp: now,
      timestamp: now,
      engine: hasKernelFacts ? 'legacy-kernel-facts-adapter' : 'legacy-dataset-adapter',
    },
    epistemic,
    preferredFamilies: userHints?.preferredFamilies,
  };
}
