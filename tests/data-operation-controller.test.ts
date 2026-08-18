// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { DataOperationController } from '../src/vr/coordinators/DataOperationController.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { ConstraintEngine, TopologyTypes } from '../src/draco/ConstraintEngine.ts';
import { VRTopologyTranslator } from '../src/draco/VRTopologyTranslator.ts';
import { captureBaseState } from '../src/vr/interactions/DataOperations.ts';

function makeArtifact() {
  const group = new THREE.Group();
  const nodeMeshes = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    mesh.userData.row = { id: i + 1, value: (i + 1) * 10 };
    nodeMeshes.push(mesh);
    group.add(mesh);
  }
  captureBaseState({ nodeMeshes });
  return { group, nodeMeshes };
}

function makeDataset() {
  return new Dataset(
    'Test',
    [
      { name: 'id', type: ColumnType.NUMERIC },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    [
      { id: 1, value: 10 },
      { id: 2, value: 20 },
      { id: 3, value: 30 },
      { id: 4, value: 40 },
    ]
  );
}

/**
 * Mock analytical kernel. The controller mechanics (history, events, undo/redo,
 * preview) are exercised against canned kernel responses in plain jsdom — no
 * real wasm/pkg is loaded. Exact analytical parity (filter median, sort order,
 * cluster algorithm) is covered by Rust #[test]s + wasm-runtime.test.ts.
 */
function makeMockBridge() {
  const store = new Map();
  let next = 1;
  let lastOp = null;

  function cannedResultFor(op, input) {
    const rows = input.rows ?? [];
    if (op.op === 'filter') {
      // Kernel-shaped subset: keep rows with value > 20.
      return { ...input, rows: rows.filter((r) => Number(r.value) > 20) };
    }
    if (op.op === 'sort') {
      const col = op.column;
      return {
        ...input,
        rows: [...rows].sort((a, b) => Number(a[col]) - Number(b[col])),
      };
    }
    if (op.op === 'aggregate') {
      return { ...input, rows: [{ _count: rows.length, id: 0, value: rows.reduce((s, r) => s + Number(r.value), 0) }] };
    }
    // slice / unknown → identity
    return input;
  }

  return {
    isReady: () => true,
    capabilities: () => 0x3c07,
    loadDatasetJson: (obj) => {
      const h = next++;
      store.set(h, obj);
      return h;
    },
    loadCsv: () => 1,
    loadJson: () => 1,
    loadSample: () => 1,
    runOperation: (handle, op) => {
      lastOp = op;
      const input = store.get(handle);
      const result = cannedResultFor(op, input);
      const h = next++;
      store.set(h, result);
      return h;
    },
    getDatasetJson: (handle) => store.get(handle) ?? null,
    destroyDataset: () => {},
    statistics: () => ({
      rowCount: 4,
      columnCount: 2,
      numeric: [
        { name: 'id', count: 4, sum: 10, mean: 2.5, median: 2.5, std: 1, var: 1, min: 1, max: 4 },
        { name: 'value', count: 4, sum: 100, mean: 25, median: 25, std: 11, var: 125, min: 10, max: 40 },
      ],
      correlation: [],
      categorical: [],
      temporal: [],
    }),
    executeOperation: () => null,
    parseDatasetBytes: () => null,
    inferTopology: () => 'TABULAR',
    inferEncodings: () => ({}),
    initRuntime: () => Promise.resolve({}),
    computeMapperGraph: () => null,
    computePersistenceIntervals: () => [],
    computeBetti0Curve: () => [],
    _lastOp: () => lastOp,
  };
}

describe('DataOperationController', () => {
  let controller;
  let eventBus;
  let artifact;
  let dataset;
  let mockBridge;
  let atlas;

  beforeEach(() => {
    eventBus = new WorldEventBus();
    artifact = makeArtifact();
    dataset = makeDataset();
    mockBridge = makeMockBridge();
    // Wave 4: the controller issues typed AnalysisSpec commands to AtlasCore,
    // which calls the kernel + records the provenance ledger. Wrap the mock
    // kernel in a real AtlasCore so the controller mechanics (history, events,
    // undo/redo, preview) are exercised end-to-end.
    atlas = new AtlasCore({ kernel: mockBridge, eventBus });
    controller = new DataOperationController({
      eventBus,
      getArtifact: () => artifact,
      atlas,
    });
    controller.setOriginalDataset(dataset);
  });

  it('stores the original dataset and clones it as transformed', () => {
    expect(controller.originalDataset.rowCount).toBe(4);
    expect(controller.transformedDataset.rowCount).toBe(4);
    expect(controller.transformedDataset).not.toBe(controller.originalDataset);
  });

  it('applies a filter operation', () => {
    controller.apply('filter');

    expect(controller.transformedDataset.rowCount).toBeLessThan(4);
    expect(controller.analysisHistory.length).toBe(1);
    expect(controller.analysisHistory.current().operation).toBe('filter');
  });

  it('emits operation:applied events', () => {
    const spy = vi.fn();
    eventBus.on(WorldTopics.OPERATION_APPLIED, spy);

    controller.apply('sort');

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].operation).toBe('sort');
    expect(spy.mock.calls[0][0].rowCount).toBe(controller.transformedDataset.rowCount);
  });

  it('emits operation:preview events', () => {
    const spy = vi.fn();
    eventBus.on(WorldTopics.OPERATION_PREVIEW, spy);

    controller.preview('filter');

    expect(spy).toHaveBeenCalledOnce();
    const payload = spy.mock.calls[0][0];
    expect(payload.operation).toBe('filter');
    expect(payload.previewDataset).toBeTruthy();
    expect(payload.artifact).toBe(artifact);
  });

  it('emits operation:clear-preview events', () => {
    const spy = vi.fn();
    eventBus.on(WorldTopics.OPERATION_CLEAR_PREVIEW, spy);

    controller.clearPreview();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('resets to the original dataset', () => {
    controller.apply('filter');
    const filteredRows = controller.transformedDataset.rowCount;
    expect(filteredRows).toBeLessThan(4);

    controller.reset();

    expect(controller.transformedDataset.rowCount).toBe(4);
    expect(controller.analysisHistory.current().operation).toBe('reset');
  });

  it('supports undo and redo', () => {
    controller.apply('filter');
    controller.apply('sort');
    expect(controller.analysisHistory.length).toBe(2);

    const undoFrame = controller.undo();
    expect(undoFrame).toBeTruthy();
    expect(undoFrame.operation).toBe('sort');

    const redoFrame = controller.redo();
    expect(redoFrame).toBeTruthy();
    expect(redoFrame.operation).toBe('sort');
  });

  it('emits history:seek on undo/redo', () => {
    const spy = vi.fn();
    eventBus.on(WorldTopics.HISTORY_SEEK, spy);

    controller.apply('filter');
    controller.undo();

    expect(spy).toHaveBeenCalled();
    const last = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(last.operation).toBe('filter');
  });

  it('supports direct history seek', () => {
    controller.apply('filter');
    controller.apply('sort');

    const frame = controller.seekHistory(0);
    expect(frame.operation).toBe('filter');
    expect(controller.analysisHistory.currentIndex).toBe(0);
  });

  it('applies visual transforms without mutating history on applyVisual', () => {
    controller.applyVisual('filter', controller.transformedDataset);

    expect(controller.analysisHistory.length).toBe(0);
  });

  it('returns null for undo/redo when history is empty', () => {
    expect(controller.undo()).toBeNull();
    expect(controller.redo()).toBeNull();
  });

  it('is a no-op when no artifact is present', () => {
    const emptyController = new DataOperationController({ eventBus, getArtifact: () => null });
    emptyController.setOriginalDataset(dataset);

    expect(() => emptyController.apply('filter')).not.toThrow();
    expect(emptyController.analysisHistory.length).toBe(0);
  });

  it('isolates original and transformed datasets', () => {
    const original = controller.originalDataset;
    controller.apply('filter');

    expect(controller.originalDataset.rowCount).toBe(original.rowCount);
    expect(controller.transformedDataset.rowCount).toBeLessThan(original.rowCount);
  });

  it('aborts cleanly when the kernel is unavailable (no JS fallback)', () => {
    // Wave 4: swap in an AtlasCore with no kernel bound but the original
    // dataset loaded, so apply() reaches the kernel path and aborts cleanly.
    const noKernelAtlas = new AtlasCore({ kernel: null, eventBus });
    noKernelAtlas.setOriginalDataset(dataset);
    controller.setAtlas(noKernelAtlas);
    const before = controller.transformedDataset.rowCount;
    const historyBefore = controller.analysisHistory.length;

    expect(() => controller.apply('filter')).not.toThrow();
    // No history pushed, dataset unchanged — the op was aborted, not fallen back.
    expect(controller.analysisHistory.length).toBe(historyBefore);
    expect(controller.transformedDataset.rowCount).toBe(before);
  });
});
