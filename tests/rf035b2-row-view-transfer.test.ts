// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { canonicalDatasetIdentityHex } from '../src/data/DatasetIdentity.ts';
import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionFence,
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
  AnalyticalExecutionResult,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import type { AnalysisSpec } from '../src/atlas/types.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

class RowViewPort implements AnalyticalExecutionPort {
  readonly isAsync = true;
  private registered = new Set<string>();
  fence: AnalyticalExecutionFence = {};
  response: AnalyticalExecutionResult<unknown> | null = null;

  async registerDataset(registration: AnalyticalDatasetRegistration): Promise<void> {
    this.registered.add(`${registration.generation}:${registration.dataset.fingerprint}`);
  }

  hasRegisteredDataset(generation: number, fingerprint: string): boolean {
    return this.registered.has(`${generation}:${fingerprint}`);
  }

  supersede(fence: AnalyticalExecutionFence): void {
    this.fence = { ...this.fence, ...fence };
    if (fence.datasetFingerprint) {
      this.registered.add(`${fence.generation ?? 1}:${fence.datasetFingerprint}`);
    }
  }

  async execute<T>(req: AnalyticalExecutionRequest): Promise<AnalyticalExecutionResult<T>> {
    if (!this.response) throw new Error('test response not configured');
    return {
      ...this.response,
      requestId: req.requestId,
      generation: req.generation,
      datasetVersion: req.dataset.version,
      datasetFingerprint: req.dataset.fingerprint,
    } as AnalyticalExecutionResult<T>;
  }
}

function dataset(): Dataset {
  return new Dataset(
    'source',
    [
      { name: 'id', type: ColumnType.TEXT },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    [
      { id: 'a', value: 30 },
      { id: 'b', value: 10 },
      { id: 'c', value: 20 },
    ],
    undefined,
    ['rid-a', 'rid-b', 'rid-c']
  );
}

function spec(atlas: AtlasCore): AnalysisSpec {
  return {
    datasetFingerprint: atlas.datasetFingerprint ?? '',
    datasetVersion: atlas.datasetVersion,
    operation: { op: 'sort', column: 'value', ascending: true },
    algorithmVersion: 'test-kernel',
    label: 'sort',
    seed: null,
    normalization: 'none',
    missingness: 'exclude-non-finite',
  };
}

describe('RF-035B2 compact row-view mutation transfer', () => {
  it('commits an authoritative row-view result without Dataset.fromJSON', async () => {
    const kernel = makeKernelMockBridge();
    const port = new RowViewPort();
    const atlas = new AtlasCore({ kernel: kernel as any });
    atlas.setExecutionPort(port);
    atlas.loadDataset(dataset());

    const expected = new Dataset(
      'source sorted',
      atlas.dataset.columns.slice(),
      [atlas.dataset.rows[1], atlas.dataset.rows[2], atlas.dataset.rows[0]],
      undefined,
      ['rid-b', 'rid-c', 'rid-a']
    );
    const outputFingerprint = canonicalDatasetIdentityHex(expected.toJSON());

    port.response = {
      requestId: 'placeholder',
      generation: 1,
      datasetVersion: atlas.datasetVersion,
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      value: {
        kind: 'row-view',
        outputFingerprint,
        view: {
          name: 'source sorted',
          rowIds: ['rid-b', 'rid-c', 'rid-a'],
          rowCount: 3,
          columnCount: 2,
          edgesPresent: false,
        },
      },
      provenance: null,
    };

    const fromJson = vi.spyOn(Dataset, 'fromJSON');
    const beforeRows = atlas.dataset.rows.slice();
    const result = await atlas.applyAnalysisAsync(spec(atlas));

    expect(fromJson).not.toHaveBeenCalled();
    expect(atlas.dataset.rows).toEqual([beforeRows[1], beforeRows[2], beforeRows[0]]);
    // Preserve the established Atlas defensive-copy boundary: a stale reference
    // to the prior dataset must not share mutable top-level row objects with the
    // newly committed current dataset.
    expect(atlas.dataset.rows[0]).not.toBe(beforeRows[1]);
    expect(atlas.dataset.rowIds).toEqual(['rid-b', 'rid-c', 'rid-a']);
    expect(result.dataset.rows.map((row) => row.id)).toEqual(['b', 'c', 'a']);
    expect(canonicalDatasetIdentityHex(result.dataset)).toBe(outputFingerprint);
    expect(atlas.datasetFingerprint).toBe(outputFingerprint);
    fromJson.mockRestore();
  });

  it('fails closed on an unknown row id instead of recomputing the operation in TypeScript', async () => {
    const kernel = makeKernelMockBridge();
    const port = new RowViewPort();
    const atlas = new AtlasCore({ kernel: kernel as any });
    atlas.setExecutionPort(port);
    atlas.loadDataset(dataset());
    const beforeFingerprint = atlas.datasetFingerprint;
    const beforeVersion = atlas.datasetVersion;

    port.response = {
      requestId: 'placeholder',
      generation: 1,
      datasetVersion: atlas.datasetVersion,
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      value: {
        kind: 'row-view',
        outputFingerprint: 'sha256:authoritative-but-unreconstructable',
        view: {
          name: 'source sorted',
          rowIds: ['rid-missing'],
          rowCount: 1,
          columnCount: 2,
          edgesPresent: false,
        },
      },
      provenance: null,
    };

    await expect(atlas.applyAnalysisAsync(spec(atlas))).rejects.toThrow(/row-view/i);
    expect(atlas.datasetFingerprint).toBe(beforeFingerprint);
    expect(atlas.datasetVersion).toBe(beforeVersion);
  });

  it('fails closed if a compact result claims graph edges', async () => {
    const kernel = makeKernelMockBridge();
    const port = new RowViewPort();
    const atlas = new AtlasCore({ kernel: kernel as any });
    atlas.setExecutionPort(port);
    atlas.loadDataset(dataset());

    port.response = {
      requestId: 'placeholder',
      generation: 1,
      datasetVersion: atlas.datasetVersion,
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      value: {
        kind: 'row-view',
        outputFingerprint: 'sha256:not-used',
        view: {
          name: 'graph result',
          rowIds: ['rid-a'],
          rowCount: 1,
          columnCount: 2,
          edgesPresent: true,
        },
      },
      provenance: null,
    };

    await expect(atlas.applyAnalysisAsync(spec(atlas))).rejects.toThrow(/edge/i);
  });
});
