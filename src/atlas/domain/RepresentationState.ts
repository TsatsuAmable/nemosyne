/**
 * RepresentationState — manages Moneta fact mapping, requirements, decisions,
 * and embodiment metadata without owning a second representation solver.
 */

import type { Facts } from '../../data/types.ts';
import type { DatasetEvidence } from '../../data/evidence/DatasetEvidence.ts';
import type { FitnessModelRegistry } from '../../fitness/FitnessModelRegistry.ts';
import type { FitnessModelPromotionPolicy } from '../../fitness/PromotionGate.ts';
import type {
  CategoricalDistribution,
  MonetaDataInput,
  MonetaFacts,
  FactProvider,
  NumericStats,
} from '../../moneta/types.ts';
import { TopologyTypes } from '../../types/topology.ts';
import {
  BOOTSTRAP_FITNESS_MODEL_VERSION,
  createDefaultRequirements,
  type RepresentationRequirements,
  type SpatialStrategy,
  type DatasetSignature,
  type RepresentationDecision,
  type SpectralFacts,
  buildDatasetSignature,
  MonetaHypothesisEngine,
  EvidenceBackedMoneta,
  datasetEvidenceToSignature,
} from '../../moneta/index.ts';
import {
  applyPinnedLearnedFitnessRuntime,
  type PinnedLearnedMonetaRuntimeConfig,
} from '../../moneta/representation/LearnedMonetaRuntime.ts';

export type RepresentationFitnessRuntimeIdentity =
  | {
      mode: 'bootstrap';
      fitnessModelVersion: typeof BOOTSTRAP_FITNESS_MODEL_VERSION;
      artifactHash: null;
    }
  | {
      mode: 'pinned-learned';
      fitnessModelVersion: string;
      artifactHash: string;
    };

/**
 * Legacy compatibility heuristic. This value is not canonical analytical
 * evidence and must never be promoted to DatasetSignature without an explicit
 * heuristic source label.
 */
export function estimateClusterCount(
  rowCount: number,
  cardinalityOfColor: number,
  numericColumnCount: number
): number {
  if (cardinalityOfColor > 1 && cardinalityOfColor <= 20) return cardinalityOfColor;
  if (numericColumnCount === 0) return 1;
  return Math.min(20, Math.max(1, Math.round(Math.sqrt(rowCount))));
}

/**
 * Legacy MonetaFacts adapter. It intentionally remains a compatibility surface;
 * several fields below are engineering heuristics. Canonical V3 representation
 * decisions use DatasetEvidence instead, and SignatureBuilder labels any values
 * that traverse this adapter as heuristic rather than kernel measurement.
 */
export function mapKernelFactsToMoneta(
  input: MonetaDataInput,
  kf: Facts,
  largeRowThreshold: number,
  highCardinalityThreshold: number
): MonetaFacts {
  const ds = input.dataset;
  const rowCount =
    ds?.rowCount ??
    input.rows?.length ??
    (input.nodes as unknown[] | undefined)?.length ??
    kf.rowCount;
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
    for (const b of numericNames) correlationMatrix[a][b] = a === b ? 1 : 0;
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
      topCategories: c.top.map((t) => ({
        value: t.value,
        count: t.count,
        fraction: t.count / total,
      })),
      entropy: c.entropy,
    };
  }

  const colorCat = colorColumn ? categoryDistribution[colorColumn] : undefined;
  const colorCardinality = colorCat
    ? (kf.categorical.find((c) => c.name === colorColumn)?.cardinality ?? 0)
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

/**
 * Explicit degraded bootstrap facts retained temporarily for pre-kernel scene
 * construction and legacy tests. These are schema/cardinality observations,
 * not analytical evidence. V3 Gate 0 tracks removal of this path separately.
 */
