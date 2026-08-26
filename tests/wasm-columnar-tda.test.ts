import { beforeAll, describe, expect, it } from 'vitest';
import { rowMaterialisationCount } from '../src/wasm/ColumnarBoundary.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { encodeTypedColumnsPayload } from '../src/wasm/TypedColumnsCodec.ts';

describe('columnar TDA real-WASM boundary', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('real WASM runtime unavailable');
  });

  function sampleColumnarPayload(): Uint8Array {
    return encodeTypedColumnsPayload({
      rowCount: 4,
      columns: [
        {
          name: 'x',
          type: 'numeric',
          values: [0.0, 1.0, 2.0, 3.0],
          validity: [1, 1, 1, 1],
        },
        {
          name: 'y',
          type: 'numeric',
          values: [0.0, 0.5, 1.0, 1.0],
          validity: [1, 1, 1, 1],
        },
      ],
    });
  }

  function highDimensionalPayload(rowCount = 9_000, dimensions = 7): Uint8Array {
    const validity = new Array<number>(rowCount).fill(1);
    return encodeTypedColumnsPayload({
      rowCount,
      columns: Array.from({ length: dimensions }, (_, dimension) => ({
        name: `x${dimension}`,
        type: 'numeric' as const,
        values: Array.from({ length: rowCount }, (_, row) => row * 0.01 + dimension),
        validity,
      })),
    });
  }

  function sampleRowMajorJson() {
    return {
      name: 'row-tda',
      columns: [
        { name: 'x', type: 'NUMERIC' as const },
        { name: 'y', type: 'NUMERIC' as const },
      ],
      rows: [
        { x: 0.0, y: 0.0 },
        { x: 1.0, y: 0.5 },
        { x: 2.0, y: 1.0 },
        { x: 3.0, y: 1.0 },
      ],
    };
  }

  it('W1: typed handle executes all three TDA operations', () => {
    const payload = sampleColumnarPayload();
    const handle = bridge.loadTypedColumns(payload, 'test-w1');
    expect(handle).toBeGreaterThan(0);

    try {
      const mapper = bridge.computeMapperGraph(handle, {
        featureColumns: ['x', 'y'],
        bins: 4,
        overlap: 0.3,
      });
      expect(mapper).not.toBeNull();
      expect(mapper?.nodes.length).toBeGreaterThan(0);

      const intervals = bridge.computePersistenceIntervals(handle, {
        featureColumns: ['x', 'y'],
        maxDistance: 1.0,
      });
      expect(intervals).not.toBeNull();
      expect(intervals?.length).toBeGreaterThan(0);

      const betti = bridge.computeBetti0Curve(handle, {
        featureColumns: ['x', 'y'],
        steps: 8,
      });
      expect(betti).not.toBeNull();
      expect(betti?.length).toBe(9);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('W2: row-major vs columnar cross-handle parity', () => {
    const colPayload = sampleColumnarPayload();
    const colHandle = bridge.loadTypedColumns(colPayload, 'parity-test');
    const rowHandle = bridge.loadDatasetJson(sampleRowMajorJson());

    expect(colHandle).toBeGreaterThan(0);
    expect(rowHandle).toBeGreaterThan(0);

    try {
      const colMapper = bridge.computeMapperGraph(colHandle, {
        featureColumns: ['x', 'y'],
        bins: 4,
        overlap: 0.3,
      });
      const rowMapper = bridge.computeMapperGraph(rowHandle, {
        featureColumns: ['x', 'y'],
        bins: 4,
        overlap: 0.3,
      });
      expect(colMapper).toEqual(rowMapper);

      const colIntervals = bridge.computePersistenceIntervals(colHandle, {
        featureColumns: ['x', 'y'],
        maxDistance: 1.0,
      });
      const rowIntervals = bridge.computePersistenceIntervals(rowHandle, {
        featureColumns: ['x', 'y'],
        maxDistance: 1.0,
      });
      expect(colIntervals).toEqual(rowIntervals);

      const colBetti = bridge.computeBetti0Curve(colHandle, {
        featureColumns: ['x', 'y'],
        steps: 8,
      });
      const rowBetti = bridge.computeBetti0Curve(rowHandle, {
        featureColumns: ['x', 'y'],
        steps: 8,
      });
      expect(colBetti).toEqual(rowBetti);
    } finally {
      bridge.destroyDataset(colHandle);
      bridge.destroyDataset(rowHandle);
    }
  });

  it('W3: zero row rematerialisation on columnar TDA execution', () => {
    const payload = sampleColumnarPayload();
    const handle = bridge.loadTypedColumns(payload, 'test-w3');
    expect(handle).toBeGreaterThan(0);

    const countBefore = rowMaterialisationCount();
    try {
      bridge.computeMapperGraph(handle, { featureColumns: ['x', 'y'], bins: 4, overlap: 0.3 });
      bridge.computePersistenceIntervals(handle, { featureColumns: ['x', 'y'], maxDistance: 1.0 });
      bridge.computeBetti0Curve(handle, { featureColumns: ['x', 'y'], steps: 8 });

      expect(rowMaterialisationCount()).toBe(countBefore);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('W4: foreign and destroyed handles fail closed', () => {
    const payload = sampleColumnarPayload();
    const handle = bridge.loadTypedColumns(payload, 'test-w4');
    expect(handle).toBeGreaterThan(0);
    bridge.destroyDataset(handle);

    expect(
      bridge.computeMapperGraph(handle, { featureColumns: ['x', 'y'], bins: 4, overlap: 0.3 })
    ).toBeNull();
    expect(
      bridge.computePersistenceIntervals(handle, { featureColumns: ['x', 'y'], maxDistance: 1.0 })
    ).toBeNull();
    expect(
      bridge.computeBetti0Curve(handle, { featureColumns: ['x', 'y'], steps: 8 })
    ).toBeNull();

    const invalidHandle = 999999;
    expect(
      bridge.computeMapperGraph(invalidHandle, { featureColumns: ['x', 'y'], bins: 4, overlap: 0.3 })
    ).toBeNull();
  });

  it('W5: Rust preflight rejects high-dimensional exact fallback before TDA execution', () => {
    const rowCount = 9_000;
    const dimensions = 7;
    const payload = highDimensionalPayload(rowCount, dimensions);
    const handle = bridge.loadTypedColumns(payload, 'rf030-high-d');
    expect(handle).toBeGreaterThan(0);

    try {
      const featureColumns = Array.from({ length: dimensions }, (_, index) => `x${index}`);
      let caught: unknown;
      try {
        bridge.computePersistenceIntervals(handle, {
          featureColumns,
          maxDistance: 1.0,
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(bridge.UnsupportedAtScaleError);
      const error = caught as bridge.UnsupportedAtScaleError;
      expect(error.code).toBe('UNSUPPORTED_AT_SCALE');
      expect(error.preflight.sourceRows).toBe(rowCount);
      expect(error.preflight.eligibleRows).toBe(rowCount);
      expect(error.preflight.excludedRows).toBe(0);
      expect(error.preflight.dimensions).toBe(dimensions);
      expect(error.preflight.eligibilityMode).toBe('complete_case_selected_features');
      expect(error.preflight.estimate.operation).toBe('compute_persistence_intervals');
      expect(error.preflight.estimate.reasonCode).toBe(
        'HIGH_DIMENSIONAL_EXACT_FALLBACK_OVER_BUDGET'
      );
      expect(error.message).toContain('UNSUPPORTED_AT_SCALE');
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});
