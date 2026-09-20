import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import * as runtimeState from '../src/wasm/runtime/RuntimeState.ts';

const call = (name: string, ...args: number[]) => Number(bridge.call(name, ...args)) >>> 0;
const params = { featureColumns: ['x'], steps: 4 };
const dataset = () =>
  bridge.loadDatasetJson({
    name: 'prepared-result',
    columns: [{ name: 'x', type: 'NUMERIC' }],
    rows: [{ x: 0 }, { x: null }, { x: 2 }, { x: 3 }],
  });

describe('UXR3 prepared result production boundary', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
  });

  it.each(['allocation', 'read'] as const)(
    'cleans real Rust ownership after host %s failure',
    (fault) => {
      const handle = dataset();
      const owner = runtimeState.getRawRuntimeExports();
      const baseline = bridge.hostBufferAllocationCount();
      const injected = {
        ...owner,
        memory: owner.memory,
        host_buffer_alloc: fault === 'allocation' ? () => 0 : owner.host_buffer_alloc,
        prepared_result_read: (token: number, ptr: number, len: number) =>
          fault === 'read' && ptr !== 0 ? 0 : owner.prepared_result_read(token, ptr, len),
      };
      const spy = vi.spyOn(runtimeState, 'getRawRuntimeExports').mockReturnValue(injected);
      try {
        expect(() => bridge.computeBetti0Curve(handle, params)).toThrow();
      } finally {
        spy.mockRestore();
        expect(call('prepared_result_count')).toBe(0);
        expect(call('prepared_result_bytes')).toBe(0);
        expect(bridge.hostBufferAllocationCount()).toBe(baseline);
        bridge.destroyDataset(handle);
      }
    }
  );

  it('releases a reservation after malformed input and rejects an invalid dataset', () => {
    const handle = dataset();
    const input = bridge.allocBytes(new TextEncoder().encode('{'));
    try {
      expect(call('data_prepare_betti0_curve', handle, input.ptr, input.len)).toBe(0);
      expect(call('prepared_result_count')).toBe(0);
      expect(bridge.computeBetti0Curve(0, params)).toBeNull();
    } finally {
      bridge.deallocBytes(input.ptr, input.len);
      bridge.destroyDataset(handle);
    }
  });

  it('preserves analytical scale refusal without computing or retaining a result', () => {
    const featureColumns = Array.from({ length: 7 }, (_, i) => `x${i}`);
    const handle = bridge.loadDatasetJson({
      name: 'over-budget',
      columns: featureColumns.map((name) => ({ name, type: 'NUMERIC' as const })),
      rows: Array.from({ length: 9000 }, (_, i) =>
        Object.fromEntries(featureColumns.map((name) => [name, i]))
      ),
    });
    const before = call('tda_computation_count', 1);
    const buffers = bridge.hostBufferAllocationCount();
    try {
      expect(() => bridge.computePersistenceIntervals(handle, { featureColumns })).toThrow(
        bridge.UnsupportedAtScaleError
      );
      expect(call('tda_computation_count', 1)).toBe(before);
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_bytes')).toBe(0);
      expect(bridge.hostBufferAllocationCount()).toBe(buffers);
      expect(bridge.kernelProvenance()?.outcome).toBe('refused');
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('preserves admitted Betti results larger than 16 MiB', () => {
    const handle = bridge.loadDatasetJson({
      name: 'large-admitted-output',
      columns: [{ name: 'x', type: 'NUMERIC' }],
      rows: [{ x: 0 }, { x: 1 }],
    });
    const before = call('tda_computation_count', 2);
    try {
      const result = bridge.computeBetti0Curve(handle, { featureColumns: ['x'], steps: 1_000_000 });
      expect(result?.length).toBeGreaterThanOrEqual(1_000_000);
      expect(call('tda_computation_count', 2) - before).toBe(1);
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_bytes')).toBe(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('invalidates prepared capabilities on a runtime-generation reset', () => {
    const handle = dataset();
    const input = bridge.allocBytes(new TextEncoder().encode(JSON.stringify(params)));
    const token = call('data_prepare_betti0_curve', handle, input.ptr, input.len);
    bridge.deallocBytes(input.ptr, input.len);
    expect(token).not.toBe(0);
    expect(call('data_reset_runtime_generation', bridge.getRuntimeGeneration() + 1)).toBe(1);
    expect(call('prepared_result_count')).toBe(0);
    expect(call('prepared_result_read', token, 0, 0)).toBe(0);
    const next = dataset();
    const nextInput = bridge.allocBytes(new TextEncoder().encode(JSON.stringify(params)));
    try {
      const nextToken = call('data_prepare_betti0_curve', next, nextInput.ptr, nextInput.len);
      expect(nextToken).not.toBe(token);
      call('prepared_result_destroy', token);
      expect(call('prepared_result_read', nextToken, 0, 0)).toBeGreaterThan(0);
    } finally {
      bridge.destroyDataset(next);
      bridge.deallocBytes(nextInput.ptr, nextInput.len);
    }
  });

  it.each([
    [0, bridge.computeMapperGraph, 'data_compute_mapper_graph'],
    [1, bridge.computePersistenceIntervals, 'data_compute_persistence_intervals'],
    [2, bridge.computeBetti0Curve, 'data_compute_betti0_curve'],
  ] as const)(
    'computes operation %s once and preserves legacy output',
    (operation, compute, legacy) => {
      const handle = dataset();
      const before = call('tda_computation_count', operation);
      const buffers = bridge.hostBufferAllocationCount();
      try {
        const result = compute(handle, params);
        expect(result).not.toBeNull();
        expect(call('tda_computation_count', operation) - before).toBe(1);
        expect(call('prepared_result_count')).toBe(0);
        expect(call('prepared_result_bytes')).toBe(0);
        expect(bridge.hostBufferAllocationCount()).toBe(buffers);
        const provenance = bridge.kernelProvenance();
        const input = bridge.allocBytes(new TextEncoder().encode(JSON.stringify(params)));
        try {
          const length = call(legacy, handle, input.ptr, input.len, 0, 0);
          const output = bridge.allocBuffer(length);
          try {
            expect(call(legacy, handle, input.ptr, input.len, output.ptr, output.len)).toBe(length);
            expect(JSON.parse(bridge.readString(output.ptr, length))).toEqual(result);
            const legacyProvenance = bridge.kernelProvenance();
            expect(legacyProvenance?.inputFingerprint).toEqual(provenance?.inputFingerprint);
            expect(legacyProvenance?.outputFingerprint).toEqual(provenance?.outputFingerprint);
          } finally {
            bridge.deallocBuffer(output.ptr, output.len);
          }
        } finally {
          bridge.deallocBytes(input.ptr, input.len);
        }
      } finally {
        bridge.destroyDataset(handle);
      }
    }
  );

  it('retries reads without computation or provenance changes and rejects stale tokens', () => {
    const handle = dataset();
    const input = bridge.allocBytes(new TextEncoder().encode(JSON.stringify(params)));
    const token = call('data_prepare_betti0_curve', handle, input.ptr, input.len);
    try {
      const length = call('prepared_result_read', token, 0, 0);
      const before = call('tda_computation_count', 2);
      const provenance = bridge.kernelProvenance();
      const output = bridge.allocBuffer(length);
      try {
        new Uint8Array(bridge.memory().buffer, output.ptr, length).fill(0xa5);
        expect(call('prepared_result_read', token, output.ptr, length - 1)).toBe(length);
        expect(bridge.readBytes(output.ptr, length).every((byte) => byte === 0xa5)).toBe(true);
        expect(call('prepared_result_read', token, 0, length)).toBe(0);
        expect(call('prepared_result_read', token, output.ptr, length)).toBe(length);
        expect(call('tda_computation_count', 2)).toBe(before);
        expect(bridge.kernelProvenance()).toEqual(provenance);
      } finally {
        bridge.deallocBuffer(output.ptr, output.len);
      }
      call('prepared_result_destroy', token);
      call('prepared_result_destroy', token);
      expect(call('prepared_result_read', token, 0, 0)).toBe(0);
    } finally {
      call('prepared_result_destroy', token);
      bridge.deallocBytes(input.ptr, input.len);
      bridge.destroyDataset(handle);
    }
  });

  it('refuses admission before computation and destroys undrained results with their dataset', () => {
    const handle = dataset();
    const input = bridge.allocBytes(new TextEncoder().encode(JSON.stringify(params)));
    const tokens: number[] = [];
    try {
      for (let i = 0; i < 4; i++) {
        const token = call('data_prepare_betti0_curve', handle, input.ptr, input.len);
        expect(token).toBeGreaterThan(0);
        tokens.push(token);
      }
      const before = call('tda_computation_count', 2);
      expect(call('data_prepare_betti0_curve', handle, input.ptr, input.len)).toBe(0xffffffff);
      expect(call('tda_computation_count', 2)).toBe(before);
      expect(call('prepared_result_count')).toBe(4);
      bridge.destroyDataset(handle);
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_bytes')).toBe(0);
      for (const token of tokens) expect(call('prepared_result_read', token, 0, 0)).toBe(0);
    } finally {
      tokens.forEach((token) => call('prepared_result_destroy', token));
      bridge.deallocBytes(input.ptr, input.len);
      bridge.destroyDataset(handle);
    }
  });
});
