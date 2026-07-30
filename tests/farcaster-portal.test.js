import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { FarcasterPortal } from '../src/vr/artifacts/FarcasterPortal.js';

describe('FarcasterPortal', () => {
  let portal;
  let warpCalls;

  beforeEach(() => {
    vi.useFakeTimers();
    warpCalls = [];
    portal = new FarcasterPortal({
      position: [0, 1.6, -2],
      targetZone: 'DEEP_NET',
      targetPosition: [0, 0, -20],
      onWarp: (zone, pos) => warpCalls.push({ zone, pos }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers warp when the head enters its bounding sphere', () => {
    portal.checkTrigger(new THREE.Vector3(0, 1.6, -2));
    expect(warpCalls.length).toBe(1);
    expect(warpCalls[0].zone).toBe('DEEP_NET');
    expect(warpCalls[0].pos).toEqual([0, 0, -20]);
  });

  it('does not trigger warp while cooldown is active', () => {
    portal.checkTrigger(new THREE.Vector3(0, 1.6, -2));
    expect(warpCalls.length).toBe(1);

    portal.checkTrigger(new THREE.Vector3(0, 1.6, -2));
    expect(warpCalls.length).toBe(1);
  });

  it('allows warp again after the cooldown expires', () => {
    portal.checkTrigger(new THREE.Vector3(0, 1.6, -2));
    expect(warpCalls.length).toBe(1);

    vi.advanceTimersByTime(3000);
    portal.checkTrigger(new THREE.Vector3(0, 1.6, -2));
    expect(warpCalls.length).toBe(2);
  });

  it('does not trigger when the head is outside the bounding sphere', () => {
    portal.checkTrigger(new THREE.Vector3(5, 1.6, -2));
    expect(warpCalls.length).toBe(0);
  });

  it('animates the horizon opacity and scale over time', () => {
    const startOpacity = portal.horizonMat.opacity;
    portal.update(0.016, 0);
    portal.update(0.016, 1);
    expect(portal.horizonMat.opacity).not.toBe(startOpacity);
    expect(portal.horizon.scale.x).not.toBe(1);
  });

  it('rotates the ring over time', () => {
    const startZ = portal.ring.rotation.z;
    portal.update(0.1, 0);
    expect(portal.ring.rotation.z).toBeGreaterThan(startZ);
  });

  it('spins the vortex swirl rings when updated', () => {
    expect(portal._swirl.children.length).toBeGreaterThan(0);
    const startZ = portal._swirl.children[0].rotation.z;
    portal.update(0.1, 0);
    expect(portal._swirl.children[0].rotation.z).not.toBe(startZ);
  });

  it('increases ring and horizon pulse when data activity is high', () => {
    portal.update(0.016, 0);
    const lowRingOpacity = portal._sharedRingMaterial.opacity;
    const lowHorizonOpacity = portal.horizonMat.opacity;
    const lowGlowOpacity = portal.glowMat.opacity;

    portal.setDataActivity(1);
    portal.update(0.016, 0);

    expect(portal._sharedRingMaterial.opacity).toBeGreaterThan(lowRingOpacity);
    expect(portal.horizonMat.opacity).toBeGreaterThan(lowHorizonOpacity);
    expect(portal.glowMat.opacity).toBeGreaterThan(lowGlowOpacity);
  });

  it('can recolor the portal to match a theme preset', () => {
    portal.update(0.016, 0);
    portal.setColor(0xff5500);

    expect(portal._sharedRingMaterial.color.getHex()).toBe(0xff5500);
    expect(portal.horizonMat.color.getHex()).toBe(0xff5500);
    expect(portal.glowMat.color.getHex()).toBe(0xff5500);
  });

  it('adds an outer glow halo behind the ring', () => {
    expect(portal.glow).toBeTruthy();
    expect(portal.glow.geometry).toBeTruthy();
    expect(portal.glowMat.blending).toBe(THREE.AdditiveBlending);
  });

  it('passes its registered operation through the warp callback', () => {
    const opPortal = new FarcasterPortal({
      position: [0, 1.6, -2],
      targetZone: 'DEEP_NET',
      targetPosition: [0, 0, -20],
      operation: 'anomaly',
      onWarp: (zone, pos, operation) => warpCalls.push({ zone, pos, operation }),
    });

    opPortal.checkTrigger(new THREE.Vector3(0, 1.6, -2));
    expect(warpCalls.length).toBe(1);
    expect(warpCalls[0].operation).toBe('anomaly');
  });

  it('supports setOperation to change the gate operation', () => {
    expect(portal.operation).toBeNull();
    portal.setOperation('reset');
    expect(portal.operation).toBe('reset');
  });

  it('brightens materials when preview is active', () => {
    portal.update(0.016, 0);
    const lowRingOpacity = portal._sharedRingMaterial.opacity;
    const lowHorizonOpacity = portal.horizonMat.opacity;
    const lowGlowOpacity = portal.glowMat.opacity;

    portal.preview(true);
    portal.update(0.016, 0);

    expect(portal._sharedRingMaterial.opacity).toBeGreaterThan(lowRingOpacity);
    expect(portal.horizonMat.opacity).toBeGreaterThan(lowHorizonOpacity);
    expect(portal.glowMat.opacity).toBeGreaterThan(lowGlowOpacity);
  });
});
