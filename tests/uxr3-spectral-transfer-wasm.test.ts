import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import * as state from '../src/wasm/runtime/RuntimeState.ts';
import { encodeTypedColumnsPayload } from '../src/wasm/TypedColumnsCodec.ts';

const call = (name: string, ...args: number[]) => Number(bridge.call(name, ...args)) >>> 0;
const fixture = (irregular = false) =>
  bridge.loadDatasetJson({
    name: 'spectral α',
    columns: [
      { name: 'time', type: 'TEMPORAL' },
      { name: 'value', type: 'NUMERIC' },
    ],
    rows: Array.from({ length: 64 }, (_, i) => ({
      time: i * 0.5 + (irregular && i === 20 ? 0.2 : 0),
      value: Math.sin((2 * Math.PI * i) / 16),
    })),
  });
const implicitFixture = () =>
  bridge.loadDatasetJson({
    name: 'implicit spectral α',
    columns: [{ name: 'value', type: 'NUMERIC' }],
    rows: Array.from({ length: 64 }, (_, i) => ({ value: Math.sin((2 * Math.PI * i) / 16) })),
  });

function legacy(handle: number, time?: string, value?: string) {
  const timeInput = time ? bridge.allocBytes(new TextEncoder().encode(time)) : { ptr: 0, len: 0 };
  const valueInput = value
    ? bridge.allocBytes(new TextEncoder().encode(value))
    : { ptr: 0, len: 0 };
  try {
    const args = [handle, timeInput.ptr, timeInput.len, valueInput.ptr, valueInput.len];
    const size = call('data_compute_spectral_facts', ...args, 0, 0);
    if (!size) return null;
    const output = bridge.allocBuffer(size);
    try {
      expect(call('data_compute_spectral_facts', ...args, output.ptr, output.len)).toBe(size);
      return JSON.parse(bridge.readString(output.ptr, size));
    } finally {
      bridge.deallocBuffer(output.ptr, output.len);
    }
  } finally {
    bridge.deallocBytes(valueInput.ptr, valueInput.len);
    bridge.deallocBytes(timeInput.ptr, timeInput.len);
  }
}

