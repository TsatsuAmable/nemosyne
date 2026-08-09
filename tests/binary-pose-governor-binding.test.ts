import { describe, it, expect } from 'vitest';
import { BinaryPoseSerializer, type CameraPose } from '../src/network/BinaryPoseSerializer.ts';
import { InstancedPointCloud } from '../src/vr/scalability/InstancedPointCloud.ts';

describe('Sprint 17.3 & 17.4: Binary Pose Streaming & Governor Scene Binding Suite', () => {
  it('serializes and deserializes CameraPose to/from 32-byte ArrayBuffer', () => {
    const original: CameraPose = {
      sequence: 1042,
      position: [1.2, 1.6, -0.5],
      rotation: [0, 0.707, 0, 0.707],
    };

    const buffer = BinaryPoseSerializer.serialize(original);
    expect(buffer.byteLength).toBe(32);

    const restored = BinaryPoseSerializer.deserialize(buffer);
    expect(restored).not.toBeNull();
    expect(restored?.sequence).toBe(1042);
    expect(restored?.position[0]).toBeCloseTo(1.2);
    expect(restored?.position[1]).toBeCloseTo(1.6);
    expect(restored?.rotation[1]).toBeCloseTo(0.707);
  });

  it('reactively scales InstancedPointCloud visible instance count when governor LOD factor drops', () => {
    const cloud = new InstancedPointCloud(100);
    const items = Array.from({ length: 100 }, (_, i) => ({
      position: [i * 0.1, 0, 0] as [number, number, number],
      color: 0x00ffcc,
    }));

    cloud.setPoints(items);
    expect(cloud.mesh.count).toBe(100);

    // Apply 50% LOD scaling from AdaptiveFrameGovernor
    cloud.applyLODScale(0.5);
    expect(cloud.mesh.count).toBe(50);
  });
});