export function minimalMonetaFacts(
  input: MonetaDataInput,
  largeRowThreshold: number,
  highCardinalityThreshold: number
): MonetaFacts {
  const ds = input.dataset;
  const rowCount =
    ds?.rowCount ?? input.rows?.length ?? (input.nodes as unknown[] | undefined)?.length ?? 0;
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

  private learnedRuntime: PinnedLearnedMonetaRuntimeConfig | null = null;

  /** Explicitly opt this representation composition root into pinned learned ranking. */
  usePinnedLearnedFitnessRuntime(config: {
    registry: FitnessModelRegistry;
    policy: FitnessModelPromotionPolicy;
    artifactHash: string;
    modelVersion: string;
  }): void {
    const artifactHash = config.artifactHash.trim();
    const modelVersion = config.modelVersion.trim();
    if (!artifactHash) throw new TypeError('Pinned learned artifact hash must be non-empty');
    if (!modelVersion) throw new TypeError('Pinned learned model version must be non-empty');
    this.learnedRuntime = { ...config, artifactHash, modelVersion };
  }

  /** Restore the canonical bootstrap runtime. This is the default and fallback-free path. */
  useBootstrapFitnessRuntime(): void {
    this.learnedRuntime = null;
  }

  getFitnessRuntimeIdentity(): RepresentationFitnessRuntimeIdentity {
    if (!this.learnedRuntime) {
      return {
        mode: 'bootstrap',
        fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION,
        artifactHash: null,
      };
    }
    return {
      mode: 'pinned-learned',
      fitnessModelVersion: this.learnedRuntime.modelVersion,
      artifactHash: this.learnedRuntime.artifactHash,
    };
  }

  toMonetaFacts(input: MonetaDataInput, kernelFacts: Facts | null): MonetaFacts {
    if (kernelFacts) {
      return mapKernelFactsToMoneta(
        input,
        kernelFacts,
        this.largeRowThreshold,
        this.highCardinalityThreshold
      );
    }
    return minimalMonetaFacts(input, this.largeRowThreshold, this.highCardinalityThreshold);
  }

  toDracoFacts(input: MonetaDataInput, kernelFacts: Facts | null): MonetaFacts {
    return this.toMonetaFacts(input, kernelFacts);
  }

  toDatasetSignature(
    input: MonetaDataInput,
    kernelFacts: Facts | null,
    spectralFacts?: SpectralFacts | null,
    datasetFingerprint?: string
  ): DatasetSignature {
    const ds = input.dataset;
    if (!ds) throw new Error('Dataset required to build DatasetSignature');

    // RF-045: absence of kernel facts must stay absence. Do not construct an
    // empty Facts object or stamp a guessed kernel version, because both would
    // make unknown analytical state look like a measured all-zero result.
    return buildDatasetSignature(
      ds,
      kernelFacts,
      datasetFingerprint ?? (ds.fingerprint ? String(ds.fingerprint) : 'unknown'),
      'unknown',
      spectralFacts
    );
  }

  computeDatasetSignature(
    input: MonetaDataInput,
    kernelFacts: Facts | null,
    spectralFacts?: SpectralFacts | null,
    datasetFingerprint?: string
  ): DatasetSignature {
    const signature = this.toDatasetSignature(input, kernelFacts, spectralFacts, datasetFingerprint);
    this.activeSignature = signature;
    return signature;
  }

  /**
   * Canonical V3 path: construct the representation signature from validated,
   * provenance-bearing DatasetEvidence emitted by Rust/WASM.
   */
  computeDatasetSignatureFromEvidence(evidence: DatasetEvidence): DatasetSignature {
    const signature = datasetEvidenceToSignature(evidence);
    this.activeSignature = signature;
    return signature;
  }

  asFactProvider(factsProvider: () => Facts | null): FactProvider {
    return { facts: (input) => this.toMonetaFacts(input, factsProvider()) };
  }

  /**
   * Compatibility facade. There is no independent strategy arbiter in V3:
   * strategy is derived from the canonical Moneta RepresentationDecision.
   */
  arbitrateStrategy(
    input: MonetaDataInput,
    kernelFacts: Facts | null,
    requirements?: RepresentationRequirements,
    datasetFingerprint?: string
  ): SpatialStrategy {
    return this.arbitrateRepresentation(
      input,
      kernelFacts,
      undefined,
      requirements,
      datasetFingerprint
    ).embodiment.spatialStrategy;
  }

  arbitrateRepresentation(
    input: MonetaDataInput,
    kernelFacts: Facts | null,
    spectralFacts?: SpectralFacts | null,
    requirements?: RepresentationRequirements,
    datasetFingerprint?: string
  ): RepresentationDecision {
    const req = requirements ?? this.activeRequirements ?? createDefaultRequirements();
    const signature = this.computeDatasetSignature(
      input,
      kernelFacts,
      spectralFacts,
      datasetFingerprint
    );
    const bootstrapDecision = new MonetaHypothesisEngine().arbitrate(signature, req);
    const decision = this.learnedRuntime
      ? applyPinnedLearnedFitnessRuntime(bootstrapDecision, this.learnedRuntime)
      : bootstrapDecision;
    this.activeDecision = decision;
    this.activeStrategy = decision.embodiment.spatialStrategy;
    this.activeRequirements = req;
    return decision;
  }

  /**
   * Canonical V3 arbitration path. DatasetEvidence is the analytical source of
   * truth; no TypeScript-computed analytical placeholder can affect ranking.
   */
  arbitrateRepresentationFromEvidence(
    evidence: DatasetEvidence,
    requirements?: RepresentationRequirements,
  ): RepresentationDecision {
    const req = requirements ?? this.activeRequirements ?? createDefaultRequirements();
    const signature = this.computeDatasetSignatureFromEvidence(evidence);
    const bootstrapDecision = new EvidenceBackedMoneta().arbitrate(
      evidence,
      signature,
      req,
    ).decision;
    const decision = this.learnedRuntime
      ? applyPinnedLearnedFitnessRuntime(bootstrapDecision, this.learnedRuntime)
      : bootstrapDecision;
    this.activeDecision = decision;
    this.activeStrategy = decision.embodiment.spatialStrategy;
    this.activeRequirements = req;
    return decision;
  }

  arbitrateStrategyFromEvidence(
    evidence: DatasetEvidence,
    requirements?: RepresentationRequirements,
  ): SpatialStrategy {
    return this.arbitrateRepresentationFromEvidence(evidence, requirements).embodiment.spatialStrategy;
  }

  restoreDecision(decision: RepresentationDecision): void {
    this.activeDecision = decision;
    this.activeStrategy = decision.embodiment.spatialStrategy;
  }
}
