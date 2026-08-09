/**
 * Workspace & Dataset Artifact Manager.
 *
 * Encapsulates dataset loading, active topology/layout transitions,
 * visual artifact registrations, and scene graph dataset nodes out of the World monolith.
 */

import * as THREE from 'three';
import { Dataset } from '../../data/Dataset.ts';
import { LayoutBase } from '../layouts/LayoutBase.ts';

export class WorkspaceManager {
  scene: THREE.Scene;
  activeDataset: Dataset | null = null;
  activeLayout: LayoutBase | null = null;
  datasetNodeGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.datasetNodeGroup = new THREE.Group();
    this.datasetNodeGroup.name = 'DatasetNodeGroup';
    this.scene.add(this.datasetNodeGroup);
  }

  loadDataset(dataset: Dataset, layout?: LayoutBase): void {
    this.clearDataset();
    this.activeDataset = dataset;
    this.activeLayout = layout ?? null;

    if (layout) {
      const layoutGroup = layout.getGroup();
      if (layoutGroup) {
        this.datasetNodeGroup.add(layoutGroup);
      }
    }
  }

  clearDataset(): void {
    this.activeDataset = null;
    this.activeLayout = null;
    while (this.datasetNodeGroup.children.length > 0) {
      this.datasetNodeGroup.remove(this.datasetNodeGroup.children[0]);
    }
  }

  getActiveDatasetName(): string | null {
    return this.activeDataset?.name ?? null;
  }
}
