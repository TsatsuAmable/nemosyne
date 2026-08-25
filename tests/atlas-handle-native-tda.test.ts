// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function makeDataset(name = 'current', offset = 0): Dataset {
  return new Dataset(
    name,
    [
      { name: 'x', type: ColumnType.NUMERIC },
      { name: 'y', type: ColumnType.NUMERIC },
    ],
    [
      { x: offset, y: offset + 1 },
      { x: offset + 2, y: offset + 3 },
    ]
  );
}

describe('Atlas handle-native TDA routing', () => {
  it('reuses the durable current handle for all TDA operations without reload or destruction', () => {
    const kernel = makeKernelMockBridge();
    const loadDatasetJson = vi.spyOn(kernel, 'loadDatasetJson');
    const destroyDataset = vi.spyOn(kernel, 'destroyDataset');
    const persistence = vi.spyOn(kernel, 'computePersistenceIntervals');
    const mapper = vi.spyOn(kernel, 'computeMapperGraph');
    const betti = vi.spyOn(kernel, 'computeBetti0Curve');
    const atlas = new AtlasCore({ kernel });

    expect(atlas.hasDataset).toBe(false);
    atlas.loadDataset(makeDataset());
    expect(atlas.hasDataset).toBe(true);

    // Establish the caller-owned Atlas capability once. Production TDA must
    // reuse this handle rather than serialising/reloading the same dataset.
    expect(atlas.datasetFingerprint).toBeTruthy();
    expect(loadDatasetJson).toHaveBeenCalledTimes(1);
    const currentHandle = loadDatasetJson.mock.results[0].value;
    const loadsBeforeTda = loadDatasetJson.mock.calls.length;
    const destroysBeforeTda = destroyDataset.mock.calls.length;

    const persistenceParams = { featureColumns: ['x', 'y'], maxDistance: 2 };
    const mapperParams = { featureColumns: ['x', 'y'], bins: 4, overlap: 0.25 };
    const bettiParams = { featureColumns: ['x', 'y'], steps: 8 };

    atlas.computePersistenceIntervals(atlas.dataset, persistenceParams);
    atlas.computeMapperGraph(atlas.dataset, mapperParams);
    atlas.computeBetti0Curve(atlas.dataset, bettiParams);

    expect(loadDatasetJson).toHaveBeenCalledTimes(loadsBeforeTda);
    expect(destroyDataset).toHaveBeenCalledTimes(destroysBeforeTda);
    expect(persistence).toHaveBeenCalledWith(currentHandle, persistenceParams);
    expect(mapper).toHaveBeenCalledWith(currentHandle, mapperParams);
    expect(betti).toHaveBeenCalledWith(currentHandle, bettiParams);
  });

  it('rejects a non-current dataset before serialisation or transient Rust loading', () => {
    const kernel = makeKernelMockBridge();
    const loadDatasetJson = vi.spyOn(kernel, 'loadDatasetJson');
    const destroyDataset = vi.spyOn(kernel, 'destroyDataset');
    const mapper = vi.spyOn(kernel, 'computeMapperGraph');
    const atlas = new AtlasCore({ kernel });

    atlas.loadDataset(makeDataset('current'));
    expect(atlas.datasetFingerprint).toBeTruthy();
    const currentHandle = loadDatasetJson.mock.results[0].value;
    const foreign = makeDataset('foreign', 100);
    const foreignToJson = vi.spyOn(foreign, 'toJSON');
    const params = { featureColumns: ['x', 'y'], bins: 3, overlap: 0.2 };

    const loadsBefore = loadDatasetJson.mock.calls.length;
    const destroysBefore = destroyDataset.mock.calls.length;

    expect(() => atlas.computeMapperGraph(foreign, params)).toThrow(
      /TDA requires the current Atlas dataset/
    );

    expect(foreignToJson).not.toHaveBeenCalled();
    expect(loadDatasetJson).toHaveBeenCalledTimes(loadsBefore);
    expect(destroyDataset).toHaveBeenCalledTimes(destroysBefore);
    expect(mapper).not.toHaveBeenCalled();

    // Rejection must not revoke or replace Atlas's durable current capability.
    atlas.computeMapperGraph(atlas.dataset, params);
    expect(loadDatasetJson).toHaveBeenCalledTimes(loadsBefore);
    expect(mapper).toHaveBeenLastCalledWith(currentHandle, params);
  });

  it('A1: columnar current runs TDA without calling loadDatasetJson or toJSON', () => {
    const kernel = makeKernelMockBridge();
    const loadDatasetJson = vi.spyOn(kernel, 'loadDatasetJson');
    const loadTypedColumns = vi.spyOn(kernel, 'loadTypedColumns');
    const persistence = vi.spyOn(kernel, 'computePersistenceIntervals');
    const mapper = vi.spyOn(kernel, 'computeMapperGraph');
    const betti = vi.spyOn(kernel, 'computeBetti0Curve');
    const atlas = new AtlasCore({ kernel });

    const dummyPayload = new Uint8Array([78, 84, 67, 49, 0, 0, 0, 0]);
    const handle = atlas.loadTypedDataset(dummyPayload, 'columnar-test');
    expect(handle).toBeGreaterThan(0);
    expect(loadTypedColumns).toHaveBeenCalledTimes(1);
    expect(loadDatasetJson).not.toHaveBeenCalled();

    const persistenceParams = { featureColumns: ['x', 'y'], maxDistance: 2 };
    const mapperParams = { featureColumns: ['x', 'y'], bins: 4, overlap: 0.25 };
    const bettiParams = { featureColumns: ['x', 'y'], steps: 8 };

    atlas.computePersistenceIntervalsForCurrent(persistenceParams);
    atlas.computeMapperGraphForCurrent(mapperParams);
    atlas.computeBetti0CurveForCurrent(bettiParams);

    expect(loadDatasetJson).not.toHaveBeenCalled();
    expect(persistence).toHaveBeenCalledWith(handle, persistenceParams);
    expect(mapper).toHaveBeenCalledWith(handle, mapperParams);
    expect(betti).toHaveBeenCalledWith(handle, bettiParams);
  });

  it('A2: currency by handle token and handle invalidation on replacement', () => {
    const kernel = makeKernelMockBridge();
    const destroyDataset = vi.spyOn(kernel, 'destroyDataset');
    const mapper = vi.spyOn(kernel, 'computeMapperGraph');
    const atlas = new AtlasCore({ kernel });

    const dummyPayload = new Uint8Array([78, 84, 67, 49, 0, 0, 0, 0]);
    const colHandle = atlas.loadTypedDataset(dummyPayload, 'columnar-test');
    expect(atlas.hasDataset).toBe(true);

    const params = { featureColumns: ['x', 'y'], bins: 4, overlap: 0.25 };
    atlas.computeMapperGraphForCurrent(params);
    expect(mapper).toHaveBeenCalledWith(colHandle, params);

    // Replace with a standard row dataset
    atlas.loadDataset(makeDataset('next'));
    expect(destroyDataset).toHaveBeenCalledWith(colHandle);
  });
});
