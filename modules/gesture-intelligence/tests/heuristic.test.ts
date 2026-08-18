import { describe, expect, it } from 'vitest';
import { classifyHeuristic, idleConfidence } from '../src/heuristic.ts';
import { createCalibrationState } from '../src/calibration.ts';
import { GESTURE_CLASSES, type GestureClass } from '../src/contracts.ts';

function featuresFor(gesture: GestureClass, magnitude = 0.3): Float32Array {
  const f = new Float32Array(56);
  
  switch (gesture) {
    case 'pinchTogether': {
      f[19] = 0.9;
      f[39] = 0.9;
      f[40] = Math.min(0.6, 1);
      f[55] = Math.min(0.6 - magnitude, 1);
      break;
    }
    case 'pinchApart': {
      f[19] = 0.9;
      f[39] = 0.9;
      f[40] = Math.min(0.3, 1);
      f[55] = Math.min(0.3 + magnitude, 1);
      break;
    }
    case 'bothPinched': {
      f[19] = 1;
      f[39] = 1;
      f[40] = 0.5;
      f[55] = 0.51;
      break;
    }
    case 'scoopUp': {
      f[17] = Math.min(magnitude / 0.5, 1);
      f[37] = Math.min(magnitude / 0.5, 1);
      break;
    }
    case 'pushForward': {
      f[18] = -Math.min(magnitude / 0.5, 1);
      f[38] = -Math.min(magnitude / 0.5, 1);
      break;
    }
    default: {
      f[19] = 0;
      f[39] = 0;
      f[40] = 0.5;
      f[55] = 0.5;
    }
  }
  return f;
}

describe('classifyHeuristic', () => {
  const cal = createCalibrationState();

  it('covers every gesture class happy path', () => {
    const cases: [GestureClass, GestureClass][] = [
      ['pinchTogether', 'pinchTogether'],
      ['pinchApart', 'pinchApart'],
      ['bothPinched', 'bothPinched'],
      ['scoopUp', 'scoopUp'],
      ['pushForward', 'pushForward'],
      ['idle', 'idle'],
    ];
    for (const [input, expected] of cases) {
      const v = classifyHeuristic(featuresFor(input), cal);
      expect(v.gesture, `gesture ${input}`).toBe(expected);
    }
  });

  it('confidence is margin-derived, not constant', () => {
    const small = classifyHeuristic(featuresFor('pinchTogether', 0.15), cal);
    const large = classifyHeuristic(featuresFor('pinchTogether', 0.35), cal);
    expect(small.confidence).toBeGreaterThan(0);
    expect(large.confidence).toBeGreaterThan(small.confidence);
  });

  it('pinched pair takes precedence over vertical/forward', () => {
    const f = featuresFor('pinchTogether', 0.3);
    f[17] = 0.8;
    f[37] = 0.8;
    f[18] = -0.8;
    f[38] = -0.8;
    expect(classifyHeuristic(f, cal).gesture).toBe('pinchTogether');
  });

  it('single-hand pinch does not trigger pinch gestures', () => {
    const f = featuresFor('pinchTogether', 0.3);
    f[39] = 0.1;
    expect(classifyHeuristic(f, cal).gesture).toBe('idle');
  });

  it('idle confidence anticorrelates with trigger strength', () => {
    expect(idleConfidence(0)).toBe(1);
    expect(idleConfidence(1)).toBe(0);
    expect(idleConfidence(0.9)).toBeCloseTo(0.1, 5);
  });

  it('scoop below move threshold stays idle', () => {
    const v = classifyHeuristic(featuresFor('scoopUp', 0.05), cal);
    expect(v.gesture).toBe('idle');
  });

  it('respects a wider personalized move threshold', () => {
    const wide = createCalibrationState({ moveThreshold: 0.3 });
    expect(classifyHeuristic(featuresFor('scoopUp', 0.2), wide).gesture).toBe('idle');
    expect(classifyHeuristic(featuresFor('scoopUp', 0.2), cal).gesture).toBe('scoopUp');
  });

  it('bothPinched requires stillness', () => {
    const f = featuresFor('bothPinched');
    for (let i = 0; i < 16; i++) {
      f[i] = 0.5;
      f[20 + i] = 0.5;
    }
    expect(classifyHeuristic(f, cal).gesture).not.toBe('bothPinched');
  });

  it('GESTURE_CLASSES order matches the frozen contract', () => {
    expect(GESTURE_CLASSES).toEqual([
      'idle',
      'pinchTogether',
      'pinchApart',
      'scoopUp',
      'pushForward',
      'bothPinched',
    ]);
  });
});
