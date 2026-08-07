import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  spawnPinchFilterHalo,
  spawnScoopLensHalo,
  spawnSliceWavePlane,
  spawnResetPulseSphere,
} from '../src/vr/interactions/GestureParticleFeedback.ts';

describe('GestureParticleFeedback', () => {
  let scene: THREE.Scene;
  let pos: THREE.Vector3;

  beforeEach(() => {
    scene = new THREE.Scene();
    pos = new THREE.Vector3(0, 1.2, -1);
  });

  it('spawns a pinch filter halo mesh into the scene', () => {
    const mesh = spawnPinchFilterHalo(scene, pos, { duration: 100 });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(scene.children).toContain(mesh);
    expect(mesh.position.x).toBeCloseTo(0);
    expect(mesh.position.y).toBeCloseTo(1.2);
    expect(mesh.position.z).toBeCloseTo(-1);
  });

  it('spawns a scoop lens halo mesh into the scene', () => {
    const mesh = spawnScoopLensHalo(scene, pos, { duration: 100 });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(scene.children).toContain(mesh);
    expect(mesh.scale.x).toBeCloseTo(0.4);
  });

  it('spawns a slice wave plane mesh into the scene', () => {
    const mesh = spawnSliceWavePlane(scene, pos, 'down', { duration: 100 });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(scene.children).toContain(mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
  });

  it('spawns a reset pulse sphere mesh into the scene', () => {
    const mesh = spawnResetPulseSphere(scene, pos, { duration: 100 });
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(scene.children).toContain(mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
  });
});
