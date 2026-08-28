// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { WorldSceneComposer } from '../src/vr/coordinators/WorldSceneComposer.ts';
import { Engine } from '../src/vr/Engine.ts';
import { DatumPlane } from '../src/vr/artifacts/DatumPlane.ts';
import { TechnoCoreNode } from '../src/vr/artifacts/TechnoCoreNode.ts';
import { FarcasterPortal } from '../src/vr/artifacts/FarcasterPortal.ts';
import { HolographicInspector } from '../src/vr/artifacts/HolographicInspector.ts';

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
    // Production-path evidence (P1-U3): the inspector is a SpatialPanel whose
    // interactive tabs/pin/close/footer must be reachable by the live pointer
    // path. PointerEventMachine iterates `registry.panels`, so the inspector
    // MUST be registered with the input router — otherwise every interactive
    // control added in P1-U3 is inert in production.
    expect(engine.input.panels).toContain(composer.inspector);
  });

  it('creates two Farcaster portals and adds them to the scene', () => {
    expect(composer.portalA).toBeInstanceOf(FarcasterPortal);
    expect(composer.portalB).toBeInstanceOf(FarcasterPortal);
    expect(engine.scene.children).toContain(composer.portalA.group);
    expect(engine.scene.children).toContain(composer.portalB.group);
    expect(engine.updatables).toContain(composer.portalA);
    expect(engine.updatables).toContain(composer.portalB);
  });

  it('wires the onSemanticWarp callback to both portals', () => {
    const onSemanticWarp = vi.fn();
    const semanticComposer = new WorldSceneComposer(engine, { onSemanticWarp });

    semanticComposer.portalA.initiateFarcasterTravel();
    expect(onSemanticWarp).toHaveBeenCalledWith({ kind: 'overview' });

    semanticComposer.portalB.initiateFarcasterTravel();
    expect(onSemanticWarp).toHaveBeenCalledWith({
      kind: 'saved-investigation',
      archiveId: 'latest',
    });
  });

  it('assigns the expected portal semantic targets', () => {
    expect(composer.portalA.semanticTarget).toEqual({ kind: 'overview' });
    expect(composer.portalB.semanticTarget).toEqual({ kind: 'saved-investigation', archiveId: 'latest' });
  });

  it('creates portals with distinct target zones', () => {
    expect(composer.portalA.targetZone).toBe('DEEP_NET');
    expect(composer.portalB.targetZone).toBe('LOCAL_MATRIX');
  });
});
