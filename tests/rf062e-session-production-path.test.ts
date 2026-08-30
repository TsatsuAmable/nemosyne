// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/vr/World.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function dataset(name: string, values: number[]): Dataset {
  return new Dataset(
    name,
    [
      { name: 'category', type: 'CATEGORICAL' },
      { name: 'value', type: 'NUMERIC' },
    ],
    values.map((value, index) => ({ category: index % 2 === 0 ? 'A' : 'B', value }))
  );
}

describe('RF-062E World session production path', () => {
  let world: World | null = null;

  afterEach(async () => {
    if (world) await world.dispose();
    world = null;
    vi.restoreAllMocks();
  });

  it('restores through the application load path and presentation adapter without changing authority state', async () => {
    world = new World();
    const bridge = makeKernelMockBridge();
    world.atlas.setKernel(bridge, 0x3c07);

    const baseline = dataset('rf062e-baseline', [1, 2, 3, 4]);
    world.loadDataset({
      key: 'rf062e-baseline',
      name: baseline.name,
      topology: 'TABULAR',
      dataset: baseline,
    });
    world.applyDataOperation('filter');
    world.engine.cameraGroup.position.set(3, 2, -7);
    world._captureSession();

    const snapshot = world.sessionController.snapshotCurrentSession();
    expect(snapshot).not.toBeNull();
    const beforeFingerprint = world.atlas.datasetFingerprint;
    const beforeResults = JSON.stringify(world.atlas.results);
    const beforeLedger = JSON.stringify(world.atlas.evidenceLedger.ledger);
    const beforeDigest = world.session.semanticDigest();

    const loadSpy = vi.spyOn(world.loadDatasetUseCase, 'execute');
    const presentationSpy = vi.spyOn(world.presentationSnapshotPort, 'restore');
    const historyEvents: unknown[] = [];
    world.eventBus.on('history:seek', (event) => historyEvents.push(event));

    const replacement = dataset('rf062e-replacement', [100, 200]);
    world.loadDataset({
      key: 'rf062e-replacement',
      name: replacement.name,
      topology: 'TABULAR',
      dataset: replacement,
    });
    world.engine.cameraGroup.position.set(9, 9, 9);

    const store = world.sessionController.getSessionStore();
    await store.saveSession('rf062e-snapshot', snapshot!);
    const loaded = await world.sessionController.loadSession('rf062e-snapshot');

    expect(loaded).toBe(true);
    expect(loadSpy).toHaveBeenCalled();
    expect(presentationSpy).toHaveBeenCalled();
    expect(historyEvents.length).toBeGreaterThan(0);
    expect(world.atlas.datasetFingerprint).toBe(beforeFingerprint);
    expect(JSON.stringify(world.atlas.results)).toBe(beforeResults);
    expect(JSON.stringify(world.atlas.evidenceLedger.ledger)).toBe(beforeLedger);
    expect(world.session.semanticDigest()).toBe(beforeDigest);
    expect(world.engine.cameraGroup.position.toArray()).toEqual([3, 2, -7]);
  });
});