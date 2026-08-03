/**
 * Apache Arrow serialization for Nemosyne datasets.
 *
 * Arrow gives fast zero-copy columnar access and compact IPC streams.
 * This module serializes a {@link Dataset} to an Arrow `Table` and back,
 * and produces an IPC stream that can be sent over a WebSocket or fetch
 * response.
 */

import { tableFromArrays, tableToIPC, tableFromIPC } from 'apache-arrow';
import { Dataset } from '../Dataset.js';

/**
 * Convert a Nemosyne Dataset into an Arrow IPC byte stream.
 * @param {import('../Dataset.js').Dataset} dataset
 * @returns {Uint8Array}
 */
export function datasetToArrowIPC(dataset) {
  if (!dataset || dataset.rowCount === 0) {
    return tableToIPC(tableFromArrays({}));
  }

  const arrays = {};
  for (const column of dataset.columns) {
    arrays[column.name] = dataset.getColumnValues(column.name);
  }

  const table = tableFromArrays(arrays);
  return tableToIPC(table);
}

/**
 * Parse an Arrow IPC byte stream back into a Nemosyne Dataset.
 * @param {Uint8Array|ArrayBuffer} buffer
 * @param {string} name
 * @returns {import('../Dataset.js').Dataset}
 */
export function arrowIPCToDataset(buffer, name = 'Arrow Dataset') {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  if (!bytes || bytes.length === 0) {
    return new Dataset(name, [], []);
  }

  const table = tableFromIPC(bytes);
  const columns = table.schema.fields.map((field) => ({
    name: field.name,
    type: inferColumnType(table.getChild(field.name)),
  }));

  const rows = [];
  for (let i = 0; i < table.numRows; i++) {
    const row = {};
    for (const field of table.schema.fields) {
      row[field.name] = table.getChild(field.name).get(i);
    }
    rows.push(row);
  }

  return new Dataset(name, columns, rows);
}

function inferColumnType(vector) {
  const sample = [];
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
