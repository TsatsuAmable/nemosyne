import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

function callNumber(name: string, ...args: unknown[]): number {
  return Number(bridge.call(name, ...args) ?? 0);
}

describe('WASM ABI hardening', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    expect(bridge.isReady()).toBe(true);
  });

  it('rejects zero and maximal dataset handles without leaking host buffers', () => {
    const baseline = bridge.hostBufferAllocationCount();

    for (const handle of [0, 0xffff_ffff]) {
      expect(callNumber('dataset_row_count', handle)).toBe(0);
      expect(callNumber('dataset_column_count', handle)).toBe(0);
      expect(callNumber('canonical_dataset_row_count', handle)).toBe(0);
      expect(callNumber('canonical_dataset_column_count', handle)).toBe(0);
      expect(callNumber('typed_dataset_row_count', handle)).toBe(0);
      expect(callNumber('dataset_primitive_column_len', handle, 0)).toBe(0);
      expect(callNumber('dataset_primitive_column_values_ptr', handle, 0)).toBe(0);
      expect(callNumber('dataset_primitive_column_validity_ptr', handle, 0)).toBe(0);
      expect(callNumber('compatibility_dataset_to_json', handle, 0, 0)).toBe(0);
      expect(callNumber('data_compute_structure_profile', handle, 0, 0)).toBe(0);

      expect(() => bridge.call('dataset_destroy', handle)).not.toThrow();
      expect(() => bridge.call('typed_dataset_destroy', handle)).not.toThrow();
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('rejects an operation against a stale handle and releases its input buffer', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const operation = new TextEncoder().encode(JSON.stringify({ op: 'sort', column: 'x' }));
    const allocation = bridge.allocBytes(operation);

    try {
      expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);
      expect(callNumber('data_operation', 0xffff_ffff, allocation.ptr, allocation.len)).toBe(0);
    } finally {
      bridge.deallocBytes(allocation.ptr, allocation.len);
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('does not partially write an undersized compatibility JSON result', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const handle = bridge.loadDatasetJson({
      name: 'atomic-compatibility-output',
      columns: [{ name: 'x', type: 'NUMERIC' }],
      rows: [{ x: 7 }],
    });
    expect(handle).toBeGreaterThan(0);

    try {
      const required = callNumber('compatibility_dataset_to_json', handle, 0, 0);
      expect(required).toBeGreaterThan(1);
      const output = bridge.allocBuffer(required);
      try {
        new Uint8Array(bridge.memory().buffer, output.ptr, output.len).fill(0xa5);
        expect(
          callNumber('compatibility_dataset_to_json', handle, output.ptr, output.len - 1)
        ).toBe(required);
        expect(
          Array.from(new Uint8Array(bridge.memory().buffer, output.ptr, output.len)).every(
            (byte) => byte === 0xa5
          )
        ).toBe(true);
      } finally {
        bridge.deallocBuffer(output.ptr, output.len);
      }
    } finally {
      bridge.destroyDataset(handle);
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('does not partially write an undersized load-profile result', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const payload = new TextEncoder().encode(
      JSON.stringify({
        name: 'profile-output',
        columns: [{ name: 'x', type: 'NUMERIC' }],
        rows: [{ x: 1 }, { x: 2 }],
      })
    );
    const input = bridge.allocBytes(payload);
    let handle = 0;
    try {
      handle = callNumber('data_load_dataset_json_profiled', input.ptr, input.len);
      expect(handle).toBeGreaterThan(0);
    } finally {
      bridge.deallocBytes(input.ptr, input.len);
    }

    try {
      const required = callNumber('data_last_load_profile', 0, 0);
      expect(required).toBeGreaterThan(1);
      const output = bridge.allocBuffer(required);
      try {
        new Uint8Array(bridge.memory().buffer, output.ptr, output.len).fill(0xa5);
        expect(callNumber('data_last_load_profile', output.ptr, output.len - 1)).toBe(required);
        expect(
          Array.from(new Uint8Array(bridge.memory().buffer, output.ptr, output.len)).every(
            (byte) => byte === 0xa5
          )
        ).toBe(true);
      } finally {
        bridge.deallocBuffer(output.ptr, output.len);
      }
    } finally {
      if (handle !== 0) bridge.destroyDataset(handle);
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('routes legacy alloc/dealloc exports through tracked ownership', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const ptr = callNumber('alloc', 16);
    expect(ptr).toBeGreaterThan(0);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);

    bridge.call('dealloc', ptr, 15);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);

    bridge.call('dealloc', ptr, 16);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
    expect(() => bridge.call('dealloc', ptr, 16)).not.toThrow();
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('rejects arbitrary and overlong host ranges without trapping', () => {
    expect(() => bridge.call('fill_pattern', 8, 8)).not.toThrow();
    expect(callNumber('fill_pattern', 8, 8)).toBe(0);
    expect(callNumber('data_load_json', 8, 8)).toBe(0);
    expect(callNumber('data_load_csv', 8, 8)).toBe(0);
    expect(callNumber('data_load_typed_columns', 8, 8)).toBe(0);

    const allocation = bridge.allocBuffer(8);
    try {
      expect(callNumber('data_load_json', allocation.ptr, allocation.len + 1)).toBe(0);
      expect(callNumber('fill_pattern', allocation.ptr, allocation.len + 1)).toBe(0);
    } finally {
      bridge.deallocBuffer(allocation.ptr, allocation.len);
    }
  });

  it('permits a live interior subrange but not bytes outside its allocation', () => {
    const allocation = bridge.allocBuffer(16);
    try {
      const bytes = new Uint8Array(bridge.memory().buffer, allocation.ptr, allocation.len);
      bytes.fill(0xa5);

      expect(callNumber('fill_pattern', allocation.ptr + 4, 4)).toBe(4);
      expect(Array.from(bytes.slice(0, 4))).toEqual([0xa5, 0xa5, 0xa5, 0xa5]);
      expect(Array.from(bytes.slice(4, 8))).toEqual([0, 1, 2, 3]);
      expect(Array.from(bytes.slice(8))).toEqual(new Array(8).fill(0xa5));
      expect(callNumber('fill_pattern', allocation.ptr + 12, 8)).toBe(0);
    } finally {
      bridge.deallocBuffer(allocation.ptr, allocation.len);
    }
  });

  it('rejects an unowned output pointer instead of treating it as a size query', () => {
    const required = callNumber('kernel_version', 0, 0);
    expect(required).toBeGreaterThan(0);
    expect(callNumber('kernel_version', 8, required)).toBe(0);
    expect(callNumber('kernel_version', 0, required)).toBe(0);
  });

  it('revokes all prior host-buffer capabilities when init starts a new generation', () => {
    expect(bridge.hostBufferAllocationCount()).toBe(0);
    const allocation = bridge.allocBuffer(8);
    expect(bridge.hostBufferAllocationCount()).toBe(1);
    new Uint8Array(bridge.memory().buffer, allocation.ptr, allocation.len).fill(0xa5);

    expect(callNumber('init', 0x1234n)).toBe(1);
    expect(bridge.hostBufferAllocationCount()).toBe(0);
    expect(callNumber('fill_pattern', allocation.ptr, allocation.len)).toBe(0);
    expect(() => bridge.deallocBuffer(allocation.ptr, allocation.len)).not.toThrow();
  });
});
