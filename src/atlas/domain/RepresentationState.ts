/**
 * RepresentationState — manages Draco constraint fact mapping, thresholds, and embodiment metadata.
 */

import type { Facts } from '../../data/types.ts';
import type {
  CategoricalDistribution,
  DracoDataInput,
  DracoFacts,
  FactProvider,
  NumericStats,
} from '../../draco/types.ts';
import { TopologyTypes } from '../../types/topology.ts';

/** Display-only cluster-count heuristic (embodiment metadata, not analytical). */
export function estimateClusterCount(
  rowCount: number,
  cardinalityOfColor: number,
  numericColumnCount: number,
): number {
  if (cardinalityOfColor > 1 && cardinalityOfColor <= 20) return cardinalityOfColor;
  if (numericColumnCount === 0) return 1;
  return Math.min(20, Math.max(1, Math.round(Math.sqrt(rowCount))));
}

/**
 * Map a kernel Facts block into the DracoFacts shape Draco's constraint rules read.
 */
export function mapKernelFactsToDraco(
  input: DracoDataInput,
  kf: Facts,
  largeRowThreshold: number,
  highCardinalityThreshold: number,
): DracoFacts {
  const ds = input.dataset;
  const rowCount = ds?.rowCount ?? input.rows?.length ?? input.nodes?.length ?? kf.rowCount;
  const edgeCount = input.edges?.length ?? ds?.edges?.length ?? 0;
  const numericCols = ds?.numericColumns ?? [];
  const categoricalCols = ds?.categoricalColumns ?? [];
  const temporalCols = ds?.temporalColumns ?? [];
  const colorColumn = input.encodings?.color ?? categoricalCols[0]?.name ?? null;

  const columnStats: Record<string, NumericStats> = {};
  for (const c of kf.numeric) {
    columnStats[c.name] = {
      mean: c.mean,
      median: c.median,
      stdDev: c.std,
      skew: c.skew,
      kurtosis: c.kurtosis,
      min: c.min,
      max: c.max,
    };
  }

  // Build a symmetric correlation matrix from kernel correlation pairs.
  const correlationMatrix: Record<string, Record<string, number>> = {};
  const numericNames = kf.numeric.map((c) => c.name);
  for (const a of numericNames) {
    correlationMatrix[a] = {};
    for (const b of numericNames) {
      correlationMatrix[a][b] = a === b ? 1 : 0;
    }
  }
  for (const p of kf.correlation) {
    if (!correlationMatrix[p.a]) correlationMatrix[p.a] = {};
    if (!correlationMatrix[p.b]) correlationMatrix[p.b] = {};
    correlationMatrix[p.a][p.b] = p.value;
    correlationMatrix[p.b][p.a] = p.value;
  }

  const categoryDistribution: Record<string, CategoricalDistribution> = {};
  for (const c of kf.categorical) {
    const total = c.top.reduce((s, t) => s + t.count, 0) || kf.rowCount || 1;
    categoryDistribution[c.name] = {
      topCategories: c.top.map((t) => ({ value: t.value, count: t.count, fraction: t.count / total })),
      entropy: c.entropy,
    };
  }

  const colorCat = colorColumn ? categoryDistribution[colorColumn] : undefined;
  const colorCardinality = colorCat
    ? kf.categorical.find((c) => c.name === colorColumn)?.cardinality ?? 0
    : 0;

  const primaryNumeric = kf.numeric[0];
  const primaryTemporal = kf.temporalStats[0];
  const outlierCount = primaryNumeric?.outlierCount ?? 0;

  const clusterCount = estimateClusterCount(rowCount, colorCardinality, numericCols.length);

  return {
    topology: input.topology || TopologyTypes.TABULAR,
    rowCount,
    nodeCount: input.nodes?.length ?? rowCount,
    edgeCount,
    depth: input.maxDepth ?? temporalCols.length ?? 1,
    numericColumns: numericCols.length,
    categoricalColumns: categoricalCols.length,
    temporalColumns: temporalCols.length,
    hasTimeSeries: input.isTimeSeries || temporalCols.length > 0,
    hasContinuousValues: numericCols.length > 0,
    density: edgeCount / Math.max(1, rowCount),
    estimatedDensity: rowCount / 64,
    outlierCount,
    cardinalityOfColor: colorCardinality,
    hasHighCardinality: colorCardinality > highCardinalityThreshold,
    isLargeDataset: rowCount > largeRowThreshold,
    clusterCount,
    columnStats,
    correlationMatrix,
    categoryDistribution,
    trendDirection: primaryTemporal?.trendDirection ?? 'flat',
    seasonalityHint: primaryTemporal?.seasonalityHint ?? false,
    hasOutliers: outlierCount > 0,
    hasHighVariance: (primaryNumeric?.std ?? 0) > 0,
    numericSkew: primaryNumeric?.skew ?? 0,
    topCategory: colorCat?.topCategories?.[0]?.value ?? null,
  };
}

