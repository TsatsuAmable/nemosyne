/**
 * SignatureBuilder — Pure builder mapping Rust analytical kernel facts to DatasetSignature.
 */

import type { Dataset } from '../../data/Dataset.ts';
import type { Facts } from '../../data/types.ts';
import type { DatasetSignature, SpectralFacts } from './DatasetSignature.ts';
import type { RepresentationFamily } from './RepresentationFamily.ts';
import type { MonetaFacts } from '../types.ts';
import type { TopologyType } from '../../types/topology.ts';

export function buildDatasetSignature(
  datasetOrFacts: Dataset | MonetaFacts,
  facts?: Facts | null,
  fingerprintOrSpectral?: string | SpectralFacts | null,
  kernelOrFingerprint?: string,
  spectralFacts?: SpectralFacts | null,
  now = Date.now(),
  userHints?: { preferredFamilies?: RepresentationFamily[] }
): DatasetSignature {
  if ('topology' in datasetOrFacts && 'rowCount' in datasetOrFacts && !('columns' in datasetOrFacts)) {
    const mf = datasetOrFacts as MonetaFacts;
    const spectral = (typeof fingerprintOrSpectral === 'object' ? fingerprintOrSpectral : spectralFacts) as SpectralFacts | null;
    const fp = typeof fingerprintOrSpectral === 'string' ? fingerprintOrSpectral : (typeof kernelOrFingerprint === 'string' ? kernelOrFingerprint : 'unknown');

    const hasOutliers = (mf.hasOutliers ?? false) || (mf.outlierCount != null && mf.outlierCount > 0);
    const clusterCount = mf.clusterCount ?? (mf.cardinalityOfColor && mf.cardinalityOfColor > 1 ? mf.cardinalityOfColor : 1);
    const hasClusters = clusterCount > 1;

    const meanEntropy =
      facts?.categorical?.length
        ? facts.categorical.reduce((sum, c) => sum + (c.entropy ?? 0), 0) / facts.categorical.length
        : 1.5;

    const maxCorrelation =
      facts?.correlation?.length ? Math.max(...facts.correlation.map((c) => Math.abs(c.value))) : 0;
    const significantPairsCount =
      facts?.correlation?.filter((c) => Math.abs(c.value) >= 0.5).length ?? 0;

    return {
      schema: {
        numericCount: mf.numericColumns ?? 0,
        categoricalCount: mf.categoricalColumns ?? 0,
        temporalCount: mf.temporalColumns ?? 0,
        geoCount: mf.topology === 'GEO' ? 2 : 0,
        textCount: 0,
        idCount: 0,
      },
      cardinality: {
        rowCount: mf.rowCount ?? 0,
        columnCount: (mf.numericColumns ?? 0) + (mf.categoricalColumns ?? 0) + (mf.temporalColumns ?? 0),
        edgeCount: mf.edgeCount ?? 0,
        depth: mf.depth ?? 1,
      },
      distribution: {
        hasOutliers,
        outlierFraction: (mf.outlierCount ?? 0) / Math.max(1, mf.rowCount ?? 1),
        anomalyCount: mf.outlierCount ?? 0,
        highVariance: mf.hasHighVariance ?? false,
        maxSkewness: mf.numericSkew ?? 0,
        meanEntropy,
      },
      dependence: {
        maxCorrelation,
        significantPairsCount,
        rankDeficiency: false,
      },
      clusterStructure: {
        estimatedCount: clusterCount,
        hasClusters,
        separationScore: 0.5,
        densityVariation: 0.2,
      },
      topologicalStructure: {
        topology: mf.topology as TopologyType,
        hasCycles: mf.topology === 'GRAPH' || (mf.edgeCount ?? 0) > 0,
      },
      temporalStructure: {
        isTimeSeries: (mf.hasTimeSeries ?? false) || mf.topology === 'TIME_SERIES',
        trendDirection: mf.trendDirection ?? 'flat',
        hasSeasonality: (mf.seasonalityHint ?? false) || spectral?.hasPeriodicity === true,
      },
      spatialStructure: {
        isGeospatial: mf.topology === 'GEO' || mf.topology === 'VECTOR_FIELD',
        coordinateDimensions: mf.topology === 'GEO' ? 2 : (mf.topology === 'VECTOR_FIELD' ? 3 : 0),
      },
      spectralStructure: spectral ?? null,
      provenance: {
        datasetFingerprint: String(fp),
        kernelVersion: '0.1.0',
        analysisTimestamp: now,
        timestamp: now,
      },
      preferredFamilies: userHints?.preferredFamilies,
    };
  }

  const dataset = datasetOrFacts as Dataset;
  const kf = facts ?? {
    rowCount: dataset.rowCount ?? dataset.rows?.length ?? 0,
    columnCount: dataset.columnCount ?? dataset.columns?.length ?? 0,
    numeric: [],
    correlation: [],
    categorical: [],
    temporal: [],
    temporalStats: [],
  };

  const fp = typeof fingerprintOrSpectral === 'string' ? fingerprintOrSpectral : dataset.fingerprint ?? 'unknown';
  const kernelVersion = typeof kernelOrFingerprint === 'string' ? kernelOrFingerprint : '0.1.0';
  const spectral = (typeof fingerprintOrSpectral === 'object' ? fingerprintOrSpectral : spectralFacts) ?? null;

  const rowCount = kf.rowCount ?? dataset.rowCount ?? dataset.rows?.length ?? 0;
  const colCount = kf.columnCount ?? dataset.columnCount ?? dataset.columns?.length ?? 0;

  let numericCount = 0;
  let categoricalCount = 0;
  let temporalCount = 0;
  let geoCount = 0;
  let textCount = 0;
  let idCount = 0;

  for (const col of dataset.columns ?? []) {
    // Column names are optional in several legacy/test fixtures. Treat an absent
    // name as semantically unknown rather than failing signature construction.
    const nameLower = String(col.name ?? '').toLowerCase();
    const typeStr = String(col.type).toUpperCase();
    if (typeStr === 'NUMERIC') {
      if (nameLower === 'lat' || nameLower === 'latitude' || nameLower === 'lon' || nameLower === 'longitude') {
        geoCount += 1;
      } else {
        numericCount += 1;
      }
    } else if (typeStr === 'CATEGORICAL') {
      categoricalCount += 1;
    } else if (typeStr === 'TEMPORAL') {
      temporalCount += 1;
    } else if (typeStr === 'ID') {
      idCount += 1;
    } else {
      textCount += 1;
    }
  }

  let totalOutliers = 0;
  let highVariance = false;
  let maxSkewness = 0;

  for (const stat of kf.numeric ?? []) {
    totalOutliers += stat.outlierCount ?? 0;
    if ((stat.var ?? 0) > 100) {
      highVariance = true;
    }
    const skew = Math.abs(stat.skew ?? 0);
    if (skew > maxSkewness) {
      maxSkewness = skew;
    }
  }

  let maxCorrelation = 0;
  let significantPairsCount = 0;
  for (const corr of kf.correlation ?? []) {
    const absVal = Math.abs(corr.value ?? 0);
    if (absVal > maxCorrelation) maxCorrelation = absVal;
    if (absVal > 0.7) significantPairsCount += 1;
  }

  let hasClusters = false;
  let clusterCount = 1;
  for (const cat of kf.categorical ?? []) {
    if (cat.cardinality > 1 && cat.cardinality <= 20) {
      hasClusters = true;
      clusterCount = Math.max(clusterCount, cat.cardinality);
    }
  }

  const isTimeSeries = temporalCount > 0 || (kf.temporalStats?.length ?? 0) > 0;
  const primaryTemporal = kf.temporalStats?.[0];
  const isGeospatial = geoCount >= 2;

  let topology = (dataset as { topology?: TopologyType }).topology || 'TABULAR';
  if (dataset.edges && dataset.edges.length > 0) topology = 'GRAPH';

  return {
    schema: {
      numericCount,
      categoricalCount,
      temporalCount,
      geoCount,
      textCount,
      idCount,
    },
    cardinality: {
      rowCount,
      columnCount: colCount,
      edgeCount: dataset.edges?.length ?? 0,
      depth: 1,
    },
    distribution: {
      hasOutliers: totalOutliers > 0,
      outlierFraction: totalOutliers / Math.max(1, rowCount),
      anomalyCount: totalOutliers,
      highVariance,
      maxSkewness,
      meanEntropy: 0.5,
    },
    dependence: {
      maxCorrelation,
      significantPairsCount,
      rankDeficiency: false,
    },
    clusterStructure: {
      estimatedCount: clusterCount,
      hasClusters,
      separationScore: 0.5,
      densityVariation: 0.2,
    },
    topologicalStructure: {
      topology: topology as TopologyType,
    },
    temporalStructure: {
      isTimeSeries,
      trendDirection: (primaryTemporal?.trendDirection as 'flat' | 'up' | 'down') ?? 'flat',
      hasSeasonality: primaryTemporal?.seasonalityHint ?? false,
    },
    spatialStructure: {
      isGeospatial,
      coordinateDimensions: isGeospatial ? 2 : 0,
    },
    spectralStructure: spectral ?? null,
    provenance: {
      datasetFingerprint: String(fp),
      kernelVersion,
      analysisTimestamp: now,
      timestamp: now,
    },
    preferredFamilies: userHints?.preferredFamilies,
  };
}
