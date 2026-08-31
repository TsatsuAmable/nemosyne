import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import type { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';
import {
  RepresentationSurface,
  type RepresentationInteractableOptions,
} from '../src/vr/presentation/representation/RepresentationSurface.ts';

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
