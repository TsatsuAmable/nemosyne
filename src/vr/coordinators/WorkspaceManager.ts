/**
 * Workspace & Dataset Artifact Manager.
 *
 * Encapsulates dataset loading, active topology/layout transitions,
 * visual artifact registrations, and scene graph dataset nodes out of the World monolith.
 */

import * as THREE from 'three';
import { Dataset } from '../../data/Dataset.ts';

export class WorkspaceManager {
  scene: THREE.Scene;
  activeDataset: Dataset | null = null;
  activeLayoutGroup: THREE.Object3D | null = null;
  datasetNodeGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.datasetNodeGroup = new THREE.Group();
    this.datasetNodeGroup.name = 'DatasetNodeGroup';
    this.scene.add(this.datasetNodeGroup);
  }

  loadDataset(dataset: Dataset, layoutGroup?: THREE.Object3D): void {
    this.clearDataset();
    this.activeDataset = dataset;
    this.activeLayoutGroup = layoutGroup ?? null;

    if (layoutGroup) {
      this.datasetNodeGroup.add(layoutGroup);
    }
  }

  clearDataset(): void {
    this.activeDataset = null;
    this.activeLayoutGroup = null;
    while (this.datasetNodeGroup.children.length > 0) {
      this.datasetNodeGroup.remove(this.datasetNodeGroup.children[0]);
    }
  }

  getActiveDatasetName(): string | null {
    return this.activeDataset?.name ?? null;
  }
}
