// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FarcasterPortal } from '../src/vr/artifacts/FarcasterPortal.ts';

describe('Sprint 13.1: Farcaster Dimensionality Teleportation Engine', () => {
  let portal: FarcasterPortal;

  beforeEach(() => {
    portal = new FarcasterPortal({
      position: [0, 1.6, -2],
      targetZone: 'TDA_DEEP_ZONE',
      targetPosition: [0, 1.6, -10],
      currentDimension: '2D_TABULAR',
      targetDimension: 'TDA_MAPPER',
    });
  });

  it('instantiates FarcasterPortal with target and current dimension modes', () => {
    expect(portal).toBeDefined();
    expect(portal.currentDimension).toBe('2D_TABULAR');
    expect(portal.targetDimension).toBe('TDA_MAPPER');
  });

  it('warps perspective across dimensions seamlessly', () => {
    let warpedDimensionResult = false;
    portal.onDimensionWarp = (res) => {
      expect(res.fromDimension).toBe('2D_TABULAR');
      expect(res.toDimension).toBe('3D_SPATIAL');
      warpedDimensionResult = true;
    };

    const res = portal.warpDimension('3D_SPATIAL');
    expect(res.toDimension).toBe('3D_SPATIAL');
    expect(portal.currentDimension).toBe('3D_SPATIAL');
    expect(warpedDimensionResult).toBe(true);
  });

  it('initiates spatial terrain travel to map coordinates', () => {
    let travelPosition: THREE.Vector3 | undefined;
    portal.onDimensionWarp = (res) => {
      travelPosition = res.targetPosition;
    };

    const res = portal.initiateFarcasterTravel({
      x: 12.5,
      y: 3.0,
      z: -45.0,
      label: 'Cluster Alpha Anomaly',
    });

    expect(res.mapCoordinate?.label).toBe('Cluster Alpha Anomaly');
    expect(travelPosition?.x).toBe(12.5);
    expect(travelPosition?.z).toBe(-45.0);
  });

  it('triggers dimension warp when analyst head position enters bounding sphere', () => {
    let triggered = false;
    portal.onWarp = () => {
      triggered = true;
    };

    const headWorldPos = new THREE.Vector3(0, 1.6, -2);
    portal.checkTrigger(headWorldPos);
    expect(triggered).toBe(true);
    expect(portal.currentDimension).toBe('TDA_MAPPER');
  });
});
