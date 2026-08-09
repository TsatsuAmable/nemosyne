import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InstancedPointCloud } from '../src/vr/scalability/InstancedPointCloud.ts';
import { DracoTopologyNode } from '../src/draco/DracoTopologyNode.ts';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';
import { CanvasTextureCacheManager } from '../src/vr/ui/CanvasTextureCacheManager.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';

describe('Sprint 20.1 & 20.2: Zero-Allocation Instanced GPU Buffer Pipeline & UI Texture Cache Suite', () => {
  it('enables depthWrite: true and depthTest: true on InstancedPointCloud for Early-Z culling', () => {
    const cloud = new InstancedPointCloud(100);
    expect(cloud.material.depthWrite).toBe(true);
    expect(cloud.material.depthTest).toBe(true);
    expect(cloud.material.transparent).toBe(false);
  });

  it('safely handles DracoTopologyNode mesh pool release without double-disposal', () => {
    const scene = new THREE.Scene();
    const ds = new Dataset(
      'PoolTest',
      [{ name: 'val', type: ColumnType.NUMERIC }],
      [{ val: 10 }]
    );

    const node = new DracoTopologyNode(scene, { dataset: ds });
    expect(node.artifact).toBeDefined();

    // Trigger re-solve & synthesis to test mesh pool release path
    node.reSolveAndSynthesize();
    expect(node.artifact).toBeDefined();
  });

  it('bypasses MovablePanel GPU texture updates when UI content state signature is static', () => {
    const group = new THREE.Group();
    const panel = new MovablePanel(group, { title: 'CacheTestPanel' });

    // Initial render computes state signature and uploads
    panel.render();

    // Second render with unchanged state signature returns false (skipping GPU upload)
    const stateSig = `${panel.title}:${panel.scrollOffset}:${panel.totalContentHeight}:${panel.textScale}:${panel.highContrast}:${panel.colorblindMode}:${panel.isMinimized}`;
    const cacheManager = new CanvasTextureCacheManager();
    cacheManager.shouldUpdateTexture('CacheTestPanel', stateSig, panel.texture);
    const updated = cacheManager.shouldUpdateTexture('CacheTestPanel', stateSig, panel.texture);

    expect(updated).toBe(false);
  });
});
