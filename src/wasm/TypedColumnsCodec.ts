/**
 * TypedColumnsCodec — binary NTC1 encoder for typed/columnar dataset bulk ingestion.
 *
 * Implements the NTC1 wire format consumed by `data_load_typed_columns` and
 * `data_load_typed_columns_named` in the Rust WASM kernel.
 */

export interface NumericColumnInput {
  name: string;
  type: 'numeric' | 'temporal';
  values: ArrayLike<number>;
  validity?: ArrayLike<number>;
}

export interface CategoricalColumnInput {
  name: string;
  type: 'categorical';
  dictionary: string[];
  codes: ArrayLike<number>;
  validity?: ArrayLike<number>;
}

export type ColumnInput = NumericColumnInput | CategoricalColumnInput;

export interface TypedDatasetInput {
  rowCount: number;
  columns: ColumnInput[];
}

const encoder = new TextEncoder();

function pushU16(parts: Uint8Array[], value: number): void {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  parts.push(bytes);
}

function pushU32(parts: Uint8Array[], value: number): void {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  parts.push(bytes);
}

function pushString(parts: Uint8Array[], value: string): void {
  const bytes = encoder.encode(value);
  pushU16(parts, bytes.byteLength);
  parts.push(bytes);
}

/**
 * Encodes columnar dataset inputs into the authoritative NTC1 binary format.
 */
export function encodeTypedColumnsPayload(input: TypedDatasetInput): Uint8Array {
  const { rowCount, columns } = input;
  const parts: Uint8Array[] = [encoder.encode('NTC1')];
  pushU32(parts, rowCount);
  pushU32(parts, columns.length);

  for (const col of columns) {
    if (col.type === 'numeric' || col.type === 'temporal') {
      const typeCode = col.type === 'numeric' ? 1 : 2;
      parts.push(Uint8Array.of(typeCode));
      pushString(parts, col.name);

      const valBytes = new Uint8Array(rowCount * 8);
      const valView = new DataView(valBytes.buffer);
      for (let i = 0; i < rowCount; i += 1) {
        valView.setFloat64(i * 8, col.values[i] ?? 0, true);
      }
      parts.push(valBytes);

      const validityBytes = new Uint8Array(rowCount);
      if (col.validity) {
        for (let i = 0; i < rowCount; i += 1) {
          validityBytes[i] = col.validity[i] ? 1 : 0;
        }
      } else {
        validityBytes.fill(1);
      }
      parts.push(validityBytes);
    } else if (col.type === 'categorical') {
      parts.push(Uint8Array.of(3));
      pushString(parts, col.name);
      pushU32(parts, col.dictionary.length);
      for (const entry of col.dictionary) {
        pushString(parts, entry);
      }

      const codeBytes = new Uint8Array(rowCount * 4);
      const codeView = new DataView(codeBytes.buffer);
      for (let i = 0; i < rowCount; i += 1) {
        codeView.setUint32(i * 4, col.codes[i] ?? 0, true);
      }
      parts.push(codeBytes);

      const validityBytes = new Uint8Array(rowCount);
      if (col.validity) {
        for (let i = 0; i < rowCount; i += 1) {
          validityBytes[i] = col.validity[i] ? 1 : 0;
        }
      } else {
        validityBytes.fill(1);
      }
      parts.push(validityBytes);
    }
  }

  const totalLength = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const payload = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.byteLength;
  }
  return payload;
}
