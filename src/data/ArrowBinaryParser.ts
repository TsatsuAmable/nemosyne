/**
 * Apache Arrow IPC & Binary Stream Reader for Nemosyne Instanced Renderers.
 *
 * Implements lightweight zero-copy parsing of binary numeric streams (Float32Array / Int32Array)
 * into Nemosyne Dataset structures and GPU instance attribute buffers.
 */

import { Dataset, ColumnType } from './Dataset.ts';
import type { ColumnSchema } from './types.ts';

export interface ArrowBatchInfo {
  rowCount: number;
  columnNames: string[];
  floatBuffers: Float32Array[];
}

export class ArrowBinaryParser {
  /**
   * Parse a contiguous binary Float32 buffer into a Nemosyne Dataset.
   * Format: [numColumns (uint32), rowCount (uint32), ...flat float32 data]
   */
  static parseBinaryFloatStream(buffer: ArrayBuffer, columnNames: string[] = []): Dataset {
    const view = new DataView(buffer);
    if (buffer.byteLength < 8) {
      return new Dataset('ArrowStream', [], []);
    }

    const numCols = view.getUint32(0, true);
    const rowCount = view.getUint32(4, true);

    const dataOffset = 8;
    const floatCount = numCols * rowCount;
    // Length-field bounds: the header's numCols/rowCount are attacker/untrusted
    // controlled and may declare more data than the buffer actually holds. The
    // Float32Array constructor would throw an opaque RangeError on overflow;
    // fail deliberately and descriptively instead so callers can tell corruption
    // apart from a merely truncated stream.
    const availableFloats = Math.floor((buffer.byteLength - dataOffset) / 4);
    if (floatCount > availableFloats) {
      throw new Error(
        `ArrowBinaryParser: declared ${numCols} cols × ${rowCount} rows ` +
          `(${floatCount} floats) exceeds buffer capacity (${availableFloats} floats ` +
          `in ${buffer.byteLength} bytes)`
      );
    }
    const floatData = new Float32Array(buffer, dataOffset, floatCount);

    const columns: ColumnSchema[] = [];
    for (let c = 0; c < numCols; c++) {
      const name = columnNames[c] ?? `attr_${c + 1}`;
      columns.push({ name, type: ColumnType.NUMERIC });
    }

    const rows: Record<string, unknown>[] = [];
    for (let r = 0; r < rowCount; r++) {
      const rowObj: Record<string, unknown> = {};
      for (let c = 0; c < numCols; c++) {
        const val = floatData[r * numCols + c];
        rowObj[columns[c].name] = val;
      }
      rows.push(rowObj);
    }

    return new Dataset('ArrowBinaryStream', columns, rows);
  }

  /**
   * Extract zero-copy Float32Array slice directly targeting InstancedPointCloud buffers.
   */
  static extractZeroCopyPositions(buffer: ArrayBuffer): Float32Array {
    if (buffer.byteLength < 8) return new Float32Array(0);
    const view = new DataView(buffer);
    const numCols = view.getUint32(0, true);
    const rowCount = view.getUint32(4, true);

    const dataOffset = 8;
    // Assuming x, y, z are the first 3 columns
    const width = numCols >= 3 ? 3 : numCols;
    const floatCount = rowCount * width;
    // Length-field bounds: this feeds the render loop, so a malformed payload
    // with an inflated rowCount/numCols must degrade to an empty buffer rather
    // than throw (an opaque RangeError here would crash the frame). A truncated
    // stream surfaces as an empty Float32Array, matching the < 8-byte path.
    const availableFloats = Math.floor((buffer.byteLength - dataOffset) / 4);
    if (floatCount > availableFloats) {
      return new Float32Array(0);
    }
    return new Float32Array(buffer, dataOffset, floatCount);
  }
}
