import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Engine } from '../src/vr/Engine.ts';
import { CollaborativeStateSync } from '../src/network/CollaborativeStateSync.ts';
import { CSVParserWorker } from '../src/data/CSVParserWorker.ts';

describe('Sprint 18.1 - 18.4: Production Runtime Integration & Worker Hardening Suite', () => {
  it('wires SceneGraphController and WorkspaceManager onto World instance', async () => {
    // Dynamically import World to ensure full constructor execution
    const { World } = await import('../src/vr/World.ts');
    const world = new World();

    expect(world.sceneGraphController).toBeDefined();
    expect(world.workspaceManager).toBeDefined();
    expect(world.sceneGraphController.scene).toBeInstanceOf(THREE.Scene);
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
        expect((data as ArrayBuffer).byteLength).toBe(32);
      },
    } as unknown as RTCDataChannel;

    sync.setDataChannel(mockChannel);
    sync.sendBinaryPose([1, 2, 3], [0, 0, 0, 1]);
  });

  it('executes CSVParserWorker asynchronously', async () => {
    const res = await CSVParserWorker.parseAsync({
      datasetName: 'TestAsync',
      csvText: 'col1,col2\n10,20\n30,40',
    });

    expect(res.datasetName).toBe('TestAsync');
    expect(res.rows.length).toBe(2);
  });
});
