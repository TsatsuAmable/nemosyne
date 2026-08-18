// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CanvasTextureCacheManager } from '../src/vr/ui/CanvasTextureCacheManager.ts';

describe('Sprint 14.1: Canvas Texture GPU Re-Upload Caching Suite', () => {
  it('computes deterministic string hashes for UI signatures', () => {
    const hash1 = CanvasTextureCacheManager.computeHash('panel-1:title:cost-10');
    const hash2 = CanvasTextureCacheManager.computeHash('panel-1:title:cost-10');
    const hash3 = CanvasTextureCacheManager.computeHash('panel-1:title:cost-20');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('skips GPU texture upload on unchanged consecutive UI frames', () => {
    const manager = new CanvasTextureCacheManager();
    const canvas = document.createElement('canvas');
    const texture = new THREE.CanvasTexture(canvas);

    // Frame 1: First render -> triggers upload
    const updated1 = manager.shouldUpdateTexture('panel-main', 'title:Dashboard|val:100', texture);
    expect(updated1).toBe(true);

    // Frame 2: Same UI signature -> skips GPU upload
    const updated2 = manager.shouldUpdateTexture('panel-main', 'title:Dashboard|val:100', texture);
    expect(updated2).toBe(false);

    // Frame 3: Same UI signature -> skips GPU upload
    const updated3 = manager.shouldUpdateTexture('panel-main', 'title:Dashboard|val:100', texture);
    expect(updated3).toBe(false);

    const metrics = manager.getMetrics();
    expect(metrics.skipCount).toBe(2);
    expect(metrics.uploadCount).toBe(1);
    expect(metrics.skipRate).toBeGreaterThanOrEqual(0.66);
  });

  it('triggers GPU texture upload when UI signature changes', () => {
    const manager = new CanvasTextureCacheManager();
    const canvas = document.createElement('canvas');
    const texture = new THREE.CanvasTexture(canvas);

    manager.shouldUpdateTexture('panel-main', 'val:10', texture);
    const updated = manager.shouldUpdateTexture('panel-main', 'val:20', texture);

    expect(updated).toBe(true);
  });
});
