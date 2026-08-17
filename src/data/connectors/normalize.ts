import { Dataset, ColumnType } from '../Dataset.ts';
import type { ColumnTypeValue } from '../types.ts';

/**
 * Schema-type heuristic for cold-start live-stream rows; full streaming-via-kernel
 * is deferred to Wave 4/6. File parse type-inference runs in the Rust kernel.
 *
 * Majority-rule: if most non-null values are finite numbers → NUMERIC; else if
 * most parse as dates → TEMPORAL; else → CATEGORICAL. Empty → CATEGORICAL.
 */
function inferType(values: unknown[]): ColumnTypeValue {
  let nonNull = 0;
  let numeric = 0;
  let temporal = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    nonNull++;
    if (typeof v === 'number' && Number.isFinite(v)) {
      numeric++;
    } else if (typeof v === 'string') {
      const s = v.trim();
      if (s !== '' && Number.isFinite(Number(s)) && /^-?\d/.test(s)) {
        numeric++;
      } else if (!Number.isNaN(Date.parse(s))) {
        temporal++;
      }
    }
  }
  if (nonNull === 0) return ColumnType.CATEGORICAL;
  if (numeric > nonNull / 2) return ColumnType.NUMERIC;
  if (temporal > nonNull / 2) return ColumnType.TEMPORAL;
  return ColumnType.CATEGORICAL;
}

/**
 * Build a {@link Dataset} from raw row objects.
 */
export function rowsToDataset(rows: Record<string, unknown>[], name: string = 'Live Stream'): Dataset {
  if (!Array.isArray(rows) || rows.length === 0) {
    return new Dataset(name, [], []);
  }

  const rawKeys = Object.keys(rows[0]);
  const keys = rawKeys.filter((key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype');
  const columns = keys.map((key) => {
    const values = rows.map((row) => row[key]);
    return { name: key, type: inferType(values) };
  });

  return new Dataset(name, columns, rows);
}

export interface LiveMessage {
  dataset?: Dataset;
  rows?: Record<string, unknown>[];
  name?: string;
  topology?: string;
}

export interface NormalizedLiveUpdate {
  dataset: Dataset;
  topology: string;
}

/**
 * Coerce a live message into a normalized update.
 */
export function normalizeLiveMessage(
  message: LiveMessage | unknown,
  defaultTopology: string = 'TIME_SERIES'
): NormalizedLiveUpdate | null {
  if (!message || typeof message !== 'object') return null;

  const msg = message as LiveMessage;
  let dataset: Dataset | null = null;
  const topology = msg.topology || defaultTopology;

  if (msg.dataset instanceof Dataset) {
    dataset = msg.dataset;
  } else if (msg.rows && Array.isArray(msg.rows)) {
    dataset = rowsToDataset(msg.rows, msg.name || 'Live Stream');
  }

  if (!dataset) return null;
  return { dataset, topology };
}
