/**
 * Heuristic gesture classifier operating on the shared 56-dim feature vector
 * (same substrate as the neural path). Confidence values are always derived
 * from measured margins — never constants.
 */

import { GESTURE_CLASSES, type CalibrationState, type GestureClass } from './contracts.ts';

export interface HeuristicVerdict {
  gesture: GestureClass;
  confidence: number;
  triggerStrength: number;
}

const DISPLACEMENT_SCALE = 0.5;
const DISTANCE_SCALE = 1.0;
const STILL_SPEED = 0.15;

function deNormDisplacement(v: number): number {
  return v * DISPLACEMENT_SCALE;
}

function deNormDistance(v: number): number {
  return v * DISTANCE_SCALE;
}

function meanWindowSpeed(features: Float32Array, offset: number): number {
  let sum = 0;
  for (let i = 0; i < 16; i++) sum += features[offset + i];
  return (sum / 16) * 2;
}

export function classifyHeuristic(
  features: Float32Array,
  calibration: CalibrationState
): HeuristicVerdict {
  const leftPinchFraction = features[19];
  const rightPinchFraction = features[39];
  const leftPinchHeld = leftPinchFraction >= calibration.pinchThreshold;
  const rightPinchHeld = rightPinchFraction >= calibration.pinchThreshold;

  const distStart = deNormDistance(features[40]);
  const distEnd = deNormDistance(features[55]);
  const delta = distEnd - distStart;

  const leftDy = deNormDisplacement(features[17]);
  const leftDz = deNormDisplacement(features[18]);
  const rightDy = deNormDisplacement(features[37]);
  const rightDz = deNormDisplacement(features[38]);

  const leftSpeed = meanWindowSpeed(features, 0);
  const rightSpeed = meanWindowSpeed(features, 20);
  const meanSpeed = (leftSpeed + rightSpeed) / 2;

  const move = calibration.moveThreshold;
  const candidates: { gesture: GestureClass; strength: number; confidence: number }[] = [];

  if (leftPinchHeld && rightPinchHeld) {
    if (delta < -move) {
      candidates.push({
        gesture: 'pinchTogether',
        strength: Math.min(Math.abs(delta) / (2 * move), 1),
        confidence: Math.min(Math.abs(delta) / (2 * move), 1),
      });
    } else if (delta > move) {
      candidates.push({
        gesture: 'pinchApart',
        strength: Math.min(delta / (2 * move), 1),
        confidence: Math.min(delta / (2 * move), 1),
      });
    } else if (Math.abs(delta) < move * 0.5 && meanSpeed < STILL_SPEED) {
      const pinchSupport = (leftPinchFraction + rightPinchFraction) / 2;
      const stillness = 1 - Math.min(meanSpeed / STILL_SPEED, 1);
      candidates.push({
        gesture: 'bothPinched',
        strength: pinchSupport * stillness,
        confidence: pinchSupport * (0.5 + 0.5 * stillness),
      });
    }
  }

  const riseTogether = Math.min(leftDy, rightDy);
  if (riseTogether > move) {
    const strength = Math.min(riseTogether / (2 * move), 1);
    candidates.push({ gesture: 'scoopUp', strength, confidence: strength });
  }

  const pushTogether = Math.min(-leftDz, -rightDz);
  if (pushTogether > move) {
    const strength = Math.min(pushTogether / (2 * move), 1);
    candidates.push({ gesture: 'pushForward', strength, confidence: strength });
  }

  if (candidates.length === 0) {
    return { gesture: 'idle', confidence: 0, triggerStrength: 0 };
  }

  candidates.sort((a, b) => b.strength - a.strength);
  const best = candidates[0];
  return {
    gesture: best.gesture,
    confidence: Math.min(Math.max(best.confidence, 0), 1),
    triggerStrength: best.strength,
  };
}

export function idleConfidence(triggerStrength: number): number {
  return Math.min(Math.max(1 - triggerStrength, 0), 1);
}

export { GESTURE_CLASSES };