describe('R1 spectral production transfer', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
  });

  it.each([
    { time: 'time', value: 'value' },
    { time: undefined, value: undefined },
  ])('runs one regular-time analysis and preserves authoritative facts %j', ({ time, value }) => {
    const handle = fixture();
    try {
      const before = call('prepared_computation_count', 11);
      const facts = bridge.computeSpectralFacts(handle, time, value);
      expect(call('prepared_computation_count', 11) - before).toBe(1);
      expect(facts).toMatchObject({
        method: 'regular-time-fft',
        hasPeriodicity: true,
        observedCount: 64,
        transformLength: 64,
      });
      expect(facts!.dominantFrequencies[0]).toBeCloseTo(0.125, 2);
      expect(facts!.characteristicScale).toBeCloseTo(8, 1);
      const provenance = bridge.kernelProvenance();
      expect(provenance).toMatchObject({
        operation: 'spectral_facts',
        inputFingerprint: bridge.datasetFingerprint(handle),
      });
      expect(provenance?.outputFingerprint).toBeTruthy();
      expect(facts).toEqual(legacy(handle, time, value));
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_bytes')).toBe(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('uses implicit observation index only when no temporal column exists', () => {
    const handle = implicitFixture();
    try {
      const before = call('prepared_computation_count', 11);
      const facts = bridge.computeSpectralFacts(handle);
      expect(call('prepared_computation_count', 11) - before).toBe(1);
      expect(facts).toMatchObject({
        method: 'implicit-index-fft',
        hasPeriodicity: true,
        observedCount: 64,
        transformLength: 64,
      });
      expect(facts!.dominantFrequencies[0]).toBeCloseTo(0.0625, 3);
      expect(facts!.characteristicScale).toBeCloseTo(16, 1);
      const provenance = bridge.kernelProvenance();
      expect(provenance).toMatchObject({
        operation: 'spectral_facts',
        inputFingerprint: bridge.datasetFingerprint(handle),
      });
      expect(facts).toEqual(legacy(handle));
      expect(call('prepared_result_count')).toBe(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('returns null for irregular sampling while recording null-output provenance once', () => {
    const handle = fixture(true);
    try {
      const before = call('prepared_computation_count', 11);
      expect(bridge.computeSpectralFacts(handle, 'time', 'value')).toBeNull();
      expect(call('prepared_computation_count', 11) - before).toBe(1);
      const provenance = bridge.kernelProvenance();
      expect(provenance).toMatchObject({
        operation: 'spectral_facts',
        inputFingerprint: bridge.datasetFingerprint(handle),
      });
      expect(provenance?.outputFingerprint).toBeTruthy();
      expect(legacy(handle, 'time', 'value')).toBeNull();
      expect(bridge.kernelProvenance()?.outputFingerprint).toBe(provenance?.outputFingerprint);
      expect(call('prepared_result_count')).toBe(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('refuses an explicitly missing time field without inventing a regular series', () => {
    const handle = fixture();
    try {
      const before = call('prepared_computation_count', 11);
      expect(bridge.computeSpectralFacts(handle, 'absent', 'value')).toBeNull();
      expect(call('prepared_computation_count', 11) - before).toBe(1);
      const provenance = bridge.kernelProvenance();
      expect(provenance).toMatchObject({
        operation: 'spectral_facts',
        inputFingerprint: bridge.datasetFingerprint(handle),
      });
      expect(legacy(handle, 'absent', 'value')).toBeNull();
      expect(bridge.kernelProvenance()?.outputFingerprint).toBe(provenance?.outputFingerprint);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('rejects malformed pointers and UTF-8 before substantive work or admission', () => {
    const handle = fixture();
    const bad = bridge.allocBuffer(1);
    new Uint8Array(state.getRawRuntimeExports().memory.buffer, bad.ptr, 1)[0] = 0xff;
    try {
      const before = call('prepared_computation_count', 11);
      expect(call('data_prepare_spectral_facts', handle, 0xffffffff, 1, 0, 0)).toBe(0);
      expect(call('data_prepare_spectral_facts', handle, bad.ptr, 1, 0, 0)).toBe(0);
      expect(call('prepared_computation_count', 11)).toBe(before);
      expect(call('prepared_result_count')).toBe(0);
    } finally {
      bridge.deallocBuffer(bad.ptr, bad.len);
      bridge.destroyDataset(handle);
    }
  });

  it('preserves invalid and columnar-only null under saturated admission', () => {
    const handle = fixture();
    const columnar = bridge.loadTypedColumns(
      encodeTypedColumnsPayload({
        rowCount: 2,
        columns: [{ name: 'value', type: 'numeric', values: [1, 2] }],
      }),
      'columnar'
    );
    try {
      const tokens = Array.from({ length: 4 }, () =>
        call('data_prepare_spectral_facts', handle, 0, 0, 0, 0)
      );
      expect(tokens.every((t) => t !== 0 && t !== 0xffffffff)).toBe(true);
      const before = call('prepared_computation_count', 11);
      expect(bridge.computeSpectralFacts(0)).toBeNull();
      expect(bridge.computeSpectralFacts(columnar)).toBeNull();
      expect(call('prepared_computation_count', 11)).toBe(before);
      expect(() => bridge.computeSpectralFacts(handle)).toThrow(/resource limit/);
      expect(call('prepared_result_count')).toBe(4);
      bridge.destroyDataset(handle);
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_read', tokens[0], 0, 0)).toBe(0);
    } finally {
      bridge.destroyDataset(handle);
      bridge.destroyDataset(columnar);
    }
  });

  it('releases real result and input buffers on output allocation and read failures', () => {
    const handle = fixture();
    const owner = state.getRawRuntimeExports();
    const baseline = bridge.hostBufferAllocationCount();
    try {
      for (const failure of ['allocation', 'read']) {
        const spy = vi.spyOn(state, 'getRawRuntimeExports').mockReturnValue({
          ...owner,
          memory: owner.memory,
          host_buffer_alloc:
            failure === 'allocation'
              ? (len: number) => (len > 100 ? 0 : owner.host_buffer_alloc(len))
              : owner.host_buffer_alloc,
          prepared_result_read: (token, ptr, len) =>
            failure === 'read' && ptr ? 0 : owner.prepared_result_read(token, ptr, len),
        });
        try {
          if (failure === 'allocation')
            expect(() => bridge.computeSpectralFacts(handle, 'time', 'value')).toThrow();
          else expect(bridge.computeSpectralFacts(handle, 'time', 'value')).toBeNull();
        } finally {
          spy.mockRestore();
        }
        expect(call('prepared_result_count')).toBe(0);
        expect(call('prepared_result_bytes')).toBe(0);
        expect(bridge.hostBufferAllocationCount()).toBe(baseline);
      }
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('frees the first input when the second input allocation fails', () => {
    const handle = fixture();
    const owner = state.getRawRuntimeExports();
    const baseline = bridge.hostBufferAllocationCount();
    let allocations = 0;
    const spy = vi.spyOn(state, 'getMemoryAbiExports').mockReturnValue({
      ...owner,
      memory: owner.memory,
      host_buffer_alloc: (len: number) => (++allocations === 2 ? 0 : owner.host_buffer_alloc(len)),
    });
    try {
      expect(() => bridge.computeSpectralFacts(handle, 'time', 'value')).toThrow();
    } finally {
      spy.mockRestore();
      bridge.destroyDataset(handle);
    }
    expect(bridge.hostBufferAllocationCount()).toBe(baseline);
    expect(call('prepared_result_count')).toBe(0);
  });

  it('invalidates a pending spectral result on runtime generation reset', () => {
    const handle = fixture();
    const token = call('data_prepare_spectral_facts', handle, 0, 0, 0, 0);
    expect(token).not.toBe(0);
    expect(token).not.toBe(0xffffffff);
    expect(call('prepared_result_read', token, 0, 0)).toBeGreaterThan(0);
    expect(call('data_reset_runtime_generation', bridge.getRuntimeGeneration() + 1)).toBe(1);
    expect(call('prepared_result_count')).toBe(0);
    expect(call('prepared_result_bytes')).toBe(0);
    expect(call('prepared_result_read', token, 0, 0)).toBe(0);
  });
});
