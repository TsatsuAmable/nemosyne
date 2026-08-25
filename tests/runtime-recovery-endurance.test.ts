import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

const HANDLE_SEQUENCE_BITS = 20;

function tinyDataset(name: string, value: number) {
  return {
    name,
    columns: [{ name: 'x', type: 'NUMERIC' as const }],
    rows: [{ x: value }],
  };
}

describe('real-WASM runtime recovery endurance', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    expect(bridge.isReady()).toBe(true);
  });

  it('revokes stale datasets, provenance, and host buffers across repeated recovery generations', async () => {
    const staleHandles: number[] = [];
    let previousGeneration = 0;

    for (let cycle = 0; cycle < 16; cycle += 1) {
      const input = bridge.loadDatasetJson(tinyDataset(`recovery-${cycle}`, cycle));
      expect(input).toBeGreaterThan(0);
      const generation = input >>> HANDLE_SEQUENCE_BITS;
      expect(generation).toBeGreaterThan(previousGeneration);
      previousGeneration = generation;

      const output = bridge.runOperation(input, { op: 'sort', column: 'x' });
      expect(output).toBeGreaterThan(0);
      expect(output >>> HANDLE_SEQUENCE_BITS).toBe(generation);
      expect(bridge.kernelProvenance()).not.toBeNull();
      staleHandles.push(input, output);

      const abandoned = bridge.allocBuffer(32);
      expect(bridge.hostBufferAllocationCount()).toBe(1);
      expect(Number(bridge.call('fill_pattern', abandoned.ptr, abandoned.len))).toBe(abandoned.len);

      bridge.invalidateRuntime(new WebAssembly.RuntimeError(`injected recovery cycle ${cycle}`));
      expect(bridge.getKernelState()).toBe('UNAVAILABLE');
      expect(() => bridge.datasetRowCount(input)).toThrow(bridge.KernelUnavailableError);

      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
      expect(bridge.getKernelState()).toBe('READY');
      expect(bridge.isReady()).toBe(true);
      expect(bridge.hostBufferAllocationCount()).toBe(0);
      expect(bridge.kernelProvenance()).toBeNull();
      expect(bridge.datasetRowCount(input)).toBe(0);
      expect(bridge.datasetRowCount(output)).toBe(0);
      expect(() => bridge.deallocBuffer(abandoned.ptr, abandoned.len)).not.toThrow();
    }

    const finalHandle = bridge.loadDatasetJson(tinyDataset('recovery-final', 999));
    try {
      const finalGeneration = finalHandle >>> HANDLE_SEQUENCE_BITS;
      expect(finalGeneration).toBeGreaterThan(previousGeneration);
      expect(bridge.datasetRowCount(finalHandle)).toBe(1);
      for (const staleHandle of staleHandles) {
        expect(bridge.datasetRowCount(staleHandle)).toBe(0);
      }
      expect(bridge.hostBufferAllocationCount()).toBe(0);
    } finally {
      bridge.destroyDataset(finalHandle);
    }
  });
});
