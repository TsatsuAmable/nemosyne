import { describe, expect, it, vi } from 'vitest';
import { RustAnalyticalEvidenceAdapter } from '../src/atlas/adapters/RustAnalyticalEvidenceAdapter.ts';
import type { AnalyticalKernelPort } from '../src/atlas/adapters/AnalyticalKernelPort.ts';
import { KernelAbiError } from '../src/wasm/RuntimeBridge.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

describe('RustAnalyticalEvidenceAdapter', () => {
  it('owns and releases the temporary parser handle', () => {
    const kernel = makeKernelMockBridge();
    const destroy = vi.spyOn(kernel, 'destroyDataset');
    const adapter = new RustAnalyticalEvidenceAdapter(
      kernel as unknown as AnalyticalKernelPort,
      null
    );
    const parsed = adapter.parseDataset(
      new TextEncoder().encode('category,value\nA,1\nB,2'),
      'csv'
    );
    expect(parsed.dataset.rows).toHaveLength(2);
    expect(parsed.topology).toBeTruthy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('translates adapter failures and still releases temporary analytical handles', () => {
    const kernel = makeKernelMockBridge();
    const destroy = vi.spyOn(kernel, 'destroyDataset');
    kernel.computeMapperGraph = () => {
      throw new Error('trapped mapper ABI');
    };
    const onFailure = vi.fn();
    const adapter = new RustAnalyticalEvidenceAdapter(
      kernel as unknown as AnalyticalKernelPort,
      onFailure
    );
    expect(() =>
      adapter.computeMapperGraph(
        {
          name: 'adapter',
          columns: [{ name: 'value', type: 'NUMERIC' }],
          rows: [{ value: 1 }],
          edges: [],
        },
        {}
      )
    ).toThrow(KernelAbiError);
    expect(onFailure).toHaveBeenCalledWith(expect.any(KernelAbiError));
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
