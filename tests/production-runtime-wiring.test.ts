// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Engine } from '../src/vr/Engine.ts';
import { CollaborativeStateSync } from '../src/network/CollaborativeStateSync.ts';

describe('Sprint 18.1 - 18.4: Production Runtime Integration & Worker Hardening Suite', () => {
  it('wires SceneGraphController and WorkspaceManager onto World instance', async () => {
    // Dynamically import World to ensure full constructor execution
    const { World } = await import('../src/vr/World.ts');
    const world = new World();

    expect(world.sceneGraphController).toBeDefined();
    expect(world.workspaceManager).toBeDefined();
    expect(world.datasetSpace).toBeDefined();
    expect(world.datasetSpace?.datumIds.length).toBeGreaterThan(0);
    expect(world.dracoNode.representationDecision).toBeNull();
    expect(world.sceneGraphController.scene).toBeInstanceOf(THREE.Scene);

    const disposeSpy = vi.spyOn(world.sceneGraphController, 'dispose');
    await world.dispose();
    expect(disposeSpy).toHaveBeenCalledOnce();
  });

  it('measures frame timing via AdaptiveFrameGovernor in Engine tick', () => {
    const engine = new Engine();
    expect(engine.frameGovernor).toBeDefined();

    engine._tick();
    const metrics = engine.frameGovernor.getMetrics();
    expect(metrics.averageFrameTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('sends binary pose streams via CollaborativeStateSync', () => {
    const sync = new CollaborativeStateSync('peer-local');
    const mockChannel = {
      readyState: 'open',
      binaryType: '',
      send: (data: unknown) => {
        expect(data).toBeInstanceOf(ArrayBuffer);
        expect((data as ArrayBuffer).byteLength).toBe(40); // Sprint 19.1: extended to 40 bytes (peerId + sequence + 7 floats)
      },
    } as unknown as RTCDataChannel;

    sync.setDataChannel(mockChannel);
    sync.sendBinaryPose([1, 2, 3], [0, 0, 0, 1]);
  });
});
