/**
 * RF-025: P1-F production wiring regression tests.
 *
 * These tests prove the SemanticTargetResolver + FocusContextController are no
 * longer isolated: they sit on the real InputRouter picking path, live
 * InteractableRegistry entries carry durable semantic metadata, structure
 * selection advances the Memory Palace focus/context, and the focus snapshot
 * persists through the NemosyneSession presentation state.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { InputRouter } from '../src/vr/InputRouter.ts';
import {
  InteractableRegistry,
} from '../src/vr/input/InteractableRegistry.ts';
import { SemanticTargetResolver } from '../src/vr/input/SemanticTargetResolver.ts';
import { FocusContextController } from '../src/vr/interactions/FocusContextController.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function makeBox(x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial()
  );
  mesh.position.set(x, y, z);
  mesh.updateMatrixWorld();
  return mesh;
}

/** Minimal engine facade with a controller that emits a fixed forward ray. */
class MockEngine {
  renderer: any;
  session: any = null;
  camera?: THREE.Camera;

  constructor() {
    this.renderer = { xr: { getSession: () => this.session } };
  }
}

class MockController {
  handedness: string;
  rayLength = 4;
  rayVisible = false;

  constructor(handedness: string) {
    this.handedness = handedness;
  }

  getRay(ray: THREE.Ray): THREE.Ray {
    ray.origin.set(0, 0, 0);
    ray.direction.set(0, 0, -1);
    return ray;
  }

  setRayLength(length: number) {
    this.rayLength = length;
  }

  setRayVisible(visible: boolean) {
    this.rayVisible = visible;
  }
}

