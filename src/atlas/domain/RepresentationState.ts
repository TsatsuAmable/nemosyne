/**
 * RepresentationState — manages Moneta constraint fact mapping, thresholds, and embodiment metadata.
 */

import type { Facts } from '../../data/types.ts';
import type {
  CategoricalDistribution,
  MonetaDataInput,
  MonetaFacts,
  FactProvider,
  NumericStats,
} from '../../moneta/types.ts';
import { TopologyTypes } from '../../types/topology.ts';
import {
  ConstraintArbiter,
  createDefaultRequirements,
  type RepresentationRequirements,
  type SpatialStrategy,
  type DatasetSignature,
  type RepresentationDecision,
  type SpectralFacts,
  buildDatasetSignature,
  MonetaHypothesisEngine,
} from '../../moneta/index.ts';

export function estimateClusterCount(
  rowCount: number,
  cardinalityOfColor: number,
  numericColumnCount: number,
): number {
  if (cardinalityOfColor > 1 && cardinalityOfColor <= 20) return cardinalityOfColor;
  if (numericColumnCount === 0) return 1;
  return Math.min(20, Math.max(1, Math.round(Math.sqrt(rowCount))));
}

export function mapKernelFactsToMoneta(
  input: MonetaDataInput,
  kf: Facts,
  largeRowThreshold: number,
  highCardinalityThreshold: number,
): MonetaFacts {
  const ds = input.dataset;
  const rowCount = ds?.rowCount ?? input.rows?.length ?? (input.nodes as unknown[] | undefined)?.length ?? kf.rowCount;
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
    nodeCount: (input.nodes as unknown[] | undefined)?.length ?? rowCount,
    edgeCount,
    depth: (input.maxDepth as number | undefined) ?? temporalCols.length ?? 1,
    numericColumns: numericCols.length,
    categoricalColumns: categoricalCols.length,
    temporalColumns: temporalCols.length,
    hasTimeSeries: (input.isTimeSeries as boolean | undefined) || temporalCols.length > 0,
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
    trendDirection: (primaryTemporal?.trendDirection as 'flat' | 'up' | 'down') ?? 'flat',
    seasonalityHint: primaryTemporal?.seasonalityHint ?? false,
    hasOutliers: outlierCount > 0,
    hasHighVariance: (primaryNumeric?.std ?? 0) > 0,
    numericSkew: primaryNumeric?.skew ?? 0,
    topCategory: colorCat?.topCategories?.[0]?.value ?? null,
  };
}

export const mapKernelFactsToDraco = mapKernelFactsToMoneta;

export function minimalMonetaFacts(
  input: MonetaDataInput,
  largeRowThreshold: number,
  highCardinalityThreshold: number,
): MonetaFacts {
  const ds = input.dataset;
  const rowCount = ds?.rowCount ?? input.rows?.length ?? (input.nodes as unknown[] | undefined)?.length ?? 0;
  const edgeCount = input.edges?.length ?? ds?.edges?.length ?? 0;
  const numericCols = ds?.numericColumns ?? [];
  const categoricalCols = ds?.categoricalColumns ?? [];
  const temporalCols = ds?.temporalColumns ?? [];
  return {
    topology: input.topology || TopologyTypes.TABULAR,
    rowCount,
    nodeCount: (input.nodes as unknown[] | undefined)?.length ?? rowCount,
    edgeCount,
    depth: (input.maxDepth as number | undefined) ?? temporalCols.length ?? 1,
    numericColumns: numericCols.length,
    categoricalColumns: categoricalCols.length,
    temporalColumns: temporalCols.length,
    hasTimeSeries: (input.isTimeSeries as boolean | undefined) || temporalCols.length > 0,
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

export const minimalDracoFacts = minimalMonetaFacts;

export class RepresentationState {
  readonly largeRowThreshold = 500;
  readonly highCardinalityThreshold = 12;

  activeStrategy: SpatialStrategy | null = null;
  activeRequirements: RepresentationRequirements | null = null;
  activeSignature: DatasetSignature | null = null;
  activeDecision: RepresentationDecision | null = null;

  toMonetaFacts(input: MonetaDataInput, kernelFacts: Facts | null): MonetaFacts {
    if (kernelFacts) {
      return mapKernelFactsToMoneta(
        input,
        kernelFacts,
        this.largeRowThreshold,
        this.highCardinalityThreshold,
      );
    }
    return minimalMonetaFacts(
      input,
      this.largeRowThreshold,
      this.highCardinalityThreshold,
    );
  }

  toDracoFacts(input: MonetaDataInput, kernelFacts: Facts | null): MonetaFacts {
    return this.toMonetaFacts(input, kernelFacts);
  }

  toDatasetSignature(
    input: MonetaDataInput,
    kernelFacts: Facts | null,
    spectralFacts?: SpectralFacts | null,
    datasetFingerprint?: string,
  ): DatasetSignature {
    const ds = input.dataset;
    if (!ds) {
      throw new Error('Dataset required to build DatasetSignature');
    }
    const facts = kernelFacts ?? {
      rowCount: ds.rowCount ?? 0,
      columnCount: ds.columnCount ?? 0,
      numeric: [],
      correlation: [],
      categorical: [],
      temporal: [],
      temporalStats: [],
    };
    return buildDatasetSignature(
      ds,
      facts,
      datasetFingerprint ?? (ds.fingerprint ? String(ds.fingerprint) : 'unknown'),
      '0.1.0',
      spectralFacts
    );
  }

  computeDatasetSignature(
    input: MonetaDataInput,
    kernelFacts: Facts | null,
    spectralFacts?: SpectralFacts | null,
    datasetFingerprint?: string,
  ): DatasetSignature {
    const signature = this.toDatasetSignature(input, kernelFacts, spectralFacts, datasetFingerprint);
    this.activeSignature = signature;
    return signature;
  }

  asFactProvider(factsProvider: () => Facts | null): FactProvider {
    return {
      facts: (input) => this.toMonetaFacts(input, factsProvider()),
    };
  }

  arbitrateStrategy(
    input: MonetaDataInput,
    kernelFacts: Facts | null,
    requirements?: RepresentationRequirements,
    datasetFingerprint?: string,
  ): SpatialStrategy {
    const facts = this.toMonetaFacts(input, kernelFacts);
    const req = requirements ?? this.activeRequirements ?? createDefaultRequirements();
    const strategy = ConstraintArbiter.arbitrate(facts, req, { datasetFingerprint });
    this.activeStrategy = strategy;
    this.activeRequirements = req;
    return strategy;
  }

  arbitrateRepresentation(
    input: MonetaDataInput,
    kernelFacts: Facts | null,
    spectralFacts?: SpectralFacts | null,
    requirements?: RepresentationRequirements,
    datasetFingerprint?: string,
  ): RepresentationDecision {
    const req = requirements ?? this.activeRequirements ?? createDefaultRequirements();
    const signature = this.computeDatasetSignature(input, kernelFacts, spectralFacts, datasetFingerprint);
    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(signature, req);
    this.activeDecision = decision;
    this.activeStrategy = decision.embodiment?.spatialStrategy;
    this.activeRequirements = req;
    return decision;
  }
}
