/**
 * Apache Arrow serialization for Nemosyne datasets.
 *
 * Arrow gives fast zero-copy columnar access and compact IPC streams.
 * This module serializes a {@link Dataset} to an Arrow `Table` and back,
 * and produces an IPC stream that can be sent over a WebSocket or fetch
 * response.
 */

import { tableFromArrays, tableToIPC, tableFromIPC } from 'apache-arrow';
import type { Table, Vector } from 'apache-arrow';
import { Dataset } from '../Dataset.ts';
import type { ColumnTypeValue } from '../types.ts';

/**
 * Convert a Nemosyne Dataset into an Arrow IPC byte stream.
 */
export function datasetToArrowIPC(dataset: Dataset): Uint8Array {
  if (!dataset || dataset.rowCount === 0) {
    return tableToIPC(tableFromArrays({}));
  }

  const arrays: Record<string, unknown[]> = {};
  for (const column of dataset.columns) {
    arrays[column.name] = dataset.getColumnValues(column.name);
  }

  const table = tableFromArrays(arrays);
  return tableToIPC(table);
}

/**
 * Parse an Arrow IPC byte stream back into a Nemosyne Dataset.
 */
export function arrowIPCToDataset(
  buffer: Uint8Array | ArrayBuffer,
  name: string = 'Arrow Dataset'
): Dataset {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  if (!bytes || bytes.length === 0) {
    return new Dataset(name, [], []);
  }

  const table: Table = tableFromIPC(bytes);
  const columns = table.schema.fields.map((field) => ({
    name: field.name,
    type: inferColumnType(table.getChild(field.name)),
  }));

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const row: Record<string, unknown> = {};
    for (const field of table.schema.fields) {
      const child = table.getChild(field.name);
      row[field.name] = child ? child.get(i) : null;
    }
    rows.push(row);
  }

  return new Dataset(name, columns, rows);
}

function inferColumnType(vector: Vector | null): ColumnTypeValue {
  if (!vector) return 'TEXT';

  const sample: unknown[] = [];
  for (let i = 0; i < Math.min(20, vector.length); i++) {
    sample.push(vector.get(i));
  }

  let numeric = 0;
  let temporal = 0;
  let total = 0;
  for (const v of sample) {
    if (v === null || v === undefined || v === '') continue;
    total++;
    if (typeof v === 'number' || !Number.isNaN(Number(v))) numeric++;
    else if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) temporal++;
  }

  if (total === 0) return 'TEXT';
  if (numeric / total > 0.8) return 'NUMERIC';
  if (temporal / total > 0.8) return 'TEMPORAL';
  if (new Set(sample).size <= Math.max(12, sample.length * 0.1)) return 'CATEGORICAL';
  return 'TEXT';
}
