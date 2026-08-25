import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

const MAX_WASM_BYTES = 8192 * 65_536;

describe('tracked WASM host-buffer ownership', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    expect(bridge.isReady()).toBe(true);
  });

  it('fails closed on mismatched, duplicate, and unknown frees without leaking', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const allocation = bridge.allocBuffer(32);

    expect(allocation.len).toBe(32);
    expect(allocation.ptr).toBeGreaterThan(0);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);

    bridge.deallocBuffer(allocation.ptr, allocation.len - 1);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);

    bridge.deallocBuffer(allocation.ptr + 1, allocation.len);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);

    bridge.deallocBuffer(allocation.ptr, allocation.len);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);

    bridge.deallocBuffer(allocation.ptr, allocation.len);
    bridge.deallocBuffer(1, allocation.len);
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('rejects an allocation larger than the governed WASM memory ceiling', () => {
    const baseline = bridge.hostBufferAllocationCount();

    expect(() => bridge.allocBuffer(MAX_WASM_BYTES + 1)).toThrow(
      'WASM host_buffer_alloc returned 0'
    );
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });

  it('keeps ordinary byte payload allocation on the tracked ownership path', () => {
    const baseline = bridge.hostBufferAllocationCount();
    const payload = new Uint8Array([7, 11, 13, 17]);
    const allocation = bridge.allocBytes(payload);

    try {
      expect(bridge.hostBufferAllocationCount()).toBe(baseline + 1);
      expect(
        Array.from(new Uint8Array(bridge.memory().buffer, allocation.ptr, allocation.len))
      ).toEqual(Array.from(payload));
    } finally {
      bridge.deallocBytes(allocation.ptr, allocation.len);
    }

    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
  });
});
