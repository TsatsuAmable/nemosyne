import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { DataOperationController } from '../src/vr/coordinators/DataOperationController.js';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.js';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { ConstraintEngine, TopologyTypes } from '../src/draco/ConstraintEngine.js';
import { VRTopologyTranslator } from '../src/draco/VRTopologyTranslator.js';
import { captureBaseState } from '../src/vr/interactions/DataOperations.js';

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

describe('DataOperationController', () => {
  let controller;
  let eventBus;
  let artifact;
  let dataset;

  beforeEach(() => {
    eventBus = new WorldEventBus();
    artifact = makeArtifact();
    dataset = makeDataset();
    controller = new DataOperationController({
      eventBus,
      getArtifact: () => artifact,
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
});
