// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SelectionDispatcher } from '../src/vr/input/SelectionDispatcher.ts';
import { InteractableRegistry } from '../src/vr/input/InteractableRegistry.ts';
import { SystemGestureDetector } from '../src/vr/input/SystemGestureDetector.ts';
import { PointerRegistry } from '../src/vr/input/PointerRegistry.ts';
import { HandWheelMenu } from '../src/vr/ui/HandWheelMenu.ts';

describe('Sprint 25.1: Quest Spatial Tracking & Aim-Drift Ergonomics Hardening', () => {
  describe('SelectionDispatcher Pinch-Lock Raycast Stabilization', () => {
    it('locks targeted hit during pinch recoil drift (UX-002)', () => {
      const registry = new InteractableRegistry();
      const dispatcher = new SelectionDispatcher(registry);

      const mockMesh = new THREE.Mesh();
      const mockData = { id: 'crystal-42' };
      let selectedData: unknown = null;

      const targetEntry = {
        mesh: mockMesh,
        data: mockData,
        onSelect: (_m: THREE.Object3D, data: unknown) => {
          selectedData = data;
        },
      };

      registry.hovered = targetEntry;

      // Lock target at pinch commit
      dispatcher.lockTargetForPinch(80);

      // Simulate pointer drifting away to empty space on finger release
      registry.hovered = null;

      const mockPointer = {
        getRay: (targetRay: THREE.Ray) => {
          targetRay.origin.set(0, 0, 0);
          targetRay.direction.set(0, 0, -1);
          return targetRay;
        },
      };

      dispatcher.triggerSelect(mockPointer);

      // The stabilized target receives the click event cleanly despite pointer drift
      expect(selectedData).toEqual(mockData);
    });
  });

  describe('HandWheelMenu Toggle Cooldown Flutter Protection', () => {
    it('debounces rapid toggle requests within cooldown window (650ms)', () => {
      const mockCamera = new THREE.PerspectiveCamera();
      const mockEngine = {
        camera: mockCamera,
        cameraGroup: new THREE.Group(),
      };
      const mockHand = { group: new THREE.Group() };

      const wheel = new HandWheelMenu(mockEngine, mockHand);
      expect(wheel.isVisible()).toBe(false);

      wheel.toggle();
      expect(wheel.isVisible()).toBe(true);

      // Immediate second toggle within cooldown should be ignored
      wheel.toggle();
      expect(wheel.isVisible()).toBe(true);
    });
  });

  describe('SystemGestureDetector Diegetic Reach-Zone Hints', () => {
    it('emits actionable hint when both-pinch is suppressed due to high Y reach delta', () => {
      const pointerRegistry = new PointerRegistry();
      let capturedHint: string | null = null;

      const detector = new SystemGestureDetector(pointerRegistry);
      detector.onSuppressedHint = (hint) => {
        capturedHint = hint;
      };

      // Mock two hands pinching, but one at Y=1.55m (> 1.5m reach zone)
      const hand0 = {
        rayOrigin: { y: 1.55 },
        isPinched: () => true,
      };
      const hand1 = {
        rayOrigin: { y: 0.85 },
        isPinched: () => true,
      };
      pointerRegistry.hands = [hand0, hand1];

      detector.update(null);

      expect(capturedHint).toContain('Lower both hands');
    });
  });
});