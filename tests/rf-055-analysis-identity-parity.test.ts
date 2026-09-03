import { describe, expect, it, vi } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import type { AnalysisSpec } from '../src/atlas/types.ts';
import type { AnalyticalExecutionPort } from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function staleSpec(atlas: AtlasCore): AnalysisSpec {
  return {
    datasetFingerprint: `${atlas.datasetFingerprint ?? 'missing'}-stale`,
    datasetVersion: atlas.datasetVersion,
    algorithmVersion: atlas.kernelVersion() ?? 'test-kernel',
    operation: { op: 'slice', start: 0, end: 1 },
  };
}

describe('RF-055 analysis identity parity', () => {
  it('rejects the same stale dataset fingerprint on sync, preview, and async paths before execution', async () => {
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel });
    atlas.loadDataset(
      new Dataset('identity-parity', [{ name: 'value', type: 'NUMERIC' }], [{ value: 1 }, { value: 2 }])
    );
    const spec = staleSpec(atlas);

    expect(() => atlas.applyAnalysis(spec)).toThrow(/sync analysis spec targets a non-current dataset fingerprint/);
    expect(() => atlas.previewAnalysis(spec)).toThrow(/preview analysis spec targets a non-current dataset fingerprint/);

    const execute = vi.fn();
    const registerDataset = vi.fn();
    const port: AnalyticalExecutionPort = {
      isAsync: true,
      execute,
      registerDataset,
      supersede: vi.fn(),
    };
    atlas.setExecutionPort(port);

    await expect(atlas.applyAnalysisAsync(spec)).rejects.toThrow(
      /async analysis spec targets a non-current dataset fingerprint/
    );
    expect(registerDataset).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
