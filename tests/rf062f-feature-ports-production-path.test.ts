// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { World } from '../src/vr/World.ts';
import { getSampleDataset } from '../src/data/SampleDatasets.ts';
import { NetworkManager } from '../src/network/NetworkManager.ts';

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

describe('RF-062F production feature ports', () => {
  let world: World | null = null;

  afterEach(async () => {
    vi.useRealTimers();
    if (world) {
      await world.dispose();
      world.loader?.container?.remove?.();
      world = null;
    }
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) canvas.remove();
    document.querySelector('#nemosyne-desktop-companion')?.remove();
    vi.restoreAllMocks();
  });

  it('traverses the installed live dataset sink for a transport flush', async () => {
    world = new World();
    const sample = getSampleDataset('sales-table');
    if (!sample) throw new Error('sales-table sample is required');
    const loadDataset = vi.spyOn(world, 'loadDataset').mockImplementation(async () => {});
    world.liveStreamCoordinator.liveConnector = {
      topology: 'TIME_SERIES',
      windowSize: 50,
      isConnected: () => true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      onUpdate: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
    };

    vi.useFakeTimers();
    world.liveStreamCoordinator._onLiveUpdate({
      dataset: sample.dataset,
      mode: 'replace',
      topology: 'TIME_SERIES',
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(loadDataset).toHaveBeenCalledOnce();
    expect(loadDataset.mock.calls[0][0]).toMatchObject({
      name: 'Live Stream',
      topology: 'TIME_SERIES',
    });
    expect('world' in world.liveStreamCoordinator).toBe(false);
  });

  it('projects an explicit live disconnect through the installed status sink', () => {
    world = new World();
    const disconnect = vi.fn();
    const setLiveConnected = vi.spyOn(world.uiManager.vrMenu, 'setLiveConnected');
    world.liveStreamCoordinator.liveConnector = {
      topology: 'TIME_SERIES',
      windowSize: 50,
      isConnected: () => true,
      connect: vi.fn(),
      disconnect,
      onUpdate: vi.fn(() => () => {}),
      onStatus: vi.fn(() => () => {}),
    };

    world.disconnectLiveStream();

    expect(disconnect).toHaveBeenCalledOnce();
    expect(setLiveConnected).toHaveBeenCalledWith(false);
    expect(world.liveStreamCoordinator.liveConnector).toBeNull();
  });

  it('wires collaboration through presence/presentation ports without rebuilding the wheel', async () => {
    world = new World();
    vi.spyOn(NetworkManager.prototype, 'connect').mockResolvedValue(undefined);
    const setStatus = vi.spyOn(world.uiManager.networkPanel, 'setStatus');
    const rebuildWheel = vi.spyOn(world, '_buildWheelMenu');

    await world.collaborationCoordinator.joinCollaborationRoom('rf062f-room');
    const networkManager = world.collaborationCoordinator
      .networkManager as unknown as NetworkManager;
    networkManager.dispatchEvent(
      new CustomEvent('connected', { detail: { roomId: 'rf062f-room' } })
    );

    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ connected: true, roomId: 'rf062f-room' })
    );
    expect(rebuildWheel).not.toHaveBeenCalled();
    expect('world' in world.collaborationCoordinator).toBe(false);
  });

  it('routes landmark operations through the canonical application intent boundary', () => {
    world = new World();
    const dispatchIntent = vi.fn();
    world.dispatchIntent = dispatchIntent;
    const toggleVault = vi.spyOn(world, '_toggleVaultPanel');

    world.landmarkController.applyPortalOperation('anomaly');
    world.landmarkController.applyPortalOperation('reset');
    world.landmarkController.onVaultSelect();

    expect(dispatchIntent).toHaveBeenNthCalledWith(1, {
      type: 'analysis.apply',
      operation: 'anomaly',
    });
    expect(dispatchIntent).toHaveBeenNthCalledWith(2, { type: 'analysis.reset' });
    expect(toggleVault).toHaveBeenCalledOnce();
    expect('world' in world.landmarkController).toBe(false);
  });
});
