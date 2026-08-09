import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SceneGraphController } from '../src/vr/coordinators/SceneGraphController.ts';
import { WorkspaceManager } from '../src/vr/coordinators/WorkspaceManager.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';

describe('Sprint 17.1: Decomposed SceneGraphController & WorkspaceManager Suite', () => {
  it('initializes Three.js scene, camera, lights, and analyst torso anchor', () => {
    const controller = new SceneGraphController();

    expect(controller.scene).toBeInstanceOf(THREE.Scene);
    expect(controller.cameraGroup).toBeInstanceOf(THREE.Group);
    expect(controller.analystAnchor).toBeInstanceOf(THREE.Group);
    expect(controller.analystAnchor.position.y).toBe(1.35);

    controller.updateAnalystTorsoAnchor(new THREE.Vector3(1, 0, 2), Math.PI / 4);
    expect(controller.analystAnchor.position.x).toBe(1);
    expect(controller.analystAnchor.position.z).toBe(2);
    expect(controller.analystAnchor.rotation.y).toBe(Math.PI / 4);

    controller.dispose();
  });

  it('manages dataset loading and scene graph nodes in WorkspaceManager', () => {
    const scene = new THREE.Scene();
    const workspace = new WorkspaceManager(scene);

    const ds = new Dataset(
      'SalesData',
      [{ name: 'rev', type: ColumnType.NUMERIC }],
      [{ rev: 100 }, { rev: 200 }]
    );

    expect(workspace.getActiveDatasetName()).toBeNull();

    workspace.loadDataset(ds);
    expect(workspace.getActiveDatasetName()).toBe('SalesData');

    workspace.clearDataset();
    expect(workspace.getActiveDatasetName()).toBeNull();
  });
});
