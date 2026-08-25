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

  it('runs TDA directly against an existing Rust dataset handle without reloading rows', () => {
    const kernel = makeKernelMockBridge();
    const loadDatasetJson = vi.spyOn(kernel, 'loadDatasetJson');
    const destroy = vi.spyOn(kernel, 'destroyDataset');
    const mapper = vi.spyOn(kernel, 'computeMapperGraph').mockReturnValue({
      nodes: [],
      edges: [],
    });
    const persistence = vi.spyOn(kernel, 'computePersistenceIntervals').mockReturnValue([]);
    const betti = vi.spyOn(kernel, 'computeBetti0Curve').mockReturnValue([]);
    const adapter = new RustAnalyticalEvidenceAdapter(
      kernel as unknown as AnalyticalKernelPort,
      null
    );
    const handle = 123;
    const params = { featureColumns: ['x', 'y'], filterColumn: 'x' };

    expect(adapter.computeMapperGraphForHandle(handle, params)).toEqual({ nodes: [], edges: [] });
    expect(adapter.computePersistenceIntervalsForHandle(handle, params)).toEqual([]);
    expect(adapter.computeBetti0CurveForHandle(handle, params)).toEqual([]);

    expect(mapper).toHaveBeenCalledWith(handle, params);
    expect(persistence).toHaveBeenCalledWith(handle, params);
    expect(betti).toHaveBeenCalledWith(handle, params);
    expect(loadDatasetJson).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });
});
