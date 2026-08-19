import { describe, it, expect } from 'vitest';
import { WebXR6DoFPoseRig } from '../dev/spatial-tools/WebXR6DoFPoseRig.ts';

describe('WebXR 6DoF Synthetic Posing & Headset Rig (dev/spatial-tools)', () => {
  it('creates head poses with valid orientation vectors', () => {
    const head = WebXR6DoFPoseRig.createHeadPose(0, 1.6, 0, 0, 0, 0);
    expect(head.position.y).toBe(1.6);
    expect(head.forward.z).toBeCloseTo(-1, 2);
    expect(head.forward.x).toBeCloseTo(0, 2);
  });

  it('rotates head forward vector with yaw and pitch', () => {
    // Yaw 90 degrees to the right (looking towards +X)
    const headYawRight = WebXR6DoFPoseRig.createHeadPose(0, 1.6, 0, 0, 90, 0);
    expect(headYawRight.forward.x).toBeCloseTo(-1, 1); // Three.js YXZ Euler rotation

    // Pitch 45 degrees up
    const headPitchUp = WebXR6DoFPoseRig.createHeadPose(0, 1.6, 0, 45, 0, 0);
    expect(headPitchUp.forward.y).toBeGreaterThan(0.5);
  });

  it('provides ergonomic testing presets', () => {
    const standing = WebXR6DoFPoseRig.PRESETS.STANDING_NATURAL();
    expect(standing.head.position.y).toBe(1.6);
    expect(standing.rightHand.side).toBe('right');
    expect(standing.leftHand.side).toBe('left');

    const pinch = WebXR6DoFPoseRig.PRESETS.PINCH_INTERACTION();
    expect(pinch.rightHand.isPinching).toBe(true);
    expect(pinch.rightHand.pinchConfidence).toBeGreaterThan(0.9);
  });
});
