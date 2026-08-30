// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '../src/vr/World.ts';
import { getSampleDataset } from '../src/data/SampleDatasets.ts';
import type { SessionStore } from '../src/data/SessionStore.ts';
import { WorldTopics } from '../src/utils/EventBus.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

// This jsdom lane deliberately has no ambient WASM initialization. Keep the
// production representation path intact while supplying its governed layout
// ABI at the test boundary.
vi.mock('../src/wasm/RuntimeBridge.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/wasm/RuntimeBridge.ts')>();
  return {
    ...actual,
    computeGrid3d: (count: number, spacing = 1.1, yOffset = 1.2) => {
      const side = Math.ceil(Math.sqrt(count));
      const positions = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) {
        positions[index * 3] = (index % side) * spacing;
        positions[index * 3 + 1] = yOffset;
        positions[index * 3 + 2] = Math.floor(index / side) * spacing;
      }
      return positions;
    },
  };
});

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
    const sample = getSampleDataset('sales-table');
    if (!sample) throw new Error('sales-table sample is required');
    world.loadDataset({
      name: sample.label,
      topology: sample.topology,
      dataset: sample.dataset,
      maxDepth: sample.depth,
    });
    world.applyDataOperation('filter');

    const store = new MemorySessionStore();
    world.sessionStore = store as unknown as SessionStore;
    await world.saveSession('rf062e');
    const before = world.session.serialize();
    const digestBefore = await world.atlas.computeDigest();
    const executeDatasetLoad = vi.spyOn(world.loadDatasetUseCase, 'execute');
    const restorePresentation = vi.spyOn(world.presentationSnapshotPort, 'restore');
    const historySeek = vi.fn();
    world.eventBus.on(WorldTopics.HISTORY_SEEK, historySeek);

    await expect(world.loadSession('rf062e')).resolves.toBe(true);

    expect(executeDatasetLoad).toHaveBeenCalledTimes(2);
    expect(executeDatasetLoad.mock.calls[0][1]).toMatchObject({
      preserveAnalyticalState: false,
    });
    expect(executeDatasetLoad.mock.calls[1][1]).toMatchObject({
      preserveAnalyticalState: true,
      authoritativeRepresentation: { decision: before.representationDecision },
    });
    expect(restorePresentation).toHaveBeenCalledOnce();
    expect(historySeek).toHaveBeenCalledOnce();
    expect(world.atlas.datasetFingerprint).toBe(before.datasetFingerprint);
    expect(world.atlas.ledger).toEqual(before.eventLedger);
    expect(world.atlas.results).toEqual(before.analysisResults);
    expect(await world.atlas.computeDigest()).toBe(digestBefore);
  });
});