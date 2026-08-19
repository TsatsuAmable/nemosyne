import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { WebGLContextRecovery, DiegeticErrorBoundary } from '../src/vr/resilience/index.ts';
import { GeometricGestureRecognizer } from '../src/vr/perception/index.ts';

describe('Sprint 27.4 — WebGL Context Recovery, Diegetic Error Boundary & Geometric Gestures', () => {
  describe('WebGLContextRecovery', () => {
    it('catches context lost, prevents default, and restores state via delegate', async () => {
      const canvas = document.createElement('canvas');
      let lostCalled = false;
      let restoredCalled = false;

      const recovery = new WebGLContextRecovery(canvas, {
        onContextLost: () => {
          lostCalled = true;
        },
        onContextRestored: async () => {
          restoredCalled = true;
        },
      });

      expect(recovery.state).toBe('active');
      expect(recovery.recoveryCount).toBe(0);

      const success = await recovery.simulateContextLossAndRecovery(5);

      expect(lostCalled).toBe(true);
      expect(restoredCalled).toBe(true);
      expect(success).toBe(true);
      expect(recovery.state).toBe('active');
      expect(recovery.recoveryCount).toBe(1);

      recovery.dispose();
    });
  });

  describe('DiegeticErrorBoundary', () => {
    it('creates floating recovery card at comfortable VR distance and cleans up on dismiss', () => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      camera.position.set(0, 1.6, 0);

      const onReload = vi.fn();
      const onRollback = vi.fn();
      const onDiagnostic = vi.fn();

      const boundary = new DiegeticErrorBoundary(scene, camera, {
        onReloadRequested: onReload,
        onRollbackRequested: onRollback,
        onDiagnosticExport: onDiagnostic,
      });

      expect(boundary.isDisplayingError).toBe(false);

      const testError = new Error('Simulated WebGL Buffer Overflow');
      boundary.catchError(testError);

      expect(boundary.isDisplayingError).toBe(true);
      expect(boundary.activeError).toBe(testError);
      expect(onDiagnostic).toHaveBeenCalledWith(testError);

      // Verify panel in scene
      const panel = scene.getObjectByName('diegetic-error-card');
      expect(panel).toBeDefined();
      expect(panel?.position.z).toBeCloseTo(-1.1, 1);

      boundary.triggerRollback();
      expect(onRollback).toHaveBeenCalled();
      expect(boundary.isDisplayingError).toBe(false);
      expect(scene.getObjectByName('diegetic-error-card')).toBeUndefined();

      boundary.dispose();
    });
  });

  describe('GeometricGestureRecognizer ($3D 1-Shot Matching)', () => {
    it('accurately classifies swipe-right trajectory and distinguishes from vertical swipe', () => {
      const recognizer = new GeometricGestureRecognizer();

      // Register swipe right template
      recognizer.addTemplate('swipe_right', [
        { x: 0.0, y: 0.0, z: 0.0 },
        { x: 0.1, y: 0.0, z: 0.0 },
        { x: 0.2, y: 0.0, z: 0.0 },
        { x: 0.3, y: 0.0, z: 0.0 },
      ]);

      // Register swipe up template
      recognizer.addTemplate('swipe_up', [
        { x: 0.0, y: 0.0, z: 0.0 },
        { x: 0.0, y: 0.1, z: 0.0 },
        { x: 0.0, y: 0.2, z: 0.0 },
        { x: 0.0, y: 0.3, z: 0.0 },
      ]);

      expect(recognizer.templateCount).toBe(2);

      // Test candidate: noisy horizontal swipe
      const candidateHorizontal = [
        { x: 0.05, y: 0.01, z: -0.01 },
        { x: 0.12, y: -0.02, z: 0.01 },
        { x: 0.22, y: 0.01, z: 0.00 },
        { x: 0.31, y: 0.02, z: -0.01 },
      ];

      const match = recognizer.recognize(candidateHorizontal);
      expect(match).toBeDefined();
      expect(match?.templateName).toBe('swipe_right');
      expect(match?.score).toBeGreaterThan(0.7);

      // Test candidate: vertical swipe
      const candidateVertical = [
        { x: 0.01, y: 0.05, z: 0.0 },
        { x: -0.01, y: 0.15, z: 0.0 },
        { x: 0.02, y: 0.25, z: 0.0 },
      ];

      const matchVert = recognizer.recognize(candidateVertical);
      expect(matchVert).toBeDefined();
      expect(matchVert?.templateName).toBe('swipe_up');
      expect(matchVert?.score).toBeGreaterThan(0.7);
    });
  });
});
