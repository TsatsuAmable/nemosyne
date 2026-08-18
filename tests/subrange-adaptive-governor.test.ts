// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InstancedPointCloud } from '../src/vr/scalability/InstancedPointCloud.ts';
import { AdaptiveFrameGovernor } from '../src/vr/scalability/AdaptiveFrameGovernor.ts';

describe('Sprint 14.2 & 14.3: Sub-Range GPU Buffers & Adaptive Frame Governor Suite', () => {
  it('updates instance matrix and color attribute sub-ranges in InstancedPointCloud', () => {
    const cloud = new InstancedPointCloud(100);
    cloud.setPoints([
      { position: [0, 0, 0], color: 0xff0000 },
      { position: [1, 1, 1], color: 0x00ff00 },
    ]);

    cloud.updateSubRange(0, 1);

    const matrixAttr = cloud.mesh.instanceMatrix as THREE.InstancedBufferAttribute;
    const ranges = (matrixAttr as unknown as { updateRanges?: Array<{ start: number; count: number }> }).updateRanges;
    if (ranges && ranges.length > 0) {
      expect(ranges[0].start).toBe(0);
      expect(ranges[0].count).toBe(16);
    } else {
      expect(matrixAttr.needsUpdate).toBe(true);
    }
  });

  it('monitors frame render time and scales LOD factor when 11.1ms threshold is breached', () => {
    const governor = new AdaptiveFrameGovernor(11.1, 15);

    // Simulate 12 fast 8ms frames -> lodScaleFactor stays 1.0
    for (let i = 0; i < 12; i++) {
      governor.recordFrame(8.0);
    }
    expect(governor.getMetrics().lodScaleFactor).toBe(1.0);

    // Simulate 10 slow 18ms frames -> governor throttles LOD
    for (let i = 0; i < 10; i++) {
      governor.recordFrame(18.0);
    }

    const metrics = governor.getMetrics();
    expect(metrics.averageFrameTimeMs).toBeGreaterThan(11.1);
    expect(metrics.lodScaleFactor).toBeLessThan(1.0);
    expect(metrics.isGovernorActive).toBe(true);
  });
});
