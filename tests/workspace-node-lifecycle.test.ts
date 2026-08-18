// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorkspaceManager } from '../src/vr/coordinators/WorkspaceManager.ts';

describe('Sprint 19.3: Workspace Node Lifecycle — artifact node management', () => {
  function makeManager(): WorkspaceManager {
    const scene = new THREE.Scene();
    return new WorkspaceManager(scene);
  }

  it('registerArtifactNode adds the node to the datasetNodeGroup and to the artifactNodes map', () => {
    const mgr = makeManager();
    const node = new THREE.Mesh();

    mgr.registerArtifactNode('node-a', node);

    // Should be in the registry
    expect(mgr.artifactNodes.has('node-a')).toBe(true);
    expect(mgr.artifactNodes.get('node-a')).toBe(node);

    // Should be a child of datasetNodeGroup
    expect(mgr.datasetNodeGroup.children).toContain(node);
  });

  it('unregisterArtifactNode removes the node from the scene and from the map', () => {
    const mgr = makeManager();
    const node = new THREE.Mesh();

    mgr.registerArtifactNode('node-b', node);
    expect(mgr.datasetNodeGroup.children).toContain(node);

    mgr.unregisterArtifactNode('node-b');

    expect(mgr.artifactNodes.has('node-b')).toBe(false);
    expect(mgr.datasetNodeGroup.children).not.toContain(node);
  });

  it('unregisterArtifactNode is a no-op for unknown node IDs', () => {
    const mgr = makeManager();
    // Should not throw
    expect(() => mgr.unregisterArtifactNode('nonexistent')).not.toThrow();
  });

  it('clearDataset removes all artifact nodes from the scene and empties the map', () => {
    const mgr = makeManager();
    const nodeA = new THREE.Mesh();
    const nodeB = new THREE.Mesh();

    mgr.registerArtifactNode('art-1', nodeA);
    mgr.registerArtifactNode('art-2', nodeB);
    expect(mgr.artifactNodes.size).toBe(2);

    mgr.clearDataset();

    // Map should be empty
    expect(mgr.artifactNodes.size).toBe(0);
    // Both nodes should be gone from the group
    expect(mgr.datasetNodeGroup.children).not.toContain(nodeA);
    expect(mgr.datasetNodeGroup.children).not.toContain(nodeB);
  });

  it('clearDataset also clears layout group children (existing behavior preserved)', () => {
    const mgr = makeManager();
    const layoutGroup = new THREE.Group();
    // loadDataset triggers clearDataset on subsequent calls
    mgr.loadDataset({ name: 'TestDS', points: [] } as never, layoutGroup);
    expect(mgr.datasetNodeGroup.children).toContain(layoutGroup);

    mgr.clearDataset();
    expect(mgr.datasetNodeGroup.children.length).toBe(0);
  });

  it('getArtifactNode returns the registered node', () => {
    const mgr = makeManager();
    const node = new THREE.Mesh();

    mgr.registerArtifactNode('my-node', node);

    expect(mgr.getArtifactNode('my-node')).toBe(node);
  });

  it('getArtifactNode returns undefined for unregistered IDs', () => {
    const mgr = makeManager();
    expect(mgr.getArtifactNode('ghost')).toBeUndefined();
  });

  it('can register multiple nodes and retrieve each independently', () => {
    const mgr = makeManager();
    const nodeA = new THREE.Mesh();
    const nodeB = new THREE.PointLight();
    const nodeC = new THREE.Group();

    mgr.registerArtifactNode('mesh', nodeA);
    mgr.registerArtifactNode('light', nodeB);
    mgr.registerArtifactNode('group', nodeC);

    expect(mgr.getArtifactNode('mesh')).toBe(nodeA);
    expect(mgr.getArtifactNode('light')).toBe(nodeB);
    expect(mgr.getArtifactNode('group')).toBe(nodeC);
    expect(mgr.datasetNodeGroup.children.length).toBe(3);
  });
});
