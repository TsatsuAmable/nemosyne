/**
 * FlatBuffers-based binary serializer for Nemosyne datasets.
 *
 * FlatBuffers is useful for small, schema-evolvable messages such as
 * collaboration events or pose streams. For full datasets, Apache Arrow IPC
 * is usually preferred; this module is intentionally lightweight and uses a
 * simple hand-rolled row buffer so it has zero code-generation dependency.
 */

import { Dataset } from '../Dataset.ts';
import type { ColumnSchema, ColumnTypeValue } from '../types.ts';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const TYPE_IDS = {
  NUMERIC: 1,
  CATEGORICAL: 2,
  TEMPORAL: 3,
  TEXT: 4,
  UNKNOWN: 0,
} as const;

type ReverseTypeMap = Record<number, ColumnTypeValue>;

/**
 * Serialize a Dataset to a compact binary buffer.
 *
 * Format (little-endian):
 *   [magic 4 bytes: 0x4E 0x45 0x4D 0x01]
 *   [uint16 columnCount]
 *   [uint32 rowCount]
 *   columns: for each column
 *     [uint8 typeId]
 *     [uint16 nameLength]
 *     [name bytes]
 *   rows: for each row, for each column
 *     [uint8 kind: 0=null, 1=number, 2=string]
 *     number: [float64]
 *     string: [uint32 length][bytes]
 */
export function datasetToFlatBuffer(dataset: Dataset): ArrayBuffer {
  const chunks: Uint8Array[] = [];

  // Header.
  const header = new DataView(new ArrayBuffer(10));
  header.setUint8(0, 0x4e);
  header.setUint8(1, 0x45);
  header.setUint8(2, 0x4d);
  header.setUint8(3, 0x01);
  header.setUint16(4, dataset.columnCount, true);
  header.setUint32(6, dataset.rowCount, true);
  chunks.push(new Uint8Array(header.buffer));

  // Column metadata.
  for (const col of dataset.columns) {
    const nameBytes = TEXT_ENCODER.encode(col.name);
    const colMeta = new DataView(new ArrayBuffer(3));
    colMeta.setUint8(0, TYPE_IDS[col.type]);
    colMeta.setUint16(1, nameBytes.length, true);
    chunks.push(new Uint8Array(colMeta.buffer), nameBytes);
  }

  // Rows.
  for (const row of dataset.rows) {
    for (const col of dataset.columns) {
      const value = row[col.name];
      if (value === null || value === undefined) {
        chunks.push(new Uint8Array([0]));
      } else if (typeof value === 'number') {
        const cell = new DataView(new ArrayBuffer(9));
        cell.setUint8(0, 1);
        cell.setFloat64(1, value, true);
        chunks.push(new Uint8Array(cell.buffer));
      } else {
        const strBytes = TEXT_ENCODER.encode(String(value));
        const cell = new DataView(new ArrayBuffer(5));
        cell.setUint8(0, 2);
        cell.setUint32(1, strBytes.length, true);
        chunks.push(new Uint8Array(cell.buffer), strBytes);
      }
    }
  }

  return concatenateBuffers(chunks);
}

/**
 * Deserialize a FlatBuffer back into a Dataset.
 */
export function flatBufferToDataset(
  buffer: ArrayBuffer | Uint8Array,
  name: string = 'FlatBuffer Dataset'
): Dataset {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.byteLength;

  if (bytes.length < 10) return new Dataset(name, [], []);
  if (view.getUint8(0) !== 0x4e || view.getUint8(1) !== 0x45 || view.getUint8(2) !== 0x4d) {
    throw new Error('Invalid FlatBuffer magic bytes');
  }

  const columnCount = view.getUint16(4, true);
  const rowCount = view.getUint32(6, true);
  let offset = 10;

  // Length-field bounds: the header's columnCount/rowCount and every per-column
  // nameLength / per-cell string len are untrusted. Without these checks a
  // malformed payload makes DataView throw an opaque RangeError once the running
  // offset runs past the buffer, or — via subarray clamping — silently produce
  // truncated garbage. validate each length-bearing read against the buffer end
  // and fail deliberately and descriptively, mirroring the magic-byte contract.
  const ensure = (need: number, what: string): void => {
    if (offset + need > end) {
      throw new Error(
        `FlatBuffer: truncated at ${what} — need ${need} bytes at offset ${offset}, ` +
          `only ${Math.max(0, end - offset)} remain (${end} bytes total)`
      );
    }
  };

  const ID_TO_TYPE: ReverseTypeMap = Object.fromEntries(
    Object.entries(TYPE_IDS).map(([k, v]) => [v, k as ColumnTypeValue])
  ) as ReverseTypeMap;

  const columns: ColumnSchema[] = [];
  for (let i = 0; i < columnCount; i++) {
    ensure(3, `column ${i} header`);
    const typeId = view.getUint8(offset++);
    const nameLength = view.getUint16(offset, true);
    offset += 2;
    ensure(nameLength, `column ${i} name (${nameLength} bytes)`);
    const nameBytes = bytes.subarray(offset, offset + nameLength);
    offset += nameLength;
    columns.push({
      name: TEXT_DECODER.decode(nameBytes),
      type: ID_TO_TYPE[typeId] ?? 'UNKNOWN',
    });
  }

  const rows: Record<string, unknown>[] = [];
  for (let r = 0; r < rowCount; r++) {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      ensure(1, `row ${r} column "${col.name}" kind`);
      const kind = view.getUint8(offset++);
      if (kind === 0) {
        row[col.name] = null;
      } else if (kind === 1) {
        ensure(8, `row ${r} column "${col.name}" float64`);
        row[col.name] = view.getFloat64(offset, true);
        offset += 8;
      } else if (kind === 2) {
        ensure(4, `row ${r} column "${col.name}" string length`);
        const len = view.getUint32(offset, true);
        offset += 4;
        ensure(len, `row ${r} column "${col.name}" string (${len} bytes)`);
        row[col.name] = TEXT_DECODER.decode(bytes.subarray(offset, offset + len));
        offset += len;
      } else {
        row[col.name] = null;
      }
    }
    rows.push(row);
  }

  return new Dataset(name, columns, rows);
}

function concatenateBuffers(chunks: Uint8Array[]): ArrayBuffer {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out.buffer;
}
