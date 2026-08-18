// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { JITGestureHintManager } from '../src/vr/ui/JITGestureHintManager.ts';

describe('Sprint 10.2: JIT Gesture Hints', () => {
  describe('JITGestureHintManager', () => {
    let hintManager: JITGestureHintManager;
    let scene: THREE.Scene;

    beforeEach(() => {
      hintManager = new JITGestureHintManager();
      scene = new THREE.Scene();
      hintManager.setScene(scene);
    });

    it('instantiates and attaches scene correctly', () => {
      expect(hintManager.enabled).toBe(true);
      expect(hintManager.scene).toBe(scene);
    });

    it('spawns 3D ghost hand hint in scene', () => {
      const pos = new THREE.Vector3(0, 1.5, -1);
      hintManager.showHint('pinchTogether', pos, 'Pinch Together to Filter');
      expect(hintManager.activeHintGroup).not.toBeNull();
      expect(scene.children.length).toBeGreaterThan(0);
    });

    it('clears active ghost hint cleanly', () => {
      const pos = new THREE.Vector3(0, 1.5, -1);
      hintManager.showHint('pinchTogether', pos, 'Pinch Together to Filter');
      hintManager.clearHint();
      expect(hintManager.activeHintGroup).toBeNull();
      expect(scene.children.length).toBe(0);
    });
  });
});