describe('RF-025: P1-F production wiring', () => {
  describe('InteractableRegistry.raycastSceneAll', () => {
    it('returns every hit sorted ascending and deduped by entry', () => {
      const registry = new InteractableRegistry();
      const near = makeBox(0, 0, -1);
      const far = makeBox(0, 0, -2);
      registry.addInteractable(near, { semantic: { kind: 'observation' } });
      registry.addInteractable(far, { semantic: { kind: 'observation' } });

      registry.raycaster.ray.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
      const hits = registry.raycastSceneAll();

      expect(hits.length).toBe(2);
      expect(hits[0].distance).toBeLessThanOrEqual(hits[1].distance);
      expect(hits[0].entry.mesh).toBe(near);
      expect(hits[1].entry.mesh).toBe(far);
    });

    it('raycastScene still returns only the nearest hit (legacy contract)', () => {
      const registry = new InteractableRegistry();
      const near = makeBox(0, 0, -1);
      const far = makeBox(0, 0, -2);
      registry.addInteractable(near, { semantic: { kind: 'observation' } });
      registry.addInteractable(far, { semantic: { kind: 'observation' } });

      registry.raycaster.ray.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
      const hit = registry.raycastScene();
      expect(hit?.entry.mesh).toBe(near);
    });
  });

  describe('InputRouter semantic targeting on the real picking path', () => {
    let router: InputRouter;
    let controller: MockController;
    let resolver: SemanticTargetResolver;
    let focus: FocusContextController;

    beforeEach(() => {
      const engine = new MockEngine();
      router = new InputRouter(engine as any);
      controller = new MockController('right');
      router.addController(controller);
      resolver = new SemanticTargetResolver({}, 0.1);
      focus = new FocusContextController();
      router.setSemanticTargeting(resolver, focus);
    });

    it('coerces a structure target over a nearer observation on the per-frame picking path', () => {
      const obs = makeBox(0, 0, -1);
      const structure = makeBox(0, 0, -1.05);
      router.addInteractable(obs, { semantic: { kind: 'observation' } });
      router.addInteractable(structure, {
        semantic: { kind: 'cluster-region', structureId: 'struct-cluster-01', salience: 0.95 },
      });

      router.update(null, null, null, 0);

      // The resolver coerced the structure over the nearer observation, so the
      // hovered entry must be the structure, not the observation.
      expect(router.hovered).not.toBeNull();
      expect(router.hovered?.semantic?.kind).toBe('cluster-region');
      expect(router.hovered?.semantic?.structureId).toBe('struct-cluster-01');
    });

    it('selecting a structure advances focus/context and notifies onFocusChange', () => {
      const focusChanges = vi.fn();
      router.onFocusChange = focusChanges;

      const structure = makeBox(0, 0, -1.05);
      router.addInteractable(structure, {
        semantic: { kind: 'cluster-region', structureId: 'struct-cluster-01', salience: 0.95 },
        onSelect: vi.fn(),
      });

      router.update(null, null, null, 0);
      expect(router.hovered?.semantic?.structureId).toBe('struct-cluster-01');

      // Drive selection through the public trigger path.
      router.activePointer = controller as any;
      (router as any)._triggerSelect();

      expect(focus.focusedStructureId).toBe('struct-cluster-01');
      expect(focus.currentLevel).toBe('structure');
      expect(focusChanges).toHaveBeenCalledTimes(1);
      expect(focusChanges.mock.calls[0][0]).toEqual({
        currentLevel: 'structure',
        focusedStructureId: 'struct-cluster-01',
      });
    });

    it('selecting an observation does not advance Memory Palace focus/context', () => {
      const focusChanges = vi.fn();
      router.onFocusChange = focusChanges;

      const obs = makeBox(0, 0, -1);
      router.addInteractable(obs, {
        semantic: { kind: 'observation' },
        onSelect: vi.fn(),
      });

      router.update(null, null, null, 0);
      expect(router.hovered?.semantic?.kind).toBe('observation');

      router.activePointer = controller as any;
      (router as any)._triggerSelect();

      // Observations are data-node inspections; they must not hijack focus.
      expect(focus.focusedStructureId).toBeNull();
      expect(focus.currentLevel).toBe('dataset');
      expect(focusChanges).not.toHaveBeenCalled();
    });

    it('falls back to the legacy nearest-hit path when the semantic layer is not installed', () => {
      const plainRouter = new InputRouter(new MockEngine() as any);
      const c = new MockController('right');
      plainRouter.addController(c);

      const near = makeBox(0, 0, -1);
      const far = makeBox(0, 0, -1.05);
      plainRouter.addInteractable(near, { semantic: { kind: 'observation' } });
      plainRouter.addInteractable(far, {
        semantic: { kind: 'cluster-region', structureId: 's1', salience: 0.95 },
      });

      plainRouter.update(null, null, null, 0);

      // No resolver installed → nearest hit wins, regardless of semantic salience.
      expect(plainRouter.hovered?.mesh).toBe(near);
    });
  });

  describe('durable focus/context snapshot through NemosyneSession', () => {
    it('exportState/restoreState round-trip the semantic focus without camera pose', () => {
      const focus = new FocusContextController();
      focus.focusStructure('struct_persistence_h0_c1');
      const snap = focus.exportState();

      expect(snap.currentLevel).toBe('structure');
      expect(snap.focusedStructureId).toBe('struct_persistence_h0_c1');
      expect((snap as any).anchorMatrix).toBeUndefined();
      expect((snap as any).cameraPose).toBeUndefined();

      const restored = new FocusContextController();
      restored.restoreState(snap as any);
      expect(restored.currentLevel).toBe('structure');
      expect(restored.focusedStructureId).toBe('struct_persistence_h0_c1');
    });

    it('persists and restores the focus snapshot in the presentation state', () => {
      const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as any });
      const session = new NemosyneSession({ atlas });
      session.setPresentation({
        focus: { currentLevel: 'structure', focusedStructureId: 'struct-cluster-42' },
      } as any);

      const json = session.serialize();
      expect(json.presentation.focus).toEqual({
        currentLevel: 'structure',
        focusedStructureId: 'struct-cluster-42',
      });

      const restoredAtlas = new AtlasCore({ kernel: makeKernelMockBridge() as any });
      const restored = NemosyneSession.deserialize(json, restoredAtlas);
      expect(restored.presentation.focus).toEqual({
        currentLevel: 'structure',
        focusedStructureId: 'struct-cluster-42',
      });
    });

    it('rejects an impossible restored focus state and leaves the controller at dataset context', () => {
      const focus = new FocusContextController();
      expect(() =>
        focus.restoreState({ currentLevel: 'observation', focusedStructureId: null } as any)
      ).toThrow(/requires a focusedStructureId/);
      expect(focus.currentLevel).toBe('dataset');
    });
  });
});