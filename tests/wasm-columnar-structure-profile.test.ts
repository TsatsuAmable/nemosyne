import { beforeAll, describe, expect, it } from 'vitest';
import { rowMaterialisationCount } from '../src/wasm/ColumnarBoundary.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

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

function typedPayload(): Uint8Array {
  const rows = 8;
  const parts: Uint8Array[] = [encoder.encode('NTC1')];
  pushU32(parts, rows);
  pushU32(parts, 3);

  for (const [type, name, scale] of [
    [1, 'value', 2],
    [2, 'time', 1],
  ] as const) {
    parts.push(Uint8Array.of(type));
    pushString(parts, name);
    const values = new Uint8Array(rows * 8);
    const view = new DataView(values.buffer);
    for (let row = 0; row < rows; row += 1) view.setFloat64(row * 8, row * scale, true);
    parts.push(values, new Uint8Array(rows).fill(1));
  }

  parts.push(Uint8Array.of(3));
  pushString(parts, 'cohort');
  pushU32(parts, 2);
  pushString(parts, 'A');
  pushString(parts, 'B');
  const codes = new Uint8Array(rows * 4);
  const codeView = new DataView(codes.buffer);
  for (let row = 0; row < rows; row += 1) codeView.setUint32(row * 4, row % 2, true);
  parts.push(codes, new Uint8Array(rows).fill(1));

  const payload = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.byteLength;
  }
  return payload;
}

describe('columnar DatasetStructureProfile real-WASM boundary', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('real WASM runtime unavailable');
  });

  it('returns authoritative compact evidence without materialising compatibility rows', () => {
    const payload = typedPayload();
    const allocation = bridge.allocBytes(payload);
    const handle = Number(bridge.call('data_load_typed_columns', allocation.ptr, allocation.len));
    bridge.deallocBytes(allocation.ptr, allocation.len);
    expect(handle).toBeGreaterThan(0);
    const before = rowMaterialisationCount();

    try {
      const profile = bridge.computeDatasetStructureProfile(handle);
      expect(profile).not.toBeNull();
      expect(profile?.rowCount).toBe(8);
      expect(profile?.columnCount).toBe(3);
      expect(profile?.provenance).toMatchObject({
        algorithmSuite: 'nemosyne-rust-analytical-core-v1',
      });
      expect(rowMaterialisationCount()).toBe(before);
    } finally {
      bridge.call('typed_dataset_destroy', handle);
    }
  });
});
