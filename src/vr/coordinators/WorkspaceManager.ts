/**
 * Workspace & Dataset Artifact Manager.
 *
 * Encapsulates dataset loading, active topology/layout transitions,
 * visual artifact registrations, and scene graph dataset nodes out of the World monolith.
 *
 * Sprint 19.3: Added artifact node lifecycle management (registerArtifactNode,
 * unregisterArtifactNode, getArtifactNode). clearDataset() now also unregisters
 * all artifact nodes, ensuring complete scene graph cleanup on dataset transitions.
 */

import * as THREE from 'three';
import { Dataset } from '../../data/Dataset.ts';

export class WorkspaceManager {
  scene: THREE.Scene;
  activeDataset: Dataset | null = null;
  activeLayoutGroup: THREE.Object3D | null = null;
  datasetNodeGroup: THREE.Group;
  artifactNodes: Map<string, THREE.Object3D> = new Map();

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
    // Unregister all artifact nodes before clearing the group
    for (const nodeId of Array.from(this.artifactNodes.keys())) {
      this.unregisterArtifactNode(nodeId);
    }

    this.activeDataset = null;
    this.activeLayoutGroup = null;
    while (this.datasetNodeGroup.children.length > 0) {
      this.datasetNodeGroup.remove(this.datasetNodeGroup.children[0]);
    }
  }

  getActiveDatasetName(): string | null {
    return this.activeDataset?.name ?? null;
  }

  /**
   * Register a Three.js Object3D as a named artifact node.
   * The node is added to the datasetNodeGroup so it participates in dataset lifecycle.
   */
  registerArtifactNode(nodeId: string, node: THREE.Object3D): void {
    this.artifactNodes.set(nodeId, node);
    this.datasetNodeGroup.add(node);
  }

  /**
   * Remove a named artifact node from the scene and the registry.
   */
  unregisterArtifactNode(nodeId: string): void {
    const node = this.artifactNodes.get(nodeId);
    if (node) {
      this.datasetNodeGroup.remove(node);
      this.artifactNodes.delete(nodeId);
    }
  }

  /**
   * Retrieve a registered artifact node by its ID, or undefined if not found.
   */
  getArtifactNode(nodeId: string): THREE.Object3D | undefined {
    return this.artifactNodes.get(nodeId);
  }
}
