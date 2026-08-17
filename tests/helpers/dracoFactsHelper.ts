/**
 * Test-only Draco fact provider.
 *
 * Wave 5 deleted `ConstraintEngine.extractFacts` and its statistical helpers
 * (`_numericStats`/`_correlationMatrix`/`_temporalStats`/
 * `_categoricalDistribution`/`_estimateOutlierCount`/`_estimateClusterCount`)
 * from production code — Draco now consumes facts supplied by AtlasCore (which
 * reads them from `kernel.statistics`). This helper keeps the former canned
 * fact-extraction logic so Draco RULE tests (which exercise the soft/hard
 * constraint bodies, not the statistics) can still run in plain jsdom without
 * the wasm pkg. This is NOT production code — no `src/` code ever imports it.
 * Statistical parity for the canned values is covered by Rust `#[test]`s +
 * `tests/wasm-runtime.test.ts`.
 */
import { TopologyTypes } from '../../src/types/topology.ts';
import type {
  CategoricalDistribution,
  DracoDataInput,
  DracoFacts,
  FactProvider,
  NumericStats,
  TrendDirection,
} from '../../src/draco/types.ts';

function numericStats(values: number[]): NumericStats {
  const n = values.length;
  if (n === 0) {
    return { mean: 0, median: 0, stdDev: 0, skew: 0, kurtosis: 0, min: 0, max: 0 };
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const median =
    n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  let variance = 0;
  for (const v of values) {
    const d = v - mean;
    variance += d * d;
  }
  variance /= n;
  const stdDev = Math.sqrt(variance);
  let skew = 0;
  let kurtosis = 0;
  if (stdDev > 1e-9) {
    for (const v of values) {
      const z = (v - mean) / stdDev;
      skew += z * z * z;
      kurtosis += z * z * z * z;
    }
    skew /= n;
    kurtosis = kurtosis / n - 3;
  }
  return { mean, median, stdDev, skew, kurtosis, min, max };
}

function categoricalDistribution(
  ds: { getColumnValues(name: string): unknown[] },
  name: string,
): CategoricalDistribution {
  const values = ds.getColumnValues(name);
  const counts = new Map<unknown, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const n = values.length || 1;
  const sorted = [...counts.entries()]
    .map(([value, count]) => ({ value, count, fraction: count / n }))
    .sort((a, b) => b.count - a.count);
  let entropy = 0;
  for (const { fraction } of sorted) {
    if (fraction > 0) entropy -= fraction * Math.log2(fraction);
  }
  return { topCategories: sorted.slice(0, 5), entropy };
}

function correlationMatrix(
  ds: { getColumnValues(name: string): unknown[] },
  names: string[],
): Record<string, Record<string, number>> {
  const columns = names.map((name) =>
    ds.getColumnValues(name).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v)),
  );
  const n = columns[0]?.length || 0;
  const matrix: Record<string, Record<string, number>> = {};
  if (n === 0) return matrix;
  const stats = columns.map((vals) => {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
    return { mean, std };
  });
  for (let i = 0; i < names.length; i++) {
    matrix[names[i]] = {};
    for (let j = 0; j < names.length; j++) {
      if (stats[i].std === 0 || stats[j].std === 0) {
        matrix[names[i]][names[j]] = i === j ? 1 : 0;
        continue;
      }
      let cov = 0;
      for (let k = 0; k < n; k++) {
        cov += (columns[i][k] - stats[i].mean) * (columns[j][k] - stats[j].mean);
      }
      cov /= n;
      matrix[names[i]][names[j]] = cov / (stats[i].std * stats[j].std);
    }
  }
  return matrix;
}

function temporalStats(
  ds: { rows: Record<string, unknown>[] },
  timeColumn: string,
  valueColumn?: string,
): { trendDirection: TrendDirection; seasonalityHint: boolean; normalizedSlope?: number } {
  if (!valueColumn || !ds) return { trendDirection: 'flat', seasonalityHint: false };
  const rows = ds.rows
    .slice()
    .sort((a, b) => new Date(a[timeColumn] as string).getTime() - new Date(b[timeColumn] as string).getTime());
  const values = rows.map((r) => Number(r[valueColumn])).filter((v) => !Number.isNaN(v));
  if (values.length < 3) return { trendDirection: 'flat', seasonalityHint: false };
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const range = Math.max(...values) - Math.min(...values);
  const normalizedSlope = range > 0 ? slope / range : 0;
  let trendDirection: TrendDirection = 'flat';
  if (normalizedSlope > 0.01) trendDirection = 'up';
  else if (normalizedSlope < -0.01) trendDirection = 'down';
  const lag = Math.max(1, Math.floor(n / 4));
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n - lag; i++) {
    const a = values[i] - yMean;
    const b = values[i + lag] - yMean;
    cov += a * b;
    varA += a * a;
    varB += b * b;
  }
  const corr = varA > 0 && varB > 0 ? cov / Math.sqrt(varA * varB) : 0;
  return { trendDirection, seasonalityHint: corr > 0.5, normalizedSlope };
}

