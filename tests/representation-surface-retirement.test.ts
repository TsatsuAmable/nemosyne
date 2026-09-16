import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import type { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';
import {
  RepresentationSurface,
  type RepresentationSurfaceDependencies,
} from '../src/vr/presentation/representation/RepresentationSurface.ts';
import {
  ResourceLifecycleGovernor,
  type ResourceIdentity,
  type ResourceLifecyclePolicy,
} from '../src/vr/scalability/ResourceLifecycleGovernor.ts';

const lifecyclePolicy: ResourceLifecyclePolicy = {
  policyVersion: 'representation-surface-retirement-test/v1',
  maxDeclarations: 1,
  maxActiveResources: 1,
  maxWarmResources: 0,
  maxColdDescriptors: 0,
  maxCleanupOperationsPerTick: 1,
  maxTransitionEvents: 16,
};

function fakeNode(name: string): MonetaTopologyNode {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  mesh.name = name;
  group.add(mesh);
  return {
    artifact: {
      group,
      nodeMeshes: [mesh],
      edgeMeshes: [],
      behaviors: [],
      interactions: {},
    },
    group,
    reSolveAndSynthesize: vi.fn(),
    cancelPendingSemanticEmbodiment: vi.fn(),
  } as unknown as MonetaTopologyNode;
}

function fakeDiagnostic(): MonetaDiagnosticHUD {
  return {
    mesh: new THREE.Group(),
    dispose: vi.fn(),
    render: vi.fn(),
  } as unknown as MonetaDiagnosticHUD;
}

function identity(projectionOrdinal: number): ResourceIdentity {
  return {
    family: 'MONETA_REPRESENTATION',
    datasetFingerprint: 'dataset-fingerprint',
    datasetGeneration: 1,
    datasetVersion: 1,
    decisionId: null,
    semanticId: `representation:none:projection:${projectionOrdinal}`,
  };
}

function makeFixture() {
  const governor = new ResourceLifecycleGovernor(lifecyclePolicy);
  const scene = new THREE.Scene();
  const cameraGroup = new THREE.Group();
  const analystAnchor = new THREE.Group();
  const node = fakeNode('row-1');
  const diagnostic = fakeDiagnostic();
  const selectionEvents: (THREE.Mesh | null)[] = [];

  const dependencies: RepresentationSurfaceDependencies = {
    scene,
    cameraGroup,
    analystAnchor,
    getColorblindMode: () => 'none',
    getFactProvider: () => ({ facts: () => null }),
    addUpdatable: vi.fn(),
    removeUpdatable: vi.fn(),
    addInteractable: vi.fn(),
    removeInteractable: vi.fn(),
    addDiagnosticPanel: vi.fn(),
    removeDiagnosticPanel: vi.fn(),
    setTooltipTargets: vi.fn(),
    clearStructureHandles: vi.fn(),
    rebuildStructureHandles: vi.fn(),
    onSelectNode: vi.fn(),
    resourceLifecycle: governor,
    createResourceIdentity: (_decision, projectionOrdinal) => identity(projectionOrdinal),
  };

  const surface = new RepresentationSurface(dependencies, {
    createNode: () => {
      scene.add(node.group!);
      return node;
    },
    createDiagnostic: () => {
      cameraGroup.add(diagnostic.mesh);
      return diagnostic;
    },
  });
  surface.subscribeSelection((mesh) => selectionEvents.push(mesh));

  return { surface, governor, node, diagnostic, selectionEvents };
}

describe('RepresentationSurface governed retirement', () => {
  it('preserves semantic surface state when lifecycle retirement is refused', () => {
    const { surface, governor, node, diagnostic, selectionEvents } = makeFixture();
    surface.replace({ topology: 'TABULAR' }, null);
    const mesh = node.artifact!.nodeMeshes[0];
    surface.setSelectedMesh(mesh);

    const reconcile = vi.spyOn(governor, 'reconcile');
    reconcile.mockReturnValueOnce({ accepted: false, reason: 'test retirement refusal' });

    expect(() => surface.clear()).toThrow(/retirement refused/i);
    expect(surface.currentNode).toBe(node);
    expect(surface.diagnostic).toBe(diagnostic);
    expect(surface.selectedMesh).toBe(mesh);
    expect(selectionEvents).toEqual([mesh]);
    expect(governor.getSnapshot().counts.ACTIVE).toBe(1);

    reconcile.mockRestore();
    surface.clear();
    expect(surface.currentNode).toBeNull();
    expect(surface.diagnostic).toBeNull();
    expect(surface.selectedMesh).toBeNull();
    expect(selectionEvents.at(-1)).toBeNull();
  });

  it('does not permanently mark the surface disposed when governed retirement is refused', () => {
    const { surface, governor, node } = makeFixture();
    surface.replace({ topology: 'TABULAR' }, null);
    surface.setSelectedMesh(node.artifact!.nodeMeshes[0]);

    const reconcile = vi.spyOn(governor, 'reconcile');
    reconcile.mockReturnValueOnce({ accepted: false, reason: 'test disposal refusal' });

    expect(() => surface.dispose()).toThrow(/retirement refused/i);
    expect(surface.currentNode).toBe(node);

    reconcile.mockRestore();
    expect(() => surface.clear()).not.toThrow();
    expect(surface.currentNode).toBeNull();
    expect(() => surface.dispose()).not.toThrow();
  });
});
