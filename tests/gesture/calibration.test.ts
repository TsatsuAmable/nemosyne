import { describe, expect, it } from 'vitest';
import {
  createCalibrationState,
  effectiveMoveThreshold,
  speedMultiplier,
  updateCalibration,
} from '../../src/gesture/calibration.ts';
import type { HandFrame, HandSample } from '../../src/gesture/contracts.ts';

const clock = () => 1234;

function driveSpeeds(speedsMs: number[]): ReturnType<typeof createCalibrationState> {
  let s = createCalibrationState();
  let prev: HandFrame | undefined;
  let x = 0;
  let t = 0;
  for (const v of speedsMs) {
    const dt = 100;
    x += v * (dt / 1000);
    t += dt;
    const sample: HandSample = {
      hand: 'left',
      position: { x, y: 0, z: 0 },
      pinched: false,
      timestamp: t,
    };
    s = updateCalibration(s, sample, prev, clock);
    prev = { position: sample.position, pinched: false, timestamp: t, speed: { x: 0, y: 0, z: 0 } };
  }
  return s;
}

describe('calibration', () => {
  it('defaults match the documented bases', () => {
    const s = createCalibrationState();
    expect(s.moveThreshold).toBeCloseTo(0.12, 5);
    expect(s.pinchThreshold).toBeCloseTo(0.6, 5);
    expect(s.releaseThreshold).toBeCloseTo(0.4, 5);
    expect(s.meanSpeedEma).toBe(0);
  });

  it('EMA converges toward sustained speed', () => {
    const s = driveSpeeds(new Array(200).fill(2));
    expect(s.meanSpeedEma).toBeCloseTo(2, 1);
  });

  it('never mutates its input', () => {
    const s = createCalibrationState();
    const frozen = JSON.stringify(s);
    updateCalibration(
      s,
      { hand: 'left', position: { x: 0.2, y: 0, z: 0 }, pinched: false, timestamp: 100 },
      { position: { x: 0, y: 0, z: 0 }, pinched: false, timestamp: 0, speed: { x: 0, y: 0, z: 0 } },
      clock
    );
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it('threshold bands apply the documented multipliers', () => {
    expect(speedMultiplier(2.0)).toBeCloseTo(1.15, 5);
    expect(speedMultiplier(0.1)).toBeCloseTo(0.85, 5);
    expect(speedMultiplier(1.0)).toBe(1);
    expect(effectiveMoveThreshold({ ...createCalibrationState(), meanSpeedEma: 2.0 })).toBeCloseTo(
      0.12 * 1.15,
      5
    );
  });

  it('alternating speed bands do not oscillate the threshold', () => {
    const thresholds: number[] = [];
    const speeds: number[] = [];
    for (let i = 1; i <= 40; i++) speeds.push(i % 2 === 0 ? 2 : 0.05);
    let s = createCalibrationState();
    let prev: HandFrame | undefined;
    let x = 0;
    let t = 0;
    for (const v of speeds) {
      x += v * 0.1;
      t += 100;
      const sample: HandSample = { hand: 'left', position: { x, y: 0, z: 0 }, pinched: false, timestamp: t };
      s = updateCalibration(s, sample, prev, clock);
      prev = { position: sample.position, pinched: false, timestamp: t, speed: { x: 0, y: 0, z: 0 } };
      thresholds.push(s.moveThreshold);
    }
    const bigJumps = thresholds
      .slice(1)
      .filter((v, i) => Math.abs(v - thresholds[i]) > 0.011).length;
    expect(bigJumps).toBeLessThanOrEqual(1);
    const tail = thresholds.slice(-10);
    expect(new Set(tail).size).toBe(1);
    expect(Math.max(...thresholds) - Math.min(...thresholds)).toBeGreaterThan(0);
  });

  it('sustained boundary-hovering speed cannot flutter the multiplier', () => {
    const speeds: number[] = [];
    for (let i = 0; i < 60; i++) speeds.push(i % 2 === 0 ? 1.55 : 1.45);
    let s = createCalibrationState();
    let prev: HandFrame | undefined;
    let x = 0;
    let t = 0;
    const seen = new Set<number>();
    for (const v of speeds) {
      x += v * 0.1;
      t += 100;
      const sample: HandSample = { hand: 'left', position: { x, y: 0, z: 0 }, pinched: false, timestamp: t };
      s = updateCalibration(s, sample, prev, clock);
      prev = { position: sample.position, pinched: false, timestamp: t, speed: { x: 0, y: 0, z: 0 } };
      seen.add(s.moveThreshold);
    }
    expect(seen.size).toBeLessThanOrEqual(3);
    const tailThresholds: number[] = [];
    for (let k = 0; k < 15; k++) {
      x += 1.5 * 0.1;
      t += 100;
      const sample: HandSample = { hand: 'left', position: { x, y: 0, z: 0 }, pinched: false, timestamp: t };
      s = updateCalibration(s, sample, prev, clock);
      prev = { position: sample.position, pinched: false, timestamp: t, speed: { x: 0, y: 0, z: 0 } };
      tailThresholds.push(s.moveThreshold);
    }
    expect(new Set(tailThresholds).size).toBe(1);
  });

  it('stamps updatedAt from the injected clock', () => {
    const s = updateCalibration(
      createCalibrationState(),
      { hand: 'left', position: { x: 0.1, y: 0, z: 0 }, pinched: false, timestamp: 100 },
      { position: { x: 0, y: 0, z: 0 }, pinched: false, timestamp: 0, speed: { x: 0, y: 0, z: 0 } },
      clock
    );
    expect(s.updatedAt).toBe(1234);
  });
});
