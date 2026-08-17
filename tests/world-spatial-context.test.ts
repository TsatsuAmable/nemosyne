import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldSpatialContext } from '../src/vr/trace/WorldSpatialContext.ts';

describe('WorldSpatialContext', () => {
  it('classifies spatial zones based on head position', () => {
    const ctx = new WorldSpatialContext();

    expect(ctx.classifyZone(new THREE.Vector3(0, 1.6, 0))).toBe('CENTRAL_PLAZA');
    expect(ctx.classifyZone(new THREE.Vector3(6, 4, -8))).toBe('TECHNOCORE_SECTOR');
    expect(ctx.classifyZone(new THREE.Vector3(-3, 1.6, -2))).toBe('FARCASTER_GATEWAY');
    expect(ctx.classifyZone(new THREE.Vector3(0, 1.5, -3))).toBe('ICE_VAULT_SECTOR');
    expect(ctx.classifyZone(new THREE.Vector3(50, 1.6, 50))).toBe('OUTER_HORIZON');
  });

  it('computes landmark bearing, distance, and elevation accurately', () => {
    const ctx = new WorldSpatialContext();
    const headPos = new THREE.Vector3(0, 1.6, 0);
    const headDir = new THREE.Vector3(0, 0, -1); // looking forward along -Z

    const metrics = ctx.computeLandmarkMetrics(headPos, headDir, {
      name: 'TestTarget',
      position: [0, 1.6, -5],
    });

    expect(metrics.name).toBe('TestTarget');
    expect(metrics.distance).toBe(5);
    expect(metrics.bearingDeg).toBeCloseTo(0, 1);
    expect(metrics.elevationDeg).toBeCloseTo(0, 1);
  });

  it('evaluates sweet-spot ergonomic reach zone in front of user', () => {
    const ctx = new WorldSpatialContext();
    const headPos = new THREE.Vector3(0, 1.6, 0);
    const headDir = new THREE.Vector3(0, 0, -1);
    // Hand placed at chest level in forward sweet spot
    const handPos = new THREE.Vector3(0.1, 1.35, -0.45);

    const ergo = ctx.evaluateHandErgonomics(headPos, headDir, handPos, 'right');

    expect(ergo.handedness).toBe('right');
    expect(ergo.reachZone).toBe('SWEET_SPOT');
    expect(ergo.elevation).toBe('CHEST_LEVEL');
    expect(ergo.ergonomicScore).toBeGreaterThanOrEqual(80);
    expect(ergo.troubleshootingFlag).toBe('NONE');
  });

  it('detects near-field tracking jitter and peripheral blindspot', () => {
    const ctx = new WorldSpatialContext();
    const headPos = new THREE.Vector3(0, 1.6, 0);
    const headDir = new THREE.Vector3(0, 0, -1);

    // Hand too close to face/head (<0.22m)
    const nearHand = new THREE.Vector3(0.05, 1.55, -0.15);
    const nearErgo = ctx.evaluateHandErgonomics(headPos, headDir, nearHand, 'right');
    expect(nearErgo.reachZone).toBe('NEAR_FIELD');
    expect(nearErgo.troubleshootingFlag).toBe('NEAR_FIELD_TRACKING_JITTER');

    // Hand in peripheral blindspot (far sideways)
    const periphHand = new THREE.Vector3(1.2, 1.2, 0);
    const periphErgo = ctx.evaluateHandErgonomics(headPos, headDir, periphHand, 'right');
    expect(periphErgo.reachZone).toBe('PERIPHERAL');
    expect(periphErgo.troubleshootingFlag).toBe('PERIPHERAL_CAMERA_BLINDSPOT');
  });

  it('flags excessive aim drift during gesture interaction', () => {
    const ctx = new WorldSpatialContext();
    const headPos = new THREE.Vector3(0, 1.6, 0);
    const headDir = new THREE.Vector3(0, 0, -1);
    const handPos = new THREE.Vector3(0.2, 1.4, -0.6);

    const ergo = ctx.evaluateHandErgonomics(headPos, headDir, handPos, 'right', 35); // 35 deg drift
    expect(ergo.troubleshootingFlag).toBe('AIM_DRIFT_EXCESSIVE');
  });

  it('builds a complete spatial telemetry snapshot', () => {
    const ctx = new WorldSpatialContext();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);

    const snapshot = ctx.buildSnapshot(
      camera,
      undefined,
      [{ pos: new THREE.Vector3(0.15, 1.35, -0.45), handedness: 'right' }],
      5.0
    );

    expect(snapshot.zone).toBe('CENTRAL_PLAZA');
    expect(snapshot.nearestLandmark).toBeDefined();
    expect(snapshot.landmarks.length).toBeGreaterThan(0);
    expect(snapshot.ergonomics.right).toBeDefined();
    expect(snapshot.ergonomics.right.reachZone).toBe('SWEET_SPOT');
  });
});
