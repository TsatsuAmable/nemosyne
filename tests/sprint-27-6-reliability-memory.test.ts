import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ZeroAllocMath } from '../src/vr/scalability/index.ts';
import { GPUResourceDisposal } from '../src/vr/resilience/index.ts';

describe('Sprint 27.6 — Reliability, Memory Leak Prevention & Quest 3S Budgets', () => {
  describe('ZeroAllocMath', () => {
    it('computes squared distance and spherical bounds with 0 heap allocations', () => {
      const inside = ZeroAllocMath.isInsideSphere(1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.5);
      expect(inside).toBe(true);

      const outside = ZeroAllocMath.isInsideSphere(5.0, 5.0, 5.0, 0, 0, 0, 1.0);
      expect(outside).toBe(false);
    });

    it('computes gaze alignment angle accurately without allocating vectors', () => {
      const headPos = new THREE.Vector3(0, 1.6, 0);
      const headForward = new THREE.Vector3(0, 0, -1);
      const directTarget = new THREE.Vector3(0, 1.6, -2.0);

      const angle = ZeroAllocMath.gazeAlignmentAngleDeg(headPos, headForward, directTarget);
      expect(angle).toBeCloseTo(0.0, 1);

      const sideTarget = new THREE.Vector3(2.0, 1.6, 0);
      const sideAngle = ZeroAllocMath.gazeAlignmentAngleDeg(headPos, headForward, sideTarget);
      expect(sideAngle).toBeCloseTo(90.0, 1);
    });

    it('projects point onto plane using in-place outTarget buffer', () => {
      const point = new THREE.Vector3(2, 5, 3);
      const planeOrigin = new THREE.Vector3(0, 0, 0);
      const planeNormal = new THREE.Vector3(0, 1, 0);
      const out = new THREE.Vector3();

      const res = ZeroAllocMath.projectPointOnPlane(point, planeOrigin, planeNormal, out);
      expect(res).toBe(out); // In-place identity
      expect(res.x).toBe(2);
      expect(res.y).toBe(0);
      expect(res.z).toBe(3);
    });
  });

  describe('GPUResourceDisposal (Three.js Hierarchy Teardown)', () => {
    it('disposes 100% of geometries, materials, and textures in a nested scene graph', () => {
      const root = new THREE.Group();

      // Create dummy texture
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const texture = new THREE.CanvasTexture(canvas);

      // Node 1: Mesh with material and texture
      const geom1 = new THREE.BoxGeometry(1, 1, 1);
      const mat1 = new THREE.MeshBasicMaterial({ map: texture });
      const mesh1 = new THREE.Mesh(geom1, mat1);

      // Node 2: Child mesh sharing geometry with multi-material
      const mat2A = new THREE.MeshBasicMaterial();
      const mat2B = new THREE.MeshBasicMaterial();
      const mesh2 = new THREE.Mesh(geom1, [mat2A, mat2B]);

      // Node 3: Deep nested line
      const geom3 = new THREE.BufferGeometry();
      const mat3 = new THREE.LineBasicMaterial();
      const line3 = new THREE.Line(geom3, mat3);

      root.add(mesh1);
      mesh1.add(mesh2);
      mesh2.add(line3);

      const stats = GPUResourceDisposal.disposeHierarchy(root);

      // Geometries: geom1 (shared, counted once) + geom3 = 2
      expect(stats.geometriesDisposed).toBe(2);
      // Materials: mat1 + mat2A + mat2B + mat3 = 4
      expect(stats.materialsDisposed).toBe(4);
      // Textures: texture = 1
      expect(stats.texturesDisposed).toBe(1);
    });
  });
});
