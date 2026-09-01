import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TechnoCoreNode } from '../src/vr/artifacts/TechnoCoreNode.ts';
import { WorldLandmarkController } from '../src/vr/coordinators/WorldLandmarkController.ts';
import {
  MAX_MEMORY_PALACE_OBJECTS,
  MemoryPalaceWorldView,
} from '../src/vr/presentation/epistemic/MemoryPalaceWorldView.ts';
import type { MemoryPalaceProjectionSource } from '../src/vr/presentation/epistemic/MemoryPalaceWorldView.ts';

type TestInteractable = {
  onSelect?: (mesh: THREE.Object3D) => void;
};

function landmarkHarness() {
  const core = new TechnoCoreNode();
  const dispatchIntent = vi.fn();
  const application = {
    dispatchIntent,
    openVault: vi.fn(),
    setStatisticalLensVisible: vi.fn(),
    recordInteraction: vi.fn(),
    captureSession: vi.fn(),
  };
  const feedback = {
    log: vi.fn(),
    playCoreTone: vi.fn(),
    playHaptic: vi.fn(),
  };
  const controller = new WorldLandmarkController({
    targets: { core },
    registry: {
      registerTooltipTarget: vi.fn(),
      registerInteractable: vi.fn(),
    },
    application,
    feedback,
  });
  return { core, controller, application, feedback };
}

describe('P1-UV C1 functional world objects', () => {
  it.each(['DECISIVE', 'AMBIGUOUS', 'UNDERDETERMINED', 'INFEASIBLE'] as const)(
    'projects exact categorical TechnoCore state: %s',
    (state) => {
      const core = new TechnoCoreNode();
      core.setDecisionState(state);

      expect(core.decisionState).toBe(state);
      expect(core.group.userData.decisionState).toBe(state);
      expect(core.ring1.visible).toBe(true);
      expect(core.ring2.visible).toBe(true);
    },
  );

  it('opens governed representation guidance without mutating the lens on the configured product path', () => {
    const { core, controller, application } = landmarkHarness();
    const guidance = vi.fn();
    const nextLensMode = vi.spyOn(core, 'nextLensMode');

    core.setDecisionState('AMBIGUOUS');
    controller.setRepresentationGuidanceOpener(guidance);
    controller.onCoreSelect();

    expect(guidance).toHaveBeenCalledTimes(1);
    expect(nextLensMode).not.toHaveBeenCalled();
    expect(application.dispatchIntent).not.toHaveBeenCalled();
    expect(application.setStatisticalLensVisible).not.toHaveBeenCalled();
    expect(application.recordInteraction).toHaveBeenCalledWith(
      'TechnoCore representation guidance',
      { state: 'AMBIGUOUS' },
    );
  });

  it('retains the isolated compatibility lens fallback when no C1 opener is installed', () => {
    const { core, controller, application } = landmarkHarness();
    expect(core.lensMode).toBe('off');

    controller.onCoreSelect();

    expect(core.lensMode).toBe('statistical');
    expect(application.setStatisticalLensVisible).toHaveBeenCalledWith(true);
  });

  it('bounds Memory Palace objects and projects only explicit epistemic sources', () => {
    const scene = new THREE.Scene();
    const interactables = new Map<THREE.Object3D, TestInteractable>();
    const tooltips = new Set<THREE.Object3D>();
    const view = new MemoryPalaceWorldView({
      scene,
      addInteractable: (object, handlers) => interactables.set(object, handlers),
      removeInteractable: (object) => interactables.delete(object),
      registerTooltipTarget: (object) => tooltips.add(object),
      unregisterTooltipTarget: (object) => tooltips.delete(object),
    });

    const observations = Array.from({ length: MAX_MEMORY_PALACE_OBJECTS + 20 }, (_, index) => ({
      id: `obs-${index}`,
      timestamp: index,
      notes: `Observation ${index}`,
      datasetFingerprint: 'fp',
      datasetVersion: 1,
    }));
    const source: MemoryPalaceProjectionSource = {
      sessionId: 'session-c1',
      nodes: [
        {
          id: 'representation-only',
          kind: 'representation_decision',
          parentId: null,
          datasetVersion: 1,
          datasetFingerprint: 'fp',
          label: 'Representation decision',
          timestamp: 1,
        },
      ],
      edges: [],
      activeNodeId: null,
      observations,
      findings: [],
    };

    view.sync(source);
    const snapshot = view.getSnapshot();

    expect(snapshot.objectCount).toBe(MAX_MEMORY_PALACE_OBJECTS);
    expect(snapshot.objectIds).not.toContain('representation-only');
    expect(snapshot.objectIds[0]).toBe('obs-0');
    expect(interactables.size).toBe(MAX_MEMORY_PALACE_OBJECTS);
    expect(tooltips.size).toBe(MAX_MEMORY_PALACE_OBJECTS);
    view.dispose();
    expect(interactables.size).toBe(0);
    expect(tooltips.size).toBe(0);
  });

  it('shows only authoritative relationships incident to the selected epistemic object', () => {
    const scene = new THREE.Scene();
    const interactables = new Map<THREE.Object3D, TestInteractable>();
    const view = new MemoryPalaceWorldView({
      scene,
      addInteractable: (object, handlers) => interactables.set(object, handlers),
      removeInteractable: (object) => interactables.delete(object),
      registerTooltipTarget: vi.fn(),
      unregisterTooltipTarget: vi.fn(),
    });
    const source: MemoryPalaceProjectionSource = {
      sessionId: 'session-c1',
      nodes: [
        {
          id: 'test-1',
          kind: 'operation',
          parentId: null,
          datasetVersion: 1,
          datasetFingerprint: 'fp',
          label: 'Test 1',
          timestamp: 1,
          operation: 'cluster',
        },
        {
          id: 'finding-1',
          kind: 'finding',
          parentId: 'test-1',
          datasetVersion: 1,
          datasetFingerprint: 'fp',
          label: 'Finding 1',
          timestamp: 2,
        },
        {
          id: 'finding-2',
          kind: 'finding',
          parentId: 'test-1',
          datasetVersion: 1,
          datasetFingerprint: 'fp',
          label: 'Finding 2',
          timestamp: 3,
        },
      ],
      edges: [
        { id: 'support-1', source: 'test-1', target: 'finding-1', relationship: 'supports' },
        { id: 'support-2', source: 'test-1', target: 'finding-2', relationship: 'supports' },
        { id: 'other', source: 'finding-1', target: 'finding-2', relationship: 'motivates' },
      ],
      activeNodeId: 'finding-1',
      observations: [],
      findings: [],
    };

    view.sync(source);
    expect(view.getSnapshot().selectedId).toBe('finding-1');
    expect(view.getSnapshot().relationshipCount).toBe(2);

    const testMesh = Array.from(interactables.keys()).find(
      (mesh) => mesh.userData.epistemicId === 'test-1',
    );
    expect(testMesh).toBeDefined();
    interactables.get(testMesh!)?.onSelect?.(testMesh!);
    expect(view.getSnapshot().selectedId).toBe('test-1');
    expect(view.getSnapshot().relationshipCount).toBe(2);

    view.dispose();
  });
});