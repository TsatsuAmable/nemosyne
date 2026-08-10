import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SceneGraphController } from '../../../src/vr/coordinators/SceneGraphController.ts';
import { WorkspaceManager } from '../../../src/vr/coordinators/WorkspaceManager.ts';
import { WorldSceneComposer } from '../../../src/vr/coordinators/WorldSceneComposer.ts';
import { DataOperationController } from '../../../src/vr/coordinators/DataOperationController.ts';
import { WorldEventBus } from '../../../src/utils/EventBus.ts';
import { Dataset } from '../../../src/data/Dataset.ts';

describe('Tier 2 — Feature 3: God Object Refactoring (World.ts Sub-Managers Boundary Cases)', () => {
  it('F3-BC1: SceneGraphController initializes camera, lights, and analyst anchor', () => {
    const controller = new SceneGraphController();
    expect(controller.scene).toBeInstanceOf(THREE.Scene);
    expect(controller.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(controller.analystAnchor).toBeInstanceOf(THREE.Group);

    controller.dispose();
  });

  it('F3-BC2: WorkspaceManager handles artifact node registration and unregistration cleanly', () => {
    const scene = new THREE.Scene();
    const workspace = new WorkspaceManager(scene);

    const node = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    workspace.registerArtifactNode('node_1', node);

    expect(workspace.getArtifactNode('node_1')).toBe(node);
    expect(workspace.datasetNodeGroup.children.includes(node)).toBe(true);

    workspace.unregisterArtifactNode('node_1');
    expect(workspace.getArtifactNode('node_1')).toBeUndefined();
    expect(workspace.datasetNodeGroup.children.includes(node)).toBe(false);
  });

  it('F3-BC3: DataOperationController initializes original and transformed datasets via setOriginalDataset', () => {
    const bus = new WorldEventBus();
    // Minimal functional artifact so reset() runs the full path and records a
    // history frame instead of early-returning on a null artifact.
    const artifact = { group: new THREE.Group(), nodeMeshes: [] as THREE.Mesh[] };
    const doc = new DataOperationController({ eventBus: bus, getArtifact: () => artifact });

    const dataset = new Dataset('TestDS', [{ name: 'val', type: 'NUMERIC' }], [{ val: 10 }, { val: 20 }]);
    doc.setOriginalDataset(dataset);

    expect(doc.originalDataset?.rowCount).toBe(2);
    expect(doc.transformedDataset?.rowCount).toBe(2);

    doc.reset();
    expect(doc.analysisHistory.length).toBeGreaterThan(0);
  });

  it('F3-BC4: WorldSceneComposer updates analystAnchor tracking under camera motion', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5.0, 2.0, -10.0);
    const cameraGroup = new THREE.Group();
    cameraGroup.add(camera);

    const mockEngine: any = {
      camera,
      cameraGroup,
      scene: new THREE.Scene(),
      addUpdatable: () => {},
    };

    const composer = new WorldSceneComposer(mockEngine);
    composer.update(0.016);

    expect(composer.analystAnchor.position.x).toBe(5.0);
    expect(composer.analystAnchor.position.z).toBe(-10.0);
    expect(composer.analystAnchor.position.y).toBeCloseTo(1.75, 2);
  });

  it('F3-BC5: DataOperationController handles null dataset or unhandled operation gracefully', () => {
    const bus = new WorldEventBus();
    const doc = new DataOperationController({ eventBus: bus });

    expect(() => doc.apply('invalid_op' as any)).not.toThrow();
  });
});
