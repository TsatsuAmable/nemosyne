import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Engine } from '../src/vr/Engine.ts';
import { CollaborativeStateSync } from '../src/network/CollaborativeStateSync.ts';
import { WorldTopics } from '../src/utils/EventBus.ts';
import * as runtimeBridge from '../src/wasm/RuntimeBridge.ts';

function requireValue<T>(value: T | null | undefined, label: string): T {
  expect(value, label).not.toBeNull();
  expect(value, label).not.toBeUndefined();
  if (value == null) throw new Error(`${label} was unavailable`);
  return value;
}

describe('Sprint 18.1 - 18.4: Production Runtime Integration & Worker Hardening Suite', () => {
  it('stages the initial dataset until World initializes an unavailable kernel', async () => {
    runtimeBridge.invalidateRuntime(new Error('fresh browser runtime'));
    const { World } = await import('../src/vr/World.ts');
    const world = new World();
    const initializeRuntime = vi.spyOn(world.analyticalRuntime, 'initialize');

    expect(world.bootState).toBe('INITIALIZING');
    expect(requireValue(world.currentEntry, 'initial dataset entry').key).toBe('supply-chain');
    expect(world.dracoNode).toBeNull();

    try {
      await world.start();
      expect(world.bootState).toBe('READY');
      expect(initializeRuntime).toHaveBeenCalledOnce();
      expect(world.analyticalRuntime.runtime).toBe(runtimeBridge);
      const authoritativeNode = requireValue(world.dracoNode, 'authoritative representation node');
      expect(authoritativeNode.representationDecision).not.toBeNull();
    } finally {
      await world.dispose();
      expect(world.analyticalRuntime.isDisposed).toBe(true);
    }
  });

  it('rebuilds the presentation-only palace with an authoritative decision after kernel readiness', async () => {
    const { World } = await import('../src/vr/World.ts');
    const world = new World();
    const presentationNode = requireValue(world.dracoNode, 'presentation representation node');
    const versionBefore = world.atlas.datasetVersion;
    const ledgerBefore = [...world.atlas.ledger];
    const historyBefore = world.atlas.analysisHistory.length;

    expect(world.atlas.isReady()).toBe(false);
    expect(presentationNode.representationDecision).toBeNull();

    try {
      await world.start();

      expect(world.bootState).toBe('READY');
      expect(world.atlas.isReady()).toBe(true);
      const authoritativeNode = requireValue(world.dracoNode, 'authoritative representation node');
      expect(authoritativeNode).not.toBe(presentationNode);
      const decision = requireValue(
        authoritativeNode.representationDecision,
        'authoritative representation decision'
      );
      expect(decision.datasetFingerprint).toBe(world.atlas.datasetFingerprint);
      expect(world.atlas.datasetVersion).toBe(versionBefore);
      expect(world.atlas.ledger[0]).toEqual(ledgerBefore[0]);
      expect(world.atlas.analysisHistory.length).toBe(historyBefore);

      const ledgerAfterStart = [...world.atlas.ledger];
      const liveRuntime = requireValue(world._wasmRuntime, 'live WASM runtime');
      const operationApplied = vi.fn();
      world.eventBus.on(WorldTopics.OPERATION_APPLIED, operationApplied);
      world.atlas.setKernel(
        {
          ...liveRuntime,
          isReady: () => true,
          runOperation: () => {
            throw new WebAssembly.RuntimeError('injected ABI trap');
          },
        },
        world._wasmCapabilities
      );

      world.applyDataOperation('sort');
      expect(world.bootState).toBe('KERNEL_UNAVAILABLE');
      expect(world.atlas.isReady()).toBe(false);
      expect(world._wasmCapabilities).toBe(0);
      expect(world._wasmUnavailable).toBe(true);
      expect(runtimeBridge.getKernelState()).toBe('UNAVAILABLE');
      expect(operationApplied).not.toHaveBeenCalled();

      await world.recoverKernel();
      expect(world.bootState).toBe('READY');
      expect(runtimeBridge.getKernelState()).toBe('READY');
      expect(world.atlas.isReady()).toBe(true);
      expect(world._wasmUnavailable).toBe(false);
      expect(requireValue(world.dracoNode, 'recovered representation node')).not.toBe(authoritativeNode);
      expect(world.atlas.datasetVersion).toBe(versionBefore);
      expect(world.atlas.ledger).toEqual(ledgerAfterStart);
      expect(world.atlas.analysisHistory.length).toBe(historyBefore);
    } finally {
      await world.dispose();
    }
  });

  it('retains the current presentation when authoritative recovery construction fails', async () => {
    const { World } = await import('../src/vr/World.ts');
    const world = new World();
    try {
      await world.start();
      const currentNode = requireValue(world.dracoNode, 'current representation node');
      const currentGroup = currentNode.group;
      vi.spyOn(world.atlas, 'arbitrateRepresentation').mockImplementationOnce(() => {
        throw new WebAssembly.RuntimeError('injected representation failure');
      });

      expect(() => world._rebuildPalaceWithKernelFacts()).toThrow(
        'injected representation failure'
      );
      expect(world.dracoNode).toBe(currentNode);
      expect(world.engine.scene.children).toContain(currentGroup);
    } finally {
      await world.dispose();
    }
  });

  it('wires SceneGraphController and WorkspaceManager onto World instance', async () => {
    // Dynamically import World to ensure full constructor execution
    const { World } = await import('../src/vr/World.ts');
    const world = new World();

    expect(world.sceneGraphController).toBeDefined();
    expect(world.workspaceManager).toBeDefined();
    expect(world.datasetSpace).toBeDefined();
    expect(world.datasetSpace?.datumIds.length).toBeGreaterThan(0);
    expect(requireValue(world.dracoNode, 'presentation representation node').representationDecision).toBeNull();
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
