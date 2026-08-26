/**
 * Shared TypeScript types for the data layer.
 *
 * These types mirror the runtime shape of `Dataset.ts` `toJSON()` and of the
 * JSON operation spec accepted by `wasm/src/data/operations_bridge.rs`.
 */

export type ColumnTypeValue = 'NUMERIC' | 'CATEGORICAL' | 'TEMPORAL' | 'TEXT' | 'UNKNOWN';

export interface ColumnSchema {
  name: string;
  type: ColumnTypeValue;
}

export interface DatasetJSON {
  name: string;
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  /**
   * Durable observation identities owned by the Rust dataset lineage.
   * These are metadata, not scientific variables, and must never participate
   * in analytical fingerprints or be exposed as user columns.
   */
  rowIds?: string[];
  edges?: Array<{
    source: string | number;
    target: string | number;
    weight?: number;
    [key: string]: unknown;
  }>;
}

export type OperationName =
  | 'filter'
  | 'sort'
  | 'aggregate'
  | 'compare'
  | 'slice'
  | 'anomaly_iqr'
  | 'anomaly_zscore'
  | 'k_means'
  | 'hierarchical'
  | 'dbscan';

export interface OperationSpec {
  op: OperationName;
  [key: string]: unknown;
}

/**
 * JSON value shared across the analytical ABI. Mirrors the Rust `Value` /
 * `serde_json::Value` the kernel accepts in predicate leaves.
 */
export type JSONValue =
  null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

// ---------------------------------------------------------------------------
// Filter predicate DSL (serialisable, reproducible — no opaque closures)
// ---------------------------------------------------------------------------

export type Predicate =
  | { op: 'eq'; column: string; value: JSONValue }
  | { op: 'ne'; column: string; value: JSONValue }
  | { op: 'gt' | 'gte' | 'lt' | 'lte'; column: string; value: number }
  | { op: 'in'; column: string; values: JSONValue[] }
  | { op: 'between'; column: string; lo: number; hi: number }
  | { op: 'isnull'; column: string }
  | { op: 'and' | 'or'; children: Predicate[] }
  | { op: 'not'; child: Predicate };

export interface FilterSpec {
  op: 'filter';
  /** Declarative predicate tree (preferred). */
  predicate?: Predicate;
  /** Legacy numeric range on `column` (`min`/`max` inclusive). */
  column?: string;
  min?: number;
  max?: number;
}

// ---------------------------------------------------------------------------
// Aggregate + compare specs
// ---------------------------------------------------------------------------

export type AggregatorFn = 'sum' | 'mean' | 'median' | 'min' | 'max' | 'count' | 'std' | 'var';

export interface Aggregator {
  column: string;
  function: AggregatorFn;
  /** Output column name. Defaults to `{column}_{function}`. */
  as?: string;
}

export interface AggregateSpec {
  op: 'aggregate';
  /** Legacy single group key. */
  group_by?: string;
  /** Multi-key grouping (overrides `group_by` when present). */
  group_by_columns?: string[];
  /** Named aggregators. When absent, the legacy sum-all-numeric aggregator runs. */
  aggregators?: Aggregator[];
}

export interface CompareSpec {
  op: 'compare';
  group_by: string;
  group_a: string;
  group_b: string;
  measures?: string[];
}

export interface AnomalyIqrSpec {
  op: 'anomaly_iqr';
  column: string;
  sensitivity?: number;
}

export interface AnomalyZscoreSpec {
  op: 'anomaly_zscore';
  column: string;
  /** Z-score threshold; defaults to 3.0. */
  sensitivity?: number;
}

// ---------------------------------------------------------------------------
// Statistics (`Facts`) — the kernel is the single authority
// ---------------------------------------------------------------------------

export interface ColumnStats {
  name: string;
  count: number;
  sum: number;
  mean: number;
  median: number;
  std: number;
  var: number;
  min: number;
  max: number;
  skew: number;
  kurtosis: number;
  outlierCount: number;
}

export interface CorrelationPair {
  a: string;
  b: string;
  value: number;
}

export interface CategoryCount {
  value: string;
  count: number;
}

export interface CategoricalStats {
  name: string;
  cardinality: number;
  entropy: number;
  top: CategoryCount[];
}

export interface TemporalStats {
  column: string;
  valueColumn: string;
  trendDirection: 'flat' | 'up' | 'down';
  seasonalityHint: boolean;
  normalizedSlope: number;
}

export interface Facts {
  rowCount: number;
  columnCount: number;
  numeric: ColumnStats[];
  correlation: CorrelationPair[];
  categorical: CategoricalStats[];
  temporal: string[];
  temporalStats: TemporalStats[];
}

// ---------------------------------------------------------------------------
// Provenance envelope — emitted by the kernel on every analytical result
// ---------------------------------------------------------------------------

export interface Provenance {
  kernel: 'nemosyne-wasm';
  kernelVersion: string;
  operation: string;
  parameters: JSONValue;
  inputFingerprint: string;
  outputFingerprint: string;
  timestamp: number;
  /** Substrate that produced the result (`"row_major"` | `"columnar_only"`). */
  ingestMode?: string;
  /** `"refused"` on a kernel-inline resource refusal; absent on success. */
  outcome?: 'refused';
}

// ---------------------------------------------------------------------------
// TDA result types (mapper graph / persistence / betti0)
// ---------------------------------------------------------------------------

export interface TdaMapperNode {
  id: number;
  rowIndices: number[];
  level: number;
  center: number[];
  filterCenter: number;
  size: number;
}

export interface TdaMapperGraph {
  nodes: TdaMapperNode[];
  edges: [number, number][];
}

export interface PersistenceInterval {
  birth: number;
  death?: number | null;
}

export interface BettiPoint {
  radius: number;
  betti0: number;
}

export { type TopologyType, TopologyTypes } from '../types/topology.ts';

export interface EncodingMapping {
  color?: string;
  size?: string;
  pulse?: string;
  time?: string;
  label?: string;
}

export interface SpectralFacts {
  dominantFrequencies: number[];
  spectralEntropy: number;
  powerSpectrumPeak: number;
  directionalAnisotropy: number;
  characteristicScale: number;
  hasPeriodicity: boolean;
  periodicityConfidence: number;
  method: string;
  observedCount: number;
  transformLength: number;
  sourceObservationsPerBin: number;
  frequencyResolution: number;
  maximumFrequency: number;
  windowFunction: string;
}