function estimateOutlierCount(values: number[]): number {
  if (values.length < 4) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const median =
    sorted.length % 2 === 1
      ? sorted[Math.floor(sorted.length / 2)]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const deviations = values.map((v) => Math.abs(v - median));
  const sortedDev = deviations.slice().sort((a, b) => a - b);
  const mad =
    sortedDev.length % 2 === 1
      ? sortedDev[Math.floor(sortedDev.length / 2)]
      : (sortedDev[sortedDev.length / 2 - 1] + sortedDev[sortedDev.length / 2]) / 2;
  if (mad === 0) {
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.ceil(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return values.filter((v) => v < lower || v > upper).length;
  }
  return values.filter((v) => Math.abs((0.6745 * (v - median)) / mad) > 3.5).length;
}

function estimateClusterCount(rowCount: number, cardinalityOfColor: number, numericColumnCount: number): number {
  if (cardinalityOfColor > 1 && cardinalityOfColor <= 20) return cardinalityOfColor;
  if (numericColumnCount === 0) return 1;
  return Math.min(20, Math.max(1, Math.round(Math.sqrt(rowCount))));
}

export interface FactProviderOptions {
  largeRowThreshold?: number;
  highCardinalityThreshold?: number;
}

/**
 * Compute canned DracoFacts from a data input. Mirrors the former
 * `ConstraintEngine.extractFacts` for test fixtures. Threshold options mirror
 * the `ConstraintEngineOptions` fields so tests that tune the engine also tune
 * the canned provider.
 */
export function computeFacts(
  dataInput: DracoDataInput,
  opts: FactProviderOptions = {},
): DracoFacts {
  const largeRowThreshold = opts.largeRowThreshold ?? 500;
  const highCardinalityThreshold = opts.highCardinalityThreshold ?? 12;
  const ds = dataInput.dataset;
  const rowCount = ds?.rowCount ?? dataInput.rows?.length ?? dataInput.nodes?.length ?? 0;
  const edgeCount = dataInput.edges?.length ?? ds?.edges?.length ?? 0;
  const numericColumns = ds?.numericColumns ?? [];
  const categoricalColumns = ds?.categoricalColumns ?? [];
  const temporalColumns = ds?.temporalColumns ?? [];
  const colorColumn = dataInput.encodings?.color ?? categoricalColumns[0]?.name ?? null;
  const cardinalityOfColor = colorColumn && ds ? ds.cardinalityOf(colorColumn) : 0;
  const numericValues =
    numericColumns.length > 0 && ds
      ? ds
          .getColumnValues(numericColumns[0].name)
          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
      : [];

  const columnStats: Record<string, NumericStats> = {};
  for (const col of numericColumns) {
    if (!ds) continue;
    const values = ds
      .getColumnValues(col.name)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    columnStats[col.name] = numericStats(values);
  }

  const categoryDistribution: Record<string, CategoricalDistribution> = {};
  for (const col of categoricalColumns) {
    if (!ds) continue;
    categoryDistribution[col.name] = categoricalDistribution(ds, col.name);
  }

  const corrMatrix =
    ds && numericColumns.length >= 2
      ? correlationMatrix(ds, numericColumns.map((c) => c.name))
      : {};

  const primaryTimeColumn = temporalColumns[0]?.name;
  const tStats =
    primaryTimeColumn && ds
      ? temporalStats(ds, primaryTimeColumn, numericColumns[0]?.name)
      : { trendDirection: 'flat' as TrendDirection, seasonalityHint: false };

  const primaryStats = columnStats[numericColumns[0]?.name] || {};
  const outlierCount = estimateOutlierCount(numericValues);

  return {
    topology: dataInput.topology || TopologyTypes.TABULAR,
    rowCount,
    nodeCount: dataInput.nodes?.length ?? rowCount,
    edgeCount,
    depth: dataInput.maxDepth ?? temporalColumns.length ?? 1,
    numericColumns: numericColumns.length,
    categoricalColumns: categoricalColumns.length,
    temporalColumns: temporalColumns.length,
    hasTimeSeries: dataInput.isTimeSeries || ds?.hasTemporal || false,
    hasContinuousValues: ds?.hasNumeric || numericColumns.length > 0,
    density: edgeCount / Math.max(1, rowCount),
    estimatedDensity: rowCount / 64,
    outlierCount,
    cardinalityOfColor,
    hasHighCardinality: cardinalityOfColor > highCardinalityThreshold,
    isLargeDataset: rowCount > largeRowThreshold,
    clusterCount: estimateClusterCount(rowCount, cardinalityOfColor, numericColumns.length),
    columnStats,
    correlationMatrix: corrMatrix,
    categoryDistribution,
    trendDirection: tStats.trendDirection,
    seasonalityHint: tStats.seasonalityHint,
    hasOutliers: outlierCount > 0,
    hasHighVariance: primaryStats.stdDev != null && primaryStats.stdDev > 0,
    numericSkew: primaryStats.skew ?? 0,
    topCategory: categoryDistribution[colorColumn ?? '']?.topCategories?.[0]?.value ?? null,
  };
}

/** A FactProvider wrapping {@link computeFacts} for `new ConstraintEngine({ factProvider: makeFactProvider(opts) }, opts)`. */
export function makeFactProvider(opts: FactProviderOptions = {}): FactProvider {
  return { facts: (input) => computeFacts(input, opts) };
}