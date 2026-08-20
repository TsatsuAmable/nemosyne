/**
 * SignatureBuilder — Pure mapping from kernel Facts and DracoFacts to DatasetSignature.
 *
 * Implements deterministic synthesis of the DatasetSignature contract without
 * performing analytical computation (which remains strictly in the Rust kernel).
 */

import type { DracoFacts } from '../types.ts';
import type { Facts } from '../../data/types.ts';
import type { DatasetSignature, SpectralFacts } from './DatasetSignature.ts';
import { minimalDatasetSignature } from './DatasetSignature.ts';

export function buildDatasetSignature(
  facts: DracoFacts,
  kernelFacts?: Facts | null,
  spectralFacts?: SpectralFacts | null,
  fingerprint = 'unknown-fp',
  now = Date.now()
): DatasetSignature {
  // 1. Distribution summary
  let maxSkew = Math.abs(facts.numericSkew ?? 0);
  if (facts.columnStats) {
    for (const stats of Object.values(facts.columnStats)) {
      if (typeof stats.skew === 'number' && !isNaN(stats.skew)) {
        maxSkew = Math.max(maxSkew, Math.abs(stats.skew));
      }
    }
  }

  let meanEntropy = 0;
  if (facts.categoryDistribution) {
    const entries = Object.values(facts.categoryDistribution);
    if (entries.length > 0) {
      const sum = entries.reduce((acc, cat) => acc + (cat.entropy || 0), 0);
      meanEntropy = sum / entries.length;
    }
  }

  // 2. Correlation / Dependence
  let maxCorr = 0;
  let significantPairsCount = 0;

  if (kernelFacts?.correlation) {
    for (const pair of kernelFacts.correlation) {
      const absR = Math.abs(pair.value);
      if (absR > maxCorr) maxCorr = absR;
      if (absR > 0.5) significantPairsCount++;
    }
  } else if (facts.correlationMatrix) {
    const cols = Object.keys(facts.correlationMatrix);
    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) {
        const r = facts.correlationMatrix[cols[i]]?.[cols[j]];
        if (typeof r === 'number') {
          const absR = Math.abs(r);
          if (absR > maxCorr) maxCorr = absR;
          if (absR > 0.5) significantPairsCount++;
        }
      }
    }
  }

  // 3. Cluster structure
  const estimatedClusterCount = facts.clusterCount > 0 ? facts.clusterCount : 1;
  const hasClusters = estimatedClusterCount > 1;

  // 4. Anomaly / Outliers
  const hasOutliers = !!facts.hasOutliers;
  const outlierFraction = hasOutliers ? 0.05 : 0;
  const anomalyCount = hasOutliers ? Math.max(1, Math.round(facts.rowCount * 0.05)) : 0;

  // 5. Topology & Spatial
  const isGeo = facts.topology === 'GEO';
  const isVectorField = facts.topology === 'VECTOR_FIELD';
  const isHierarchy = facts.topology === 'HIERARCHY';
  const isGraph = facts.topology === 'GRAPH';

  return {
    schema: {
      numericCount: facts.numericColumns ?? 0,
      categoricalCount: facts.categoricalColumns ?? 0,
      temporalCount: facts.temporalColumns ?? 0,
      geoCount: isGeo ? 2 : 0,
      textCount: 0,
      idCount: 0,
    },
    cardinality: {
      rowCount: facts.rowCount ?? 0,
      nodeCount: facts.nodeCount ?? facts.rowCount ?? 0,
      edgeCount: facts.edgeCount ?? 0,
      depth: facts.depth ?? (isHierarchy ? 3 : 0),
    },
    distribution: {
      hasOutliers,
      highVariance: !!facts.hasHighVariance,
      maxSkewness: maxSkew,
      meanEntropy,
    },
    dependence: {
      maxCorrelation: maxCorr,
      significantPairsCount,
    },
    clusterStructure: {
      estimatedCount: estimatedClusterCount,
      separationHint: facts.density > 0 ? facts.density : 0.5,
      hasClusters,
    },
    anomalyStructure: {
      outlierFraction,
      anomalyCount,
    },
    temporalStructure: {
      isTimeSeries: !!facts.hasTimeSeries || (facts.temporalColumns ?? 0) > 0,
      intervalRegularity: facts.hasTimeSeries ? 1.0 : undefined,
      trendDirection: facts.trendDirection ?? 'flat',
      hasSeasonality: !!facts.seasonalityHint,
    },
    spatialStructure: {
      isGeospatial: isGeo,
      coordinateDimensions: isGeo ? 2 : isVectorField ? 3 : 0,
    },
    topologicalStructure: {
      topology: facts.topology ?? 'TABULAR',
      b0Count: estimatedClusterCount,
      hasCycles: isGraph ? (facts.edgeCount ?? 0) > (facts.nodeCount ?? 0) : false,
    },
    spectralStructure: spectralFacts ?? null,
    provenance: {
      datasetFingerprint: fingerprint,
      timestamp: now,
      engineVersion: '1.0.0',
    },
  };
}

export { minimalDatasetSignature };
