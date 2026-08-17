// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/vr/World.ts';
import { getSampleDataset } from '../src/data/SampleDatasets.ts';
import { TopologyTypes } from '../src/draco/ConstraintEngine.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.js';

// Wave 2: the analytical kernel is mandatory in production. Integration tests
// wire a mock kernel (canned, JS-backed) so orchestration stays testable in
// plain jsdom; analytical parity is covered by Rust tests + wasm-runtime.test.ts.
function wireKernel(w) {
  const bridge = makeKernelMockBridge();
  w.dataOperationController?.setWasmRuntime?.(bridge, 0x3c07);
  w.loader?.setWasmRuntime?.(bridge, 0x3c07);
  w._wasmRuntime = bridge;
  w._wasmUnavailable = false;
}

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = CONNECTING;
    this.listeners = {};
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }

  dispatch(type, event = {}) {
    (this.listeners[type] || []).forEach((fn) => fn(event));
  }

  dispatchMessage(data) {
    this.dispatch('message', { data });
  }

  open() {
    this.readyState = OPEN;
    this.dispatch('open', {});
  }

  close() {
    this.readyState = CLOSED;
    this.dispatch('close', {});
  }
}

describe('World coverage extensions', () => {
  let world;
  const resizeListeners = [];
  let addListenerSpy;

  beforeEach(() => {
    globalThis.navigator.xr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        renderState: {},
        inputSources: [],
      }),
    };

    const originalAdd = window.addEventListener;
    addListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'resize') resizeListeners.push(listener);
        return originalAdd.call(window, type, listener, options);
      });
  });

  afterEach(async () => {
    addListenerSpy?.mockRestore();
    if (world) {
      await world.dispose();
      if (world.loader?.container?.parentNode) {
        world.loader.container.parentNode.removeChild(world.loader.container);
      }
      world = null;
    }

    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);

    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    for (const listener of resizeListeners.splice(0)) {
      window.removeEventListener('resize', listener);
    }

    vi.restoreAllMocks();
  });

  it('toggles portal visibility and syncs the VR menu button', () => {
    world = new World(); wireKernel(world);
    expect(world.portalsEnabled).toBe(true);
    expect(world.portalA.group.visible).toBe(true);

    world.setPortalsEnabled(false);
    expect(world.portalsEnabled).toBe(false);
    expect(world.portalA.group.visible).toBe(false);
    expect(world.portalB.group.visible).toBe(false);
    expect(world.vrMenu.portalsEnabled).toBe(false);

    world.setPortalsEnabled(true);
    expect(world.portalA.group.visible).toBe(true);
    expect(world.vrMenu.portalsEnabled).toBe(true);
  });

  it('warps the camera and changes theme colors', () => {
    world = new World(); wireKernel(world);
    const startY = world.engine.cameraGroup.position.y;

    world._warpToZone('DEEP_NET', [0, 0, -20]);
    expect(world.engine.cameraGroup.position.z).toBe(-20);

    world._warpToZone('LOCAL_MATRIX', [0, startY, 0]);
    expect(world.engine.cameraGroup.position.z).toBe(0);
  });

  it('shows a holographic inspector at the selected mesh position', () => {
    world = new World(); wireKernel(world);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.position.set(2, 1.4, -4);
    mesh.userData.row = { id: 'X', value: 99 };

    world._showDataCard(mesh);
    expect(world.inspector.active).toBe(true);
    expect(world.inspector.mesh.position.x).toBe(2);
    expect(world.inspector.mesh.position.z).toBe(-4);
  });

  it('cycles through all sample datasets and wraps around', () => {
    world = new World(); wireKernel(world);
    const names = [];
    for (let i = 0; i < 12; i++) {
      world._cycleDataset();
      names.push(world.currentEntry?.label ?? world.currentEntry?.name);
    }
    // Should have produced at least two distinct dataset names.
    expect(new Set(names).size).toBeGreaterThan(1);
    // The 12th cycle should not error even after wrapping.
    expect(world.dracoNode).toBeTruthy();
  });

  it('applies filter, sort, aggregate, cluster, and time-slice operations', () => {
    world = new World(); wireKernel(world);
    const ds = getSampleDataset('supply-chain');
    world.loadDataset({
      name: ds.label,
      ...ds,
      maxDepth: ds.depth,
      encodings: { color: 'region', size: 'inventory' },
    });

    const baseRows = world._transformedDataset.rowCount;

    world.applyDataOperation('filter');
    expect(world._transformedDataset.rowCount).toBeLessThan(baseRows);

    world.applyDataOperation('sort');
    // The kernel sort does NOT rename the dataset (the legacy JS path appended
    // 'sorted'). Assert ascending ordering on the sort column instead.
    const sortCol = world._transformedDataset.numericColumns[0]?.name;
    expect(world._transformedDataset.rowCount).toBeGreaterThan(0);
    if (sortCol) {
      const sortedRows = world._transformedDataset.rows;
      const first = Number(sortedRows[0][sortCol]);
      const last = Number(sortedRows[sortedRows.length - 1][sortCol]);
      expect(first).toBeLessThanOrEqual(last);
    }

    world.applyDataOperation('aggregate');
    expect(world._transformedDataset.rowCount).toBeGreaterThan(0);

    world.applyDataOperation('cluster');
    expect(world._transformedDataset.getColumn('_cluster')).toBeTruthy();

    // timeSlice runs the kernel `slice` against the CURRENT transformed
    // dataset (Wave 2 mandatory-kernel semantics): a contiguous window of the
    // current view. The slice primitive is parity-covered by Rust tests +
    // wasm-runtime.test.ts; here we assert the window is non-empty.
    world.applyDataOperation('timeSlice');
    expect(world._transformedDataset.rowCount).toBeGreaterThan(0);
  });

  it('resets data operations back to the original dataset', () => {
    world = new World(); wireKernel(world);
    const ds = getSampleDataset('sales-table');
    world.loadDataset({ name: ds.label, topology: ds.topology, dataset: ds.dataset });

    const originalRowCount = world._originalDataset.rowCount;
    world.applyDataOperation('filter');
    expect(world._transformedDataset.rowCount).not.toBe(originalRowCount);

    world.resetDataOperation();
    expect(world._transformedDataset.rowCount).toBe(originalRowCount);
  });

  it('connects to a curated live source by key', () => {
    const originalWebSocket = globalThis.WebSocket;
    try {
      globalThis.WebSocket = MockWebSocket;
      world = new World(); wireKernel(world);

      const result = world.connectLiveSource('demo-stream');
      expect(result).toBe(true);
      expect(world.liveConnector).toBeTruthy();

      world.liveConnector._ws.open();
      expect(world.isLiveConnected()).toBe(true);

      world.disconnectLiveStream();
      expect(world.liveConnector).toBeNull();
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it('returns false for an unknown live source key', () => {
    world = new World(); wireKernel(world);
    expect(world.connectLiveSource('nonexistent')).toBe(false);
  });

  it('uses incremental append for streaming time-series when entry name matches', () => {
    const originalWebSocket = globalThis.WebSocket;
    vi.useFakeTimers();
    try {
      globalThis.WebSocket = MockWebSocket;
      world = new World(); wireKernel(world);
      const incremental = world.connectLiveStream('wss://test/stream', {
        mode: 'window',
        topology: TopologyTypes.TIME_SERIES,
      });
      expect(incremental).toBe(true);

      // Seed the live node by loading the same dataset name first.
      const ds = getSampleDataset('sensor-stream');
      world.loadDataset({
        name: 'Live Stream',
        topology: TopologyTypes.TIME_SERIES,
        dataset: ds.dataset,
        maxDepth: 1,
      });

      world.liveConnector._ws.open();
      const appendSpy = vi.spyOn(world.dracoNode, 'appendRows').mockReturnValue(true);

      world.liveConnector._ws.dispatchMessage(
        JSON.stringify({
          topology: 'TIME_SERIES',
          rows: [{ time: '2026-07-28T12:00:00Z', sensorId: 'alpha', temperature: 22.5 }],
        })
      );

      vi.advanceTimersByTime(1100);
      expect(appendSpy).toHaveBeenCalledOnce();
      appendSpy.mockRestore();
    } finally {
      globalThis.WebSocket = originalWebSocket;
      vi.useRealTimers();
    }
  });

  it('records analysis operations and supports undo/redo', () => {
    world = new World(); wireKernel(world);
    const ds = getSampleDataset('supply-chain');
    world.loadDataset({
      name: ds.label,
      ...ds,
      maxDepth: ds.depth,
      encodings: { color: 'region', size: 'inventory' },
    });

    const originalRowCount = world._originalDataset.rowCount;
    world.applyDataOperation('filter');
    const filteredRowCount = world._transformedDataset.rowCount;
    expect(filteredRowCount).toBeLessThan(originalRowCount);
    expect(world.analysisHistory.canUndo).toBe(true);

    world.undoAnalysis();
    expect(world._transformedDataset.rowCount).toBe(originalRowCount);

    world.redoAnalysis();
    expect(world._transformedDataset.rowCount).toBe(filteredRowCount);
  });

  it('maps hand gestures to analysis commands and perspective switches', () => {
    world = new World(); wireKernel(world);
    const ds = getSampleDataset('supply-chain');
    world.loadDataset({
      name: ds.label,
      ...ds,
      maxDepth: ds.depth,
      encodings: { color: 'region', size: 'inventory' },
    });

    const startRowCount = world._transformedDataset.rowCount;
    world._onGesture('pinchTogether');
    expect(world._transformedDataset.rowCount).toBeLessThan(startRowCount);

    const startName = world.currentEntry?.name;
    // The first swipe from the initial -1 index lands on the first sample again,
    // so cycle twice to guarantee a different dataset.
    world._onGesture('swipeRight');
    world._onGesture('swipeRight');
    expect(world.currentEntry?.name).not.toBe(startName);
  });

  it('toggles the statistical lens from a gesture', () => {
    world = new World(); wireKernel(world);
    const ds = getSampleDataset('sales-table');
    world.loadDataset({ name: ds.label, topology: ds.topology, dataset: ds.dataset });

    if (world.tdaGroup) {
      // TDA is hidden by default (progressive disclosure) until the lens is requested.
      expect(world.tdaGroup.visible).toBe(false);
      world._onGesture('scoopUp');
      expect(world.tdaGroup.visible).toBe(true);
      world._onGesture('scoopUp');
      expect(world.tdaGroup.visible).toBe(false);
    }
  });

  it('starts and completes the guided tour from the wheel menu', () => {
    world = new World(); wireKernel(world);
    expect(world.guidedTour).toBeTruthy();

    const result = world.startTour();
    expect(result).toBe(true);
    expect(world.guidedTour.isActive).toBe(true);

    world.guidedTour.skip();
    expect(world.guidedTour.isFinished).toBe(true);
  });

  it('triggers undo/redo from desktop keyboard shortcuts', () => {
    world = new World(); wireKernel(world);
    const ds = getSampleDataset('sales-table');
    world.loadDataset({ name: ds.label, topology: ds.topology, dataset: ds.dataset });

    const originalRowCount = world._originalDataset.rowCount;
    world.applyDataOperation('filter');
    const filteredRowCount = world._transformedDataset.rowCount;

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })
    );
    expect(world._transformedDataset.rowCount).toBe(originalRowCount);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true })
    );
    expect(world._transformedDataset.rowCount).toBe(filteredRowCount);
  });

  it('cancels a pending live flush on disconnect', () => {
    const originalWebSocket = globalThis.WebSocket;
    vi.useFakeTimers();
    try {
      globalThis.WebSocket = MockWebSocket;
      world = new World(); wireKernel(world);
      world.connectLiveStream('wss://test/stream', { mode: 'replace' });
      world.liveConnector._ws.open();
      world.liveConnector._ws.dispatchMessage(
        JSON.stringify({
          topology: 'TIME_SERIES',
          rows: [{ time: '2026-07-28T12:00:00Z', sensorId: 'alpha', temperature: 22.5 }],
        })
      );

      expect(world._liveFlushTimer).not.toBeNull();
      world.disconnectLiveStream();
      expect(world._liveFlushTimer).toBeNull();
      expect(world._pendingRows).toEqual([]);
    } finally {
      globalThis.WebSocket = originalWebSocket;
      vi.useRealTimers();
    }
  });
});
