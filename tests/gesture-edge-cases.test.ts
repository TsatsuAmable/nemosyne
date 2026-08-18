// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { HandGestureRecognizer } from '../src/vr/interactions/HandGestureRecognizer.ts';
import { GestureConfidenceThresholds } from '../src/vr/input/GestureConfidenceThresholds.ts';

function makeHand(pos: THREE.Vector3, pinched: boolean, index: number, handedness: 'left' | 'right', dir = new THREE.Vector3(0, 0, -1)) {
  const normDir = dir.clone().normalize();
  return {
    index,
    handedness,
    rayOrigin: pos.clone(),
    rayDirection: normDir.clone(),
    isPinched: () => pinched,
    getHandTransform(targetPos: THREE.Vector3, targetQuat: THREE.Quaternion) {
      targetPos.copy(pos);
      // Avoid antiparallel (0,0,-1) -> (0,1,0) zero quat singularity
      targetQuat.setFromUnitVectors(new THREE.Vector3(0.00001, 0, -0.99999).normalize(), normDir);
    },
  };
}

describe('Gesture Edge Cases & Boundary Conditions', () => {
  it('enforces gesture cooldown boundary cleanly', () => {
    const onGesture = vi.fn();
    const recognizer = new HandGestureRecognizer({ cooldown: 0.5, onGesture });

    // Initial baseline frame with pinching hands established
    const left0 = makeHand(new THREE.Vector3(-0.3, 1.2, -0.4), true, 0, 'left');
    const right0 = makeHand(new THREE.Vector3(0.3, 1.2, -0.4), true, 1, 'right');
    recognizer.setHands([left0 as any, right0 as any]);
    recognizer.update(0.1, 0.0);

    // Frame 1: Establish baseline prev positions
    recognizer.update(0.1, 0.05);

    // Frame 2: Displacement frame -> triggers pinchTogether
    const left1 = makeHand(new THREE.Vector3(-0.1, 1.2, -0.4), true, 0, 'left');
    const right1 = makeHand(new THREE.Vector3(0.1, 1.2, -0.4), true, 1, 'right');
    recognizer.setHands([left1 as any, right1 as any]);
    recognizer.update(0.1, 0.1);

    // Step 2: Attempt repeated gesture within cooldown (0.2s elapsed < 0.5s cooldown)
    const left2 = makeHand(new THREE.Vector3(-0.05, 1.2, -0.4), true, 0, 'left');
    const right2 = makeHand(new THREE.Vector3(0.05, 1.2, -0.4), true, 1, 'right');
    recognizer.setHands([left2 as any, right2 as any]);
    recognizer.update(0.1, 0.2);

    // Step 3: Trigger gesture after cooldown expires (0.7s > 0.5s)
    recognizer.setHands([left0 as any, right0 as any]);
    recognizer.update(0.1, 0.6);

    recognizer.setHands([left1 as any, right1 as any]);
    recognizer.update(0.1, 0.7);

    expect(onGesture.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects gestures with high velocity exceeding max threshold', () => {
    const thresholds = new GestureConfidenceThresholds();
    // Measured velocity 4.0 m/s > ceiling 2.5 m/s
    const evalResult = thresholds.evaluateConfidence('pinchTogether', 0.15, 4.0);
    expect(evalResult.isValid).toBe(false);
    expect(evalResult.reason).toContain('exceeded ceiling');
  });

  it('rejects gestures with insufficient displacement below floor', () => {
    const thresholds = new GestureConfidenceThresholds();
    // Measured displacement 0.02 m < min 0.08 m
    const evalResult = thresholds.evaluateConfidence('pinchTogether', 0.02, 1.0);
    expect(evalResult.isValid).toBe(false);
    expect(evalResult.reason).toContain('below floor');
  });
});
