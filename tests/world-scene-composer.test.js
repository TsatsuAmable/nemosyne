import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { WorldSceneComposer } from '../src/vr/coordinators/WorldSceneComposer.js';
import { Engine } from '../src/vr/Engine.js';
import { DatumPlane } from '../src/vr/artifacts/DatumPlane.js';
import { TechnoCoreNode } from '../src/vr/artifacts/TechnoCoreNode.js';
import { FarcasterPortal } from '../src/vr/artifacts/FarcasterPortal.js';
import { HolographicInspector } from '../src/vr/artifacts/HolographicInspector.js';

describe('WorldSceneComposer', () => {
  let engine;
  let onWarp;
  let composer;

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

    engine = new Engine();
    onWarp = vi.fn();
    composer = new WorldSceneComposer(engine, { onWarp });
  });

  afterEach(() => {
    engine.dispose();
    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  });

  it('creates the analyst anchor under the camera group', () => {
    expect(composer.analystAnchor).toBeInstanceOf(THREE.Group);
    expect(composer.analystAnchor.parent).toBe(engine.cameraGroup);
    expect(composer.analystAnchor.name).toBe('analystAnchor');
  });

  it('creates a datum plane and adds it to the scene', () => {
    expect(composer.datum).toBeInstanceOf(DatumPlane);
    expect(engine.scene.children).toContain(composer.datum.mesh);
    expect(engine.updatables).toContain(composer.datum);
  });

  it('creates a TechnoCore node and adds it to the scene', () => {
    expect(composer.core).toBeInstanceOf(TechnoCoreNode);
    expect(engine.scene.children).toContain(composer.core.group);
    expect(engine.updatables).toContain(composer.core);
  });

  it('creates a holographic inspector and mounts it', () => {
    expect(composer.inspector).toBeInstanceOf(HolographicInspector);
    expect(engine.updatables).toContain(composer.inspector);
  });

  it('creates two Farcaster portals and adds them to the scene', () => {
    expect(composer.portalA).toBeInstanceOf(FarcasterPortal);
    expect(composer.portalB).toBeInstanceOf(FarcasterPortal);
    expect(engine.scene.children).toContain(composer.portalA.group);
    expect(engine.scene.children).toContain(composer.portalB.group);
    expect(engine.updatables).toContain(composer.portalA);
    expect(engine.updatables).toContain(composer.portalB);
  });

  it('wires the onWarp callback to both portals', () => {
    composer.portalA.onWarp('DEEP_NET', [0, 0, -20], 'anomaly');
    expect(onWarp).toHaveBeenCalledWith('DEEP_NET', [0, 0, -20], 'anomaly');

    composer.portalB.onWarp('LOCAL_MATRIX', [0, 0, 0], 'reset');
    expect(onWarp).toHaveBeenCalledWith('LOCAL_MATRIX', [0, 0, 0], 'reset');
  });

  it('assigns the expected portal operations', () => {
    expect(composer.portalA.operation).toBe('anomaly');
    expect(composer.portalB.operation).toBe('reset');
  });

  it('creates portals with distinct target zones', () => {
    expect(composer.portalA.targetZone).toBe('DEEP_NET');
    expect(composer.portalB.targetZone).toBe('LOCAL_MATRIX');
  });
});
