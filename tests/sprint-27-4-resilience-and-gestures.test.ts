import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { WebGLContextRecovery, DiegeticErrorBoundary } from '../src/vr/resilience/index.ts';

describe('Sprint 27.4 — WebGL Context Recovery & Diegetic Error Boundary', () => {
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
});
