import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import type { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';
import { RepresentationSurface } from '../src/vr/presentation/representation/RepresentationSurface.ts';

function fakeNode(name: string, semanticId: string, datasetFingerprint: string): MonetaTopologyNode {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  mesh.name = name;
  mesh.userData.semanticId = semanticId;
  mesh.userData.datasetFingerprint = datasetFingerprint;
  mesh.userData.representationKind = 'DENSITY_FIELD';
  group.add(mesh);
  return {
    artifact: { group, nodeMeshes: [mesh], edgeMeshes: [], behaviors: [], interactions: {} },
    group,
    reSolveAndSynthesize: vi.fn(),
    cancelPendingSemanticEmbodiment: vi.fn(),
  } as unknown as MonetaTopologyNode;
}

function diagnostic(): MonetaDiagnosticHUD {
  return {
    mesh: new THREE.Group(),
    dispose: vi.fn(),
    render: vi.fn(),
  } as unknown as MonetaDiagnosticHUD;
}

function dependencies() {
  return {
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
}

describe('Stream A A3 semantic selection lineage', () => {
  it('preserves a selected semantic target when renderer-local mesh names change', () => {
    const first = fakeNode('density-proxy-old', 'density-cell:1:1', 'dataset-A');
    const second = fakeNode('density-proxy-new', 'density-cell:1:1', 'dataset-A');
    const createNode = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const surface = new RepresentationSurface(dependencies(), {
      createNode,
      createDiagnostic: () => diagnostic(),
    });

    surface.replace({ topology: 'TABULAR' }, null);
    surface.setSelectedMesh(first.artifact!.nodeMeshes[0]);
    surface.replace({ topology: 'TABULAR' }, null);

    expect(surface.selectedMesh).toBe(second.artifact!.nodeMeshes[0]);
    expect(surface.getSelectedSemanticIdentity()).toEqual({
      semanticId: 'density-cell:1:1',
      datasetFingerprint: 'dataset-A',
    });
  });

  it('fails closed instead of carrying a same-named semantic target into another dataset', () => {
    const first = fakeNode('density-proxy', 'density-cell:1:1', 'dataset-A');
    const second = fakeNode('density-proxy', 'density-cell:1:1', 'dataset-B');
    const createNode = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const surface = new RepresentationSurface(dependencies(), {
      createNode,
      createDiagnostic: () => diagnostic(),
    });

    surface.replace({ topology: 'TABULAR' }, null);
    surface.setSelectedMesh(first.artifact!.nodeMeshes[0]);
    surface.replace({ topology: 'TABULAR' }, null);

    expect(surface.selectedMesh).toBeNull();
  });

  it('finds semantic targets by semantic identity rather than instance index or mesh name', () => {
    const node = fakeNode('arbitrary-render-name', 'density-cell:2:3', 'dataset-A');
    const surface = new RepresentationSurface(dependencies(), {
      createNode: () => node,
      createDiagnostic: () => diagnostic(),
    });

    surface.replace({ topology: 'TABULAR' }, null);

    expect(
      surface.findMeshBySemanticIdentity({
        semanticId: 'density-cell:2:3',
        datasetFingerprint: 'dataset-A',
      })
    ).toBe(node.artifact!.nodeMeshes[0]);
    expect(
      surface.findMeshBySemanticIdentity({
        semanticId: 'density-cell:2:3',
        datasetFingerprint: 'dataset-B',
      })
    ).toBeNull();
  });
});
