/**
 * Biomechanical calibration state and its pure update rule.
 *
 * Threshold adaption is speed-reactive with hysteresis: raw speed feeds an
 * EMA; the effective move threshold is derived deterministically at read time
 * from the EMA (fast hands -> wider threshold), so a single spurious frame
 * cannot flip the threshold and `updateCalibration` never mutates its input.
 */

import type { CalibrationState, HandFrame, HandSample } from './contracts.ts';

const SPEED_ALPHA = 0.2;
const FAST_BAND = 1.5;
const SLOW_BAND = 0.2;
const BAND_HYSTERESIS = 0.15;
const FAST_MULTIPLIER = 1.15;
const SLOW_MULTIPLIER = 0.85;
const PINCH_RELEASE_RATIO = 0.66;

export const BASE_CALIBRATION = {
  moveThreshold: 0.12,
  pinchThreshold: 0.6,
  releaseThreshold: 0.4,
} as const;

export function speedMultiplier(meanSpeedEma: number): number {
  if (meanSpeedEma > FAST_BAND) return FAST_MULTIPLIER;
  if (meanSpeedEma < SLOW_BAND) return SLOW_MULTIPLIER;
  return 1.0;
}

function stickyMultiplier(
  meanSpeedEma: number,
  currentThreshold: number,
  baseMoveThreshold: number
): number {
  const ratio = currentThreshold / baseMoveThreshold;
  const inFast = ratio > 1.01;
  const inSlow = ratio < 0.99;
  if (inFast) {
    if (meanSpeedEma > FAST_BAND - BAND_HYSTERESIS) return FAST_MULTIPLIER;
  } else if (inSlow) {
    if (meanSpeedEma < SLOW_BAND + BAND_HYSTERESIS) return SLOW_MULTIPLIER;
  }
  return speedMultiplier(meanSpeedEma);
}

export function effectiveMoveThreshold(
  state: CalibrationState,
  baseMoveThreshold = BASE_CALIBRATION.moveThreshold
): number {
  return baseMoveThreshold * speedMultiplier(state.meanSpeedEma);
}

export function createCalibrationState(
  overrides: Partial<CalibrationState> = {}
): CalibrationState {
  return {
    moveThreshold: BASE_CALIBRATION.moveThreshold,
    pinchThreshold: BASE_CALIBRATION.pinchThreshold,
    releaseThreshold: BASE_CALIBRATION.releaseThreshold,
    meanSpeedEma: 0,
    updatedAt: 0,
    ...overrides,
  };
}

export function updateCalibration(
  state: CalibrationState,
  sample: HandSample,
  prevFrame: HandFrame | undefined,
  clock: () => number
): CalibrationState {
  let speedMag = 0;
  if (prevFrame) {
    const dtSec = (sample.timestamp - prevFrame.timestamp) / 1000;
    if (dtSec > 0.001) {
      speedMag = Math.hypot(
        (sample.position.x - prevFrame.position.x) / dtSec,
        (sample.position.y - prevFrame.position.y) / dtSec,
        (sample.position.z - prevFrame.position.z) / dtSec
      );
    }
  }
  const ema = state.meanSpeedEma + SPEED_ALPHA * (speedMag - state.meanSpeedEma);
  const multiplier = stickyMultiplier(ema, state.moveThreshold, BASE_CALIBRATION.moveThreshold);
  return {
    meanSpeedEma: ema,
    moveThreshold: BASE_CALIBRATION.moveThreshold * multiplier,
    pinchThreshold: state.pinchThreshold,
    releaseThreshold: state.pinchThreshold * PINCH_RELEASE_RATIO,
    updatedAt: clock(),
  };
}
