// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { DataOperationController } from '../src/vr/coordinators/DataOperationController.ts';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function artifact() {
  const group = new THREE.Group();
  const nodeMeshes = [10, 20, 30].map((value, index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    mesh.userData.row = { id: index + 1, value };
    group.add(mesh);
    return mesh;
  });
  return { group, nodeMeshes };
}

describe('RF-035B0 controller materialization', () => {
  it('uses the Dataset already committed by Atlas instead of deserializing the same worker result twice', async () => {
    const eventBus = new WorldEventBus();
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge(), eventBus });
    const output = {
      name: 'Sorted',
      columns: [
        { name: 'id', type: ColumnType.NUMERIC },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      rows: [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 },
      ],
    };

    const asyncPort = {
      isAsync: true,
      supersede: vi.fn(),
      registerDataset: vi.fn(async () => {}),
      execute: vi.fn(async (request) => ({
        requestId: request.requestId,
        generation: request.generation,
        datasetVersion: request.dataset.version,
        datasetFingerprint: request.dataset.fingerprint,
        value: {
          dataset: output,
          outputFingerprint: 'rf035b-output',
        },
        provenance: null,
      })),
    };
    atlas.setExecutionPort(asyncPort);

    const controller = new DataOperationController({
      eventBus,
      getArtifact: artifact,
      atlas,
    });
    controller.setOriginalDataset(new Dataset(
      'Input',
      [
        { name: 'id', type: ColumnType.NUMERIC },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 },
      ],
    ));

    const applied = vi.fn();
    eventBus.on(WorldTopics.OPERATION_APPLIED, applied);
    const fromJson = vi.spyOn(Dataset, 'fromJSON');

    // Use a sort command here rather than filter. Filter builds its threshold
    // from kernel statistics, and the canned test kernel legitimately parses
    // its stored JSON to compute that median. That unrelated test-double parse
    // must not be counted as coordinator result rematerialization.
    await controller.applyAsync('sort');

    expect(fromJson).toHaveBeenCalledTimes(1);
    expect(controller.transformedDataset).toBe(atlas.dataset);
    expect(controller.transformedDataset.rows).toEqual(output.rows);
    expect(applied).toHaveBeenCalledOnce();
    expect(applied.mock.calls[0][0].datasetAfter).toBe(atlas.dataset);
    expect(applied.mock.calls[0][0].rowCount).toBe(3);

    fromJson.mockRestore();
  });
});
