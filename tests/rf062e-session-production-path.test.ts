// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '../src/vr/World.ts';
import { getSampleDataset } from '../src/data/SampleDatasets.ts';
import type { SessionStore } from '../src/data/SessionStore.ts';
import { WorldTopics } from '../src/utils/EventBus.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

class MemorySessionStore {
  private readonly snapshots = new Map<string, Record<string, unknown>>();

  async saveSession(id: string, snapshot: Record<string, unknown>): Promise<void> {
    this.snapshots.set(id, structuredClone(snapshot));
  }

  async loadSession(id: string): Promise<Record<string, unknown> | null> {
    const snapshot = this.snapshots.get(id);
    return snapshot ? structuredClone(snapshot) : null;
  }

  async deleteSession(id: string): Promise<void> {
    this.snapshots.delete(id);
  }

  async hasSession(id: string): Promise<boolean> {
    return this.snapshots.has(id);
  }
}

describe('RF-062E production session path', () => {
  let world: World | null = null;

  afterEach(async () => {
    if (world) {
      await world.dispose();
      world.loader?.container?.remove?.();
      world = null;
    }
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) canvas.remove();
    vi.restoreAllMocks();
  });

  it('reloads through LoadDatasetUseCase and projects restore through HISTORY_SEEK', async () => {
    world = new World();
    const bridge = makeKernelMockBridge();
    world.atlas.setKernel(bridge, 0x3c07);
    world._wasmRuntime = bridge;
    world._wasmUnavailable = false;
    const sample = getSampleDataset('sales-table');
    world.loadDataset({
      name: sample.label,
      topology: sample.topology,
      dataset: sample.dataset,
      maxDepth: sample.depth,
      encodings: sample.encodings,
    });
    world.applyDataOperation('filter');

    const store = new MemorySessionStore();
    world.sessionStore = store as unknown as SessionStore;
    await world.saveSession('rf062e');
    const before = world.session.serialize();
    const digestBefore = await world.atlas.computeDigest();
    const loadDataset = vi.spyOn(world.loadDatasetUseCase, 'execute');
    const restorePresentation = vi.spyOn(world.presentationSnapshotPort, 'restore');
    const historySeek = vi.fn();
    world.eventBus.on(WorldTopics.HISTORY_SEEK, historySeek);

    await expect(world.loadSession('rf062e')).resolves.toBe(true);

    expect(loadDataset).toHaveBeenCalledOnce();
    expect(restorePresentation).toHaveBeenCalledOnce();
    expect(historySeek).toHaveBeenCalledOnce();
    expect(world.atlas.datasetFingerprint).toBe(before.datasetFingerprint);
    expect(world.atlas.ledger).toEqual(before.eventLedger);
    expect(world.atlas.results).toEqual(before.analysisResults);
    expect(await world.atlas.computeDigest()).toBe(digestBefore);
  });
});
