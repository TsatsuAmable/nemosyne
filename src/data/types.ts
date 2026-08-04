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
  | 'slice'
  | 'anomaly_iqr'
  | 'k_means'
  | 'hierarchical'
  | 'dbscan';

export interface OperationSpec {
  op: OperationName;
  [key: string]: unknown;
}
