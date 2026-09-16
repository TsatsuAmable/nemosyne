import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import type { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';
import {
  RepresentationSurface,
  type RepresentationInteractableOptions,
  type RepresentationSurfaceDependencies,
} from '../src/vr/presentation/representation/RepresentationSurface.ts';
import {
  ResourceLifecycleGovernor,
  type ResourceIdentity,
  type ResourceLifecyclePolicy,
} from '../src/vr/scalability/ResourceLifecycleGovernor.ts';

const lifecyclePolicy: ResourceLifecyclePolicy = {
  policyVersion: 'representation-surface-test/v1',
  maxDeclarations: 1,
  maxActiveResources: 1,
  maxWarmResources: 0,
  maxColdDescriptors: 0,
  maxCleanupOperationsPerTick: 1,
  maxTransitionEvents: 16,
};

function fakeNode(
  meshName: string,
  representationKind?: string,
  provenance?: Record<string, unknown>
): MonetaTopologyNode {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  mesh.name = meshName;
  if (representationKind) mesh.userData.representationKind = representationKind;
  if (provenance) mesh.userData.provenance = provenance;
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

function resourceIdentity(decisionId: string | null, projectionOrdinal: number): ResourceIdentity {
  return {
    family: 'MONETA_REPRESENTATION',
    datasetFingerprint: 'dataset-fingerprint',
    datasetGeneration: 3,
    datasetVersion: 5,
    decisionId,
    semanticId: `representation:${decisionId ?? 'none'}:projection:${projectionOrdinal}`,
  };
}

interface LifecycleSurfaceFixture {
  surface: RepresentationSurface;
  governor: ResourceLifecycleGovernor;
  dependencies: RepresentationSurfaceDependencies;
  createResourceIdentity: ReturnType<typeof vi.fn>;
  selectionEvents: (THREE.Mesh | null)[];
}

function makeLifecycleSurface(
  nodes: MonetaTopologyNode[],
  diagnostics: MonetaDiagnosticHUD[],
  policy: ResourceLifecyclePolicy = lifecyclePolicy
): LifecycleSurfaceFixture {
  const governor = new ResourceLifecycleGovernor(policy);
  const scene = new THREE.Scene();
  const selectionEvents: (THREE.Mesh | null)[] = [];
  const createResourceIdentity = vi.fn(
    (decision: RepresentationDecision | null, projectionOrdinal: number) =>
      resourceIdentity(decision?.id ?? null, projectionOrdinal)
  );
  const dependencies: RepresentationSurfaceDependencies = {
    scene,
    cameraGroup: new THREE.Group(),
    analystAnchor: new THREE.Group(),
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
    createResourceIdentity,
  };
  const pendingNodes = [...nodes];
  const pendingDiagnostics = [...diagnostics];
  const surface = new RepresentationSurface(dependencies, {
    createNode: () => {
      const node = pendingNodes.shift();
      if (!node) throw new Error('No test node remains');
      scene.add(node.group!);
      return node;
    },
    createDiagnostic: () => {
      const diagnostic = pendingDiagnostics.shift();
      if (!diagnostic) throw new Error('No test diagnostic remains');
      dependencies.cameraGroup.add(diagnostic.mesh);
      return diagnostic;
    },
  });
  surface.subscribeSelection((mesh) => selectionEvents.push(mesh));
  return { surface, governor, dependencies, createResourceIdentity, selectionEvents };
}

function makeSurface(
  node: MonetaTopologyNode,
  addInteractable: (mesh: THREE.Mesh, options: RepresentationInteractableOptions) => void = vi.fn()
): RepresentationSurface {
  return new RepresentationSurface(
    {
      scene: new THREE.Scene(),
      cameraGroup: new THREE.Group(),
      analystAnchor: new THREE.Group(),
      getColorblindMode: () => 'none',
      getFactProvider: () => ({ facts: () => null }),
      addUpdatable: vi.fn(),
      removeUpdatable: vi.fn(),
      addInteractable,
      removeInteractable: vi.fn(),
      addDiagnosticPanel: vi.fn(),
      removeDiagnosticPanel: vi.fn(),
      setTooltipTargets: vi.fn(),
      clearStructureHandles: vi.fn(),
      rebuildStructureHandles: vi.fn(),
      onSelectNode: vi.fn(),
    },
    { createNode: () => node, createDiagnostic: () => fakeDiagnostic() }
  );
}

describe('RF-062C RepresentationSurface', () => {
  it('atomically replaces representation resources and preserves selection by semantic mesh name', () => {
    const first = fakeNode('row-1');
    const second = fakeNode('row-1');
    const firstDiagnostic = fakeDiagnostic();
    const secondDiagnostic = fakeDiagnostic();
    const createNode = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const createDiagnostic = vi
      .fn()
      .mockReturnValueOnce(firstDiagnostic)
      .mockReturnValueOnce(secondDiagnostic);
    const interactables = new Map<THREE.Mesh, RepresentationInteractableOptions>();
    const addUpdatable = vi.fn();
    const removeUpdatable = vi.fn();
    const removeInteractable = vi.fn((mesh: THREE.Mesh) => interactables.delete(mesh));
    const clearStructureHandles = vi.fn();
    const rebuildStructureHandles = vi.fn();
    const onSelectNode = vi.fn();

    const surface = new RepresentationSurface(
      {
        scene: new THREE.Scene(),
        cameraGroup: new THREE.Group(),
        analystAnchor: new THREE.Group(),
        getColorblindMode: () => 'none',
        getFactProvider: () => ({ facts: () => null }),
        addUpdatable,
        removeUpdatable,
        addInteractable: (mesh, options) => interactables.set(mesh, options),
        removeInteractable,
        addDiagnosticPanel: vi.fn(),
        removeDiagnosticPanel: vi.fn(),
        setTooltipTargets: vi.fn(),
        clearStructureHandles,
        rebuildStructureHandles,
        onSelectNode,
      },
      { createNode, createDiagnostic }
    );

    surface.replace({ topology: 'TABULAR' }, null);
    const firstMesh = first.artifact!.nodeMeshes[0];
    interactables.get(firstMesh)?.onSelect?.(firstMesh);
    expect(surface.selectedMesh).toBe(firstMesh);
    expect(onSelectNode).toHaveBeenCalledWith(firstMesh);

    surface.replace({ topology: 'TABULAR' }, null);

    expect(first.cancelPendingSemanticEmbodiment).toHaveBeenCalledOnce();
    expect(removeUpdatable).toHaveBeenCalledWith(first);
    expect(removeInteractable).toHaveBeenCalledWith(firstMesh);
    expect(firstDiagnostic.dispose as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
    expect(surface.currentNode).toBe(second);
    expect(surface.diagnostic).toBe(secondDiagnostic);
    expect(surface.selectedMesh).toBe(second.artifact!.nodeMeshes[0]);
    expect(rebuildStructureHandles).toHaveBeenCalledTimes(2);
    expect(clearStructureHandles).toHaveBeenCalled();
  });

  it('keeps the current representation alive if construction of the replacement fails', () => {
    const first = fakeNode('row-1');
    const createNode = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(() => {
        throw new Error('translation failed');
      });
    const removeUpdatable = vi.fn();

    const surface = new RepresentationSurface(
      {
        scene: new THREE.Scene(),
        cameraGroup: new THREE.Group(),
        analystAnchor: new THREE.Group(),
        getColorblindMode: () => 'none',
        getFactProvider: () => ({ facts: () => null }),
        addUpdatable: vi.fn(),
        removeUpdatable,
        addInteractable: vi.fn(),
        removeInteractable: vi.fn(),
        addDiagnosticPanel: vi.fn(),
        removeDiagnosticPanel: vi.fn(),
        setTooltipTargets: vi.fn(),
        clearStructureHandles: vi.fn(),
        rebuildStructureHandles: vi.fn(),
        onSelectNode: vi.fn(),
      },
      { createNode, createDiagnostic: () => fakeDiagnostic() }
    );

    surface.replace({ topology: 'TABULAR' }, null);
    expect(() => surface.replace({ topology: 'TABULAR' }, null)).toThrow('translation failed');
    expect(surface.currentNode).toBe(first);
    expect(first.cancelPendingSemanticEmbodiment).not.toHaveBeenCalled();
    expect(removeUpdatable).not.toHaveBeenCalledWith(first);
  });

  it('detaches the outgoing representation immediately but defers heavy disposal to governor ticks', () => {
    const first = fakeNode('row-1');
    const second = fakeNode('row-2');
    const firstGeometryDispose = vi.spyOn(first.artifact!.nodeMeshes[0].geometry, 'dispose');
    const firstDiagnostic = fakeDiagnostic();
    const fixture = makeLifecycleSurface([first, second], [firstDiagnostic, fakeDiagnostic()]);

    fixture.surface.replace({ topology: 'TABULAR' }, null);
    fixture.surface.replace({ topology: 'TABULAR' }, null);

    expect(fixture.dependencies.removeUpdatable).toHaveBeenCalledWith(first);
    expect(fixture.dependencies.removeInteractable).toHaveBeenCalledWith(
      first.artifact!.nodeMeshes[0]
    );
    expect(first.group!.parent).toBeNull();
    expect(firstGeometryDispose).not.toHaveBeenCalled();
    expect(firstDiagnostic.dispose as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(fixture.governor.getSnapshot().queuedCleanupCount).toBe(1);

    fixture.governor.tick();
    expect(firstGeometryDispose).not.toHaveBeenCalled();
    fixture.governor.tick();
    expect(firstGeometryDispose).toHaveBeenCalledTimes(1);
  });

  it('refuses admission atomically and leaves the old projection, selection, authority, and ordinal untouched', () => {
    const first = fakeNode('row-1');
    const refused = fakeNode('row-refused');
    const accepted = fakeNode('row-accepted');
    const refusedGeometryDispose = vi.spyOn(refused.artifact!.nodeMeshes[0].geometry, 'dispose');
    const refusedDiagnostic = fakeDiagnostic();
    const fixture = makeLifecycleSurface(
      [first, refused, accepted],
      [fakeDiagnostic(), refusedDiagnostic, fakeDiagnostic()]
    );

    fixture.surface.replace({ topology: 'TABULAR' }, null);
    fixture.surface.setSelectedMesh(first.artifact!.nodeMeshes[0]);
    const before = fixture.governor.getSnapshot();
    const validate = vi.spyOn(fixture.governor, 'validateWorkingSet');
    validate.mockReturnValueOnce({ accepted: false, reason: 'test admission refusal' });

    expect(() => fixture.surface.replace({ topology: 'TABULAR' }, null)).toThrow(
      /admission refused/i
    );

    expect(fixture.surface.currentNode).toBe(first);
    expect(fixture.surface.selectedMesh).toBe(first.artifact!.nodeMeshes[0]);
    expect(fixture.governor.getSnapshot()).toEqual(before);
    expect(first.cancelPendingSemanticEmbodiment).not.toHaveBeenCalled();
    expect(refusedGeometryDispose).toHaveBeenCalledTimes(1);
    expect(refusedDiagnostic.dispose as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    expect(refusedDiagnostic.mesh.parent).toBeNull();
    expect(fixture.selectionEvents).toEqual([first.artifact!.nodeMeshes[0]]);

    validate.mockRestore();
    fixture.surface.replace({ topology: 'TABULAR' }, null);
    expect(fixture.createResourceIdentity.mock.calls.map((call) => call[1])).toEqual([1, 2, 2]);
  });

  it('disposes the candidate and preserves the old authority when lifecycle preflight throws', () => {
    const first = fakeNode('row-1');
    const candidate = fakeNode('row-candidate');
    const candidateGeometryDispose = vi.spyOn(
      candidate.artifact!.nodeMeshes[0].geometry,
      'dispose'
    );
    const candidateDiagnostic = fakeDiagnostic();
    const fixture = makeLifecycleSurface(
      [first, candidate],
      [fakeDiagnostic(), candidateDiagnostic]
    );

    fixture.surface.replace({ topology: 'TABULAR' }, null);
    fixture.surface.setSelectedMesh(first.artifact!.nodeMeshes[0]);
    const before = fixture.governor.getSnapshot();
    fixture.createResourceIdentity.mockImplementationOnce(() => {
      throw new Error('identity unavailable');
    });

    expect(() => fixture.surface.replace({ topology: 'TABULAR' }, null)).toThrow(
      'identity unavailable'
    );
    expect(fixture.surface.currentNode).toBe(first);
    expect(fixture.surface.selectedMesh).toBe(first.artifact!.nodeMeshes[0]);
    expect(fixture.governor.getSnapshot()).toEqual(before);
    expect(candidateGeometryDispose).toHaveBeenCalledTimes(1);
    expect(candidateDiagnostic.dispose as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    expect(candidateDiagnostic.mesh.parent).toBeNull();
  });

  it('uses distinct projection identities when the same decision is rendered again', () => {
    const decision = { id: 'decision-1' } as RepresentationDecision;
    const fixture = makeLifecycleSurface(
      [fakeNode('row-1'), fakeNode('row-2')],
      [fakeDiagnostic(), fakeDiagnostic()],
      { ...lifecyclePolicy, maxWarmResources: 1 }
    );

    fixture.surface.replace({ topology: 'TABULAR' }, decision);
    fixture.surface.replace({ topology: 'TABULAR' }, decision);

    const identities = fixture.createResourceIdentity.mock.results.map(
      (result) => result.value as ResourceIdentity
    );
    expect(identities.map(({ semanticId }) => semanticId)).toEqual([
      'representation:decision-1:projection:1',
      'representation:decision-1:projection:2',
    ]);
    expect(fixture.governor.getSnapshot().counts).toEqual({
      ACTIVE: 1,
      WARM: 1,
      COLD: 0,
      EVICTED: 0,
    });
  });

  it('restores selection by durable semantic identity rather than mesh identity', () => {
    const first = fakeNode('transient-mesh-a');
    const second = fakeNode('transient-mesh-b');
    for (const node of [first, second]) {
      const mesh = node.artifact!.nodeMeshes[0];
      mesh.userData.semanticId = 'observation:durable-7';
      mesh.userData.datasetFingerprint = 'dataset-fingerprint';
      mesh.userData.provenance = { decisionId: 'decision-1' };
    }
    const fixture = makeLifecycleSurface([first, second], [fakeDiagnostic(), fakeDiagnostic()]);

    fixture.surface.replace({ topology: 'TABULAR' }, null);
    fixture.surface.setSelectedMesh(first.artifact!.nodeMeshes[0]);
    fixture.surface.replace({ topology: 'TABULAR' }, null);

    expect(fixture.surface.selectedMesh).toBe(second.artifact!.nodeMeshes[0]);
    expect(fixture.surface.selectedMesh).not.toBe(first.artifact!.nodeMeshes[0]);
    expect(fixture.selectionEvents).toEqual([
      first.artifact!.nodeMeshes[0],
      null,
      second.artifact!.nodeMeshes[0],
    ]);
  });

  it('rolls back a registered candidate when atomic reconcile refuses the swap', () => {
    const first = fakeNode('row-1');
    const candidate = fakeNode('row-2');
    const accepted = fakeNode('row-3');
    const candidateGeometryDispose = vi.spyOn(
      candidate.artifact!.nodeMeshes[0].geometry,
      'dispose'
    );
    const candidateDiagnostic = fakeDiagnostic();
    const fixture = makeLifecycleSurface(
      [first, candidate, accepted],
      [fakeDiagnostic(), candidateDiagnostic, fakeDiagnostic()]
    );

    fixture.surface.replace({ topology: 'TABULAR' }, null);
    fixture.surface.setSelectedMesh(first.artifact!.nodeMeshes[0]);
    const before = fixture.governor.getSnapshot();
    vi.spyOn(fixture.governor, 'reconcile').mockReturnValueOnce({
      accepted: false,
      reason: 'test post-registration refusal',
    });

    expect(() => fixture.surface.replace({ topology: 'TABULAR' }, null)).toThrow(
      /post-registration refusal/i
    );

    expect(fixture.surface.currentNode).toBe(first);
    expect(fixture.surface.selectedMesh).toBe(first.artifact!.nodeMeshes[0]);
    expect(fixture.governor.getSnapshot()).toEqual(before);
    expect(candidateGeometryDispose).toHaveBeenCalledTimes(1);
    expect(candidateDiagnostic.dispose as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    expect(candidateDiagnostic.mesh.parent).toBeNull();
    expect(fixture.dependencies.addUpdatable).not.toHaveBeenCalledWith(candidate);
    expect(fixture.selectionEvents).toEqual([
      first.artifact!.nodeMeshes[0],
      null,
      first.artifact!.nodeMeshes[0],
    ]);

    fixture.surface.replace({ topology: 'TABULAR' }, null);
    expect(fixture.surface.currentNode).toBe(accepted);
    expect(fixture.createResourceIdentity.mock.calls.map((call) => call[1])).toEqual([1, 2, 2]);
  });

  it('binds empirical-distribution meshes as distribution elements', () => {
    const node = fakeNode('distribution-bin:000', 'DISTRIBUTION_FIELD');
    const addInteractable = vi.fn();
    const surface = makeSurface(node, addInteractable);

    surface.replace({ topology: 'TABULAR' }, null);

    expect(addInteractable).toHaveBeenCalledWith(
      node.artifact!.nodeMeshes[0],
      expect.objectContaining({ semantic: { kind: 'distribution-element' } })
    );
    surface.dispose();
  });

  it('binds density meshes as density cells rather than observations', () => {
    const node = fakeNode('density-cell:000', 'DENSITY_FIELD');
    const addInteractable = vi.fn();
    const surface = makeSurface(node, addInteractable);

    surface.replace({ topology: 'TABULAR' }, null);

    expect(addInteractable).toHaveBeenCalledWith(
      node.artifact!.nodeMeshes[0],
      expect.objectContaining({ semantic: { kind: 'density-cell' } })
    );
    expect(addInteractable).not.toHaveBeenCalledWith(
      node.artifact!.nodeMeshes[0],
      expect.objectContaining({ semantic: { kind: 'observation' } })
    );
    surface.dispose();
  });

  it('binds provenance-bearing cluster regions as governed semantic regions', () => {
    const node = fakeNode('cluster-region:A', 'CLUSTER_REGIONS', {
      algorithmVersion: 'source-partition-cluster-columnar-v1',
    });
    const addInteractable = vi.fn();
    const surface = makeSurface(node, addInteractable);

    surface.replace({ topology: 'TABULAR' }, null);

    expect(addInteractable).toHaveBeenCalledWith(
      node.artifact!.nodeMeshes[0],
      expect.objectContaining({ semantic: { kind: 'cluster-region' } })
    );
    surface.dispose();
  });

  it('does not advertise presentation-only cluster spheres as governed cluster regions', () => {
    const node = fakeNode('legacy-cluster-sphere', 'CLUSTER_REGIONS');
    const addInteractable = vi.fn();
    const surface = makeSurface(node, addInteractable);

    surface.replace({ topology: 'TABULAR' }, null);

    expect(addInteractable).toHaveBeenCalledWith(
      node.artifact!.nodeMeshes[0],
      expect.objectContaining({ semantic: { kind: 'presentation-cluster' } })
    );
    expect(addInteractable).not.toHaveBeenCalledWith(
      node.artifact!.nodeMeshes[0],
      expect.objectContaining({ semantic: { kind: 'cluster-region' } })
    );
    surface.dispose();
  });

  it('clears a promoted representation without constructing a fallback', () => {
    const node = fakeNode('row-1');
    const diagnostic = fakeDiagnostic();
    const createNode = vi.fn(() => node);
    const removeUpdatable = vi.fn();
    const removeDiagnosticPanel = vi.fn();
    const removeInteractable = vi.fn();

    const surface = new RepresentationSurface(
      {
        scene: new THREE.Scene(),
        cameraGroup: new THREE.Group(),
        analystAnchor: new THREE.Group(),
        getColorblindMode: () => 'none',
        getFactProvider: () => ({ facts: () => null }),
        addUpdatable: vi.fn(),
        removeUpdatable,
        addInteractable: vi.fn(),
        removeInteractable,
        addDiagnosticPanel: vi.fn(),
        removeDiagnosticPanel,
        setTooltipTargets: vi.fn(),
        clearStructureHandles: vi.fn(),
        rebuildStructureHandles: vi.fn(),
        onSelectNode: vi.fn(),
      },
      { createNode, createDiagnostic: () => diagnostic }
    );

    surface.replace({ topology: 'TABULAR' }, null);
    expect(createNode).toHaveBeenCalledOnce();

    surface.clear();

    expect(createNode).toHaveBeenCalledOnce();
    expect(node.cancelPendingSemanticEmbodiment).toHaveBeenCalledOnce();
    expect(removeUpdatable).toHaveBeenCalledWith(node);
    expect(removeInteractable).toHaveBeenCalledWith(node.artifact!.nodeMeshes[0]);
    expect(removeDiagnosticPanel).toHaveBeenCalledWith(diagnostic);
    expect(surface.currentNode).toBeNull();
    expect(surface.diagnostic).toBeNull();
    expect(surface.selectedMesh).toBeNull();
  });

  it('makes lifecycle surface semantic state null immediately while heavy cleanup remains queued', () => {
    const node = fakeNode('row-1');
    const geometryDispose = vi.spyOn(node.artifact!.nodeMeshes[0].geometry, 'dispose');
    const diagnostic = fakeDiagnostic();
    const fixture = makeLifecycleSurface([node], [diagnostic]);

    fixture.surface.replace({ topology: 'TABULAR' }, null);
    fixture.surface.setSelectedMesh(node.artifact!.nodeMeshes[0]);
    fixture.surface.clear();

    expect(fixture.surface.currentNode).toBeNull();
    expect(fixture.surface.diagnostic).toBeNull();
    expect(fixture.surface.selectedMesh).toBeNull();
    expect(fixture.selectionEvents.at(-1)).toBeNull();
    expect(fixture.governor.getSnapshot().counts.ACTIVE).toBe(0);
    expect(fixture.governor.getSnapshot().queuedCleanupCount).toBe(1);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(diagnostic.dispose as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('preserves immediate recursive disposal when lifecycle dependencies are absent', () => {
    const first = fakeNode('row-1');
    const second = fakeNode('row-2');
    const geometryDispose = vi.spyOn(first.artifact!.nodeMeshes[0].geometry, 'dispose');
    const firstDiagnostic = fakeDiagnostic();
    const createNode = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const createDiagnostic = vi
      .fn()
      .mockReturnValueOnce(firstDiagnostic)
      .mockReturnValueOnce(fakeDiagnostic());
    const dependencies: RepresentationSurfaceDependencies = {
      scene: new THREE.Scene(),
      cameraGroup: new THREE.Group(),
      analystAnchor: new THREE.Group(),
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
    };
    const surface = new RepresentationSurface(dependencies, { createNode, createDiagnostic });

    surface.replace({ topology: 'TABULAR' }, null);
    surface.replace({ topology: 'TABULAR' }, null);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(firstDiagnostic.dispose as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });

  it('disposes owned resources idempotently', () => {
    const node = fakeNode('row-1');
    const diagnostic = fakeDiagnostic();
    const removeUpdatable = vi.fn();
    const removeDiagnosticPanel = vi.fn();
    const removeInteractable = vi.fn();

    const surface = new RepresentationSurface(
      {
        scene: new THREE.Scene(),
        cameraGroup: new THREE.Group(),
        analystAnchor: new THREE.Group(),
        getColorblindMode: () => 'none',
        getFactProvider: () => ({ facts: () => null }),
        addUpdatable: vi.fn(),
        removeUpdatable,
        addInteractable: vi.fn(),
        removeInteractable,
        addDiagnosticPanel: vi.fn(),
        removeDiagnosticPanel,
        setTooltipTargets: vi.fn(),
        clearStructureHandles: vi.fn(),
        rebuildStructureHandles: vi.fn(),
        onSelectNode: vi.fn(),
      },
      { createNode: () => node, createDiagnostic: () => diagnostic }
    );

    surface.replace({ topology: 'TABULAR' }, null);
    surface.dispose();
    surface.dispose();

    expect(node.cancelPendingSemanticEmbodiment).toHaveBeenCalledTimes(1);
    expect(removeUpdatable).toHaveBeenCalledTimes(1);
    expect(removeInteractable).toHaveBeenCalledTimes(1);
    expect(removeDiagnosticPanel).toHaveBeenCalledTimes(1);
    expect(diagnostic.dispose as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    expect(surface.currentNode).toBeNull();
    expect(surface.diagnostic).toBeNull();
  });
});
