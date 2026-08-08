import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GestureClassifierModel } from '../src/ai/GestureClassifierModel.ts';
import { JITGestureHintManager } from '../src/vr/ui/JITGestureHintManager.ts';

describe('Sprint 10.2: AI Gesture Classifier & JIT Hints', () => {
  describe('GestureClassifierModel', () => {
    let classifier: GestureClassifierModel;

    beforeEach(() => {
      classifier = new GestureClassifierModel(0.12, 0.045);
    });

    it('instantiates correctly with base thresholds', () => {
      expect(classifier).toBeDefined();
      const calib = classifier.getCalibration();
      expect(calib.moveThreshold).toBe(0.12);
      expect(calib.pinchThreshold).toBe(0.045);
    });

    it('initializes ONNX bridge gracefully when called', async () => {
      const loaded = await classifier.initONNXBridge();
      expect(typeof loaded).toBe('boolean');
    });

    it('classifies pinchTogether gesture when hands move closer', () => {
      for (let i = 0; i < 10; i++) {
        const leftPos = new THREE.Vector3(-0.3 + i * 0.02, 1.2, -0.5);
        const rightPos = new THREE.Vector3(0.3 - i * 0.02, 1.2, -0.5);
        classifier.recordSample('left', leftPos, true, 1000 + i * 20);
        classifier.recordSample('right', rightPos, true, 1000 + i * 20);
      }

      const res = classifier.classifyGesture('left', 'right');
      expect(res.gestureName).toBe('pinchTogether');
      expect(res.confidence).toBeGreaterThan(0.5);
    });

    it('classifies scoopUp gesture when both hands move upward', () => {
      classifier.reset();
      for (let i = 0; i < 10; i++) {
        const leftPos = new THREE.Vector3(-0.2, 1.0 + i * 0.03, -0.5);
        const rightPos = new THREE.Vector3(0.2, 1.0 + i * 0.03, -0.5);
        classifier.recordSample('left', leftPos, false, 1000 + i * 20);
        classifier.recordSample('right', rightPos, false, 1000 + i * 20);
      }

      const res = classifier.classifyGesture('left', 'right');
      expect(res.gestureName).toBe('scoopUp');
    });
  });

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
      expect(hintManager.activeHintGroup).not.be.null;
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
