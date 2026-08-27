import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { DatasetSpace } from '../src/atlas/DatasetSpace.ts';
import { AnalyticalState } from '../src/atlas/domain/AnalyticalState.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { canonicalDatasetIdentityHex } from '../src/data/DatasetIdentity.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function makeDataset(): Dataset {
  return new Dataset(
    'space-authority',
    [{ name: 'value', type: ColumnType.NUMERIC }],
    [{ value: 10 }, { value: 20 }, { value: 30 }]
  );
}

describe('RF-051 DatasetSpace authority and materialisation', () => {
  it('uses durable Atlas row identity and Rust-owned ranges on the live production path', () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    const dataset = makeDataset();

    atlas.loadDataset(dataset);

    expect(atlas.dataset.rowIds).toHaveLength(dataset.rowCount);
    const space = atlas.datasetSpace;
    expect(space).not.toBeNull();
    expect(space!.fingerprint).toBe(atlas.datasetFingerprint);
    expect(space!.datumIds).toEqual(atlas.dataset.rowIds);
    expect(space!.normalization.value).toEqual({ min: 10, max: 30 });
  });

  it('does not clone the live Atlas working dataset when authoritative space metadata is complete', () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(makeDataset());
    const current = atlas.dataset;
    current.clone = () => {
      throw new Error('live DatasetSpace must not allocate another row snapshot');
    };

    const space = atlas.datasetSpace;

    expect(space).not.toBeNull();
    expect(space!.dataset).toBe(current);
    expect(space!.datumIds).toEqual(current.rowIds);
    expect(space!.normalization.value).toEqual({ min: 10, max: 30 });
  });

  it('reuses the live DatasetSpace identities when discovered structures target the loaded source object', () => {
    const kernel: any = makeKernelMockBridge();
    kernel.computeMapperGraph = () => ({
      nodes: [
        {
          id: 0,
          rowIndices: [0, 1],
          level: 0,
          center: [0],
          filterCenter: 0,
          size: 2,
        },
      ],
      edges: [],
    });
    const atlas = new AtlasCore({ kernel });
    const dataset = makeDataset();
    atlas.loadDataset(dataset);

    const structures = atlas.discoverMapperStructures(dataset, { bins: 2 });

    expect(structures).not.toBeNull();
    expect(atlas.dataset.rowIds).toBeDefined();
    expect(structures!.structures[0].datumIds).toEqual(atlas.dataset.rowIds!.slice(0, 2));
  });

  it('does not construct DatasetSpace merely to obtain the fallback scientific fingerprint', () => {
    const state = new AnalyticalState();
    state.loadDataset(makeDataset());
    state.current.rangeOf = () => {
      throw new Error('range scan should not run for fingerprint lookup');
    };

    expect(state.getFingerprint()).toBe(canonicalDatasetIdentityHex(state.current.toJSON()));
  });

  it('retains authoritative mutation fingerprint and row lineage without eagerly constructing DatasetSpace', () => {
    const state = new AnalyticalState();
    state.loadDataset(makeDataset());
    const output = makeDataset();
    expect(output.adoptRowIds(['kernel:0', 'kernel:1', 'kernel:2'])).toBe(true);
    const outputFingerprint = 'c'.repeat(64);
    const originalRangeOf = Dataset.prototype.rangeOf;
    Dataset.prototype.rangeOf = () => {
      throw new Error('mutation commit must not scan JS ranges');
    };

    try {
      expect(() => state.commitKernelResult({
        handle: 7,
        dataset: output,
        fingerprint: outputFingerprint,
      })).not.toThrow();
    } finally {
      Dataset.prototype.rangeOf = originalRangeOf;
    }

    let providerCalls = 0;
    expect(state.getFingerprint(() => {
      providerCalls += 1;
      return 'd'.repeat(64);
    })).toBe(outputFingerprint);
    expect(providerCalls).toBe(0);

    const persistedSpace = state.getDatasetSpace();
    expect(persistedSpace).not.toBeNull();
    expect(persistedSpace!.fingerprint).toBe(outputFingerprint);
    expect(persistedSpace!.datumIds).toEqual(state.current.rowIds);
  });

  it('fails closed instead of rescanning JavaScript rows when live range evidence is unavailable', () => {
    const state = new AnalyticalState();
    state.loadDataset(makeDataset());
    state.current.rangeOf = () => {
      throw new Error('live authority path must not fall back to a JS range scan');
    };

    const space = state.getDatasetSpace(
      () => 'b'.repeat(64),
      () => null,
    );

    expect(space).not.toBeNull();
    expect(space!.normalization).toEqual({});
  });

  it('accepts explicit authoritative datum IDs without cloning, legacy row hashing, or redundant serialization', () => {
    const source = makeDataset();
    source.clone = () => {
      throw new Error('complete authoritative DatasetSpace metadata must not clone rows');
    };
    source.toJSON = () => {
      throw new Error('redundant DatasetSpace serialization');
    };
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    source.rows[0].payload = cycle;

    const fingerprint = 'a'.repeat(64);
    const space = new DatasetSpace(source, {
      fingerprint,
      ranges: { value: { min: 10, max: 30 } },
      datumIds: ['rust:0', 'rust:1', 'rust:2'],
      borrowDataset: true,
    });

    expect(space.dataset).toBe(source);
    expect(space.fingerprint).toBe(fingerprint);
    expect(space.datumIds).toEqual(['rust:0', 'rust:1', 'rust:2']);
    expect(space.normalization.value).toEqual({ min: 10, max: 30 });
  });

  it('fails closed on malformed authoritative datum identity vectors', () => {
    const dataset = makeDataset();
    const fingerprint = canonicalDatasetIdentityHex(dataset.toJSON());

    expect(() => new DatasetSpace(dataset, {
      fingerprint,
      datumIds: ['only-one'],
    })).toThrow(/datum IDs/i);

    expect(() => new DatasetSpace(dataset, {
      fingerprint,
      datumIds: ['dup', 'dup', 'other'],
    })).toThrow(/datum IDs/i);
  });

  it('keeps direct/schema-v2 content-occurrence datum IDs stable even when rowIds are present', () => {
    const dataset = new Dataset(
      'legacy-space',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 1 }],
      undefined,
      ['rust:a', 'rust:b']
    );
    const legacy = new DatasetSpace(dataset).toJSON();

    expect(legacy.datumIds).not.toEqual(legacy.dataset.rowIds);
    expect(DatasetSpace.fromJSON(legacy).toJSON()).toEqual(legacy);
  });
});