/**
 * Minimal schema-metadata DracoFacts for the no-kernel state (renderer shell).
 */
export function minimalDracoFacts(
  input: DracoDataInput,
  largeRowThreshold: number,
  highCardinalityThreshold: number,
): DracoFacts {
  const ds = input.dataset;
  const rowCount = ds?.rowCount ?? input.rows?.length ?? input.nodes?.length ?? 0;
  const edgeCount = input.edges?.length ?? ds?.edges?.length ?? 0;
  const numericCols = ds?.numericColumns ?? [];
  const categoricalCols = ds?.categoricalColumns ?? [];
  const temporalCols = ds?.temporalColumns ?? [];
  return {
    topology: input.topology || TopologyTypes.TABULAR,
    rowCount,
    nodeCount: input.nodes?.length ?? rowCount,
    edgeCount,
    depth: input.maxDepth ?? temporalCols.length ?? 1,
    numericColumns: numericCols.length,
    categoricalColumns: categoricalCols.length,
    temporalColumns: temporalCols.length,
    hasTimeSeries: input.isTimeSeries || temporalCols.length > 0,
    hasContinuousValues: numericCols.length > 0,
    density: edgeCount / Math.max(1, rowCount),
    estimatedDensity: rowCount / 64,
    outlierCount: 0,
    cardinalityOfColor: 0,
    hasHighCardinality: 0 > highCardinalityThreshold,
    isLargeDataset: rowCount > largeRowThreshold,
    clusterCount: estimateClusterCount(rowCount, 0, numericCols.length),
    columnStats: {},
    correlationMatrix: {},
    categoryDistribution: {},
    trendDirection: 'flat',
    seasonalityHint: false,
    hasOutliers: false,
    hasHighVariance: false,
    numericSkew: 0,
    topCategory: null,
  };
}

import {
  ConstraintArbiter,
  createDefaultRequirements,
  type RepresentationRequirements,
  type SpatialStrategy,
} from '../../draco/index.ts';

export class RepresentationState {
  readonly largeRowThreshold = 500;
  readonly highCardinalityThreshold = 12;

  activeStrategy: SpatialStrategy | null = null;
  activeRequirements: RepresentationRequirements | null = null;

  toDracoFacts(input: DracoDataInput, kernelFacts: Facts | null): DracoFacts {
    if (kernelFacts) {
      return mapKernelFactsToDraco(
        input,
        kernelFacts,
        this.largeRowThreshold,
        this.highCardinalityThreshold,
      );
    }
    return minimalDracoFacts(
      input,
      this.largeRowThreshold,
      this.highCardinalityThreshold,
    );
  }

  asFactProvider(factsProvider: () => Facts | null): FactProvider {
    return {
      facts: (input) => this.toDracoFacts(input, factsProvider()),
    };
  }

  arbitrateStrategy(
    input: DracoDataInput,
    kernelFacts: Facts | null,
    requirements?: RepresentationRequirements,
    datasetFingerprint?: string,
  ): SpatialStrategy {
    const facts = this.toDracoFacts(input, kernelFacts);
    const req = requirements ?? this.activeRequirements ?? createDefaultRequirements();
    const strategy = ConstraintArbiter.arbitrate(facts, req, { datasetFingerprint });
    this.activeStrategy = strategy;
    this.activeRequirements = req;
    return strategy;
  }
}
