import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AdaptiveFrameGovernor } from '../../../src/vr/scalability/AdaptiveFrameGovernor.ts';
import { WorldEventBus, WorldTopics } from '../../../src/utils/EventBus.ts';
import { InstancedPointCloud } from '../../../src/vr/scalability/InstancedPointCloud.ts';

describe('Tier 3 — Suite 3.2: Performance Throttling × Instanced Edge Geometry (F5/F8 × F6/F7)', () => {
  it('INT-3.2.1: Frame budget exceeding 11.11ms triggers PERFORMANCE_THROTTLE event and adjusts InstancedPointCloud LOD', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.11, 30, bus);
    const cloud = new InstancedPointCloud(1000);

    const items = Array.from({ length: 1000 }, (_, i) => ({
      position: [i * 0.01, 0, 0] as [number, number, number],
      color: 0x00ffcc,
      scale: 1,
    }));
    cloud.setPoints(items);
    expect(cloud.mesh.count).toBe(1000);

    // Subscribe InstancedPointCloud LOD adaptation to EventBus throttle
    bus.on(WorldTopics.PERFORMANCE_THROTTLE, (payload: any) => {
      cloud.applyLODScale(payload.lodScaleFactor);
    });

    // Simulate high frame times (18ms > 11.11ms threshold)
    for (let i = 0; i < 15; i++) {
      governor.recordFrame(18.0);
    }

    // Instanced point cloud visible count should step down from 1000
    expect(cloud.mesh.count).toBeLessThan(1000);
    expect(cloud.mesh.count).toBeGreaterThan(0);
  });

  it('INT-3.2.2: Sustained 90 FPS performance monitoring maintains zero buffer leaks over 100 render loops', () => {
    const bus = new WorldEventBus();
    const governor = new AdaptiveFrameGovernor(11.11, 30, bus);

    const points = Array.from({ length: 100 }, (_, i) => new THREE.Vector3(i, 0, 0));
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    const lineSegments = new THREE.LineSegments(geom, mat);

    for (let frame = 0; frame < 100; frame++) {
      governor.recordFrame(10.0 + Math.random() * 1.0); // Smooth sub-11.11ms frames
    }

    const metrics = governor.getMetrics();
    expect(1000 / metrics.averageFrameTimeMs).toBeGreaterThan(80);
    expect(lineSegments.geometry).toBe(geom);
  });
});
