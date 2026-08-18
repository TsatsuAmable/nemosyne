// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { HandGestureRecognizer } from '../src/vr/interactions/HandGestureRecognizer.ts';
import trajectoryData from './fixtures/gesture-sequences/trajectories.json';

function makeHand(posArr: number[], pinched: boolean, index: number, handedness: 'left' | 'right', dirArr?: number[]) {
  const pos = new THREE.Vector3(...posArr);
  const dir = new THREE.Vector3(...(dirArr ?? [0, 0, -1]));
  return {
    index,
    handedness,
    rayOrigin: pos,
    rayDirection: dir,
    isPinched: () => pinched,
    getHandTransform(targetPos: THREE.Vector3, targetQuat: THREE.Quaternion) {
      targetPos.copy(pos);
      targetQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    },
  };
}

function replaySequence(recognizer: HandGestureRecognizer, frames: any[]) {
  let detectedGesture: string | null = null;
  recognizer.onGesture = vi.fn((name: string) => {
    if (!detectedGesture) detectedGesture = name;
  });

  for (const frame of frames) {
    const leftHand = makeHand(frame.left.pos, frame.left.pinched, 0, 'left', frame.left.dir);
    const rightHand = makeHand(frame.right.pos, frame.right.pinched, 1, 'right', frame.right.dir);

    recognizer.setHands([leftHand as any, rightHand as any]);
    recognizer.update(0.1, frame.time);
  }

  return detectedGesture;
}

describe('Gesture Recognizer Accuracy & Fixtures Suite', () => {
  const gestures = trajectoryData.gestures as Record<string, any[]>;

  it('correctly classifies pinchTogether trajectory', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    const detected = replaySequence(recognizer, gestures.pinchTogether);
    expect(detected).toBe('pinchTogether');
  });

  it('correctly classifies pinchApart trajectory', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    const detected = replaySequence(recognizer, gestures.pinchApart);
    expect(detected).toBe('pinchApart');
  });

  it('correctly classifies swipeLeft trajectory', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    const detected = replaySequence(recognizer, gestures.swipeLeft);
    expect(detected).toBe('swipeLeft');
  });

  it('correctly classifies swipeRight trajectory', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    const detected = replaySequence(recognizer, gestures.swipeRight);
    expect(detected).toBe('swipeRight');
  });

  it('correctly classifies scoopUp trajectory', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    const detected = replaySequence(recognizer, gestures.scoopUp);
    expect(detected).toBe('scoopUp');
  });

  it('correctly classifies pushForward trajectory', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    const detected = replaySequence(recognizer, gestures.pushForward);
    expect(detected).toBe('pushForward');
  });

  it('meets True Positive (>=90%) accuracy threshold across fixture suite', () => {
    const recognizer = new HandGestureRecognizer({ cooldown: 0 });
    const testCases = Object.entries(gestures);
    let truePositives = 0;

    for (const [expectedName, frames] of testCases) {
      recognizer.reset();
      const detected = replaySequence(recognizer, frames);
      if (detected === expectedName) {
        truePositives++;
      }
    }

    const accuracy = truePositives / testCases.length;
    expect(accuracy).toBeGreaterThanOrEqual(0.90);
  });
});
