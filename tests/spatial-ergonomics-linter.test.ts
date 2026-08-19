import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpatialErgonomicsLinter } from '../dev/spatial-tools/SpatialErgonomicsLinter.ts';

describe('Spatial Ergonomics & Legibility Linter (dev/spatial-tools)', () => {
  it('passes objects placed within the ergonomic depth and FOV comfort zones', () => {
    const headPos = new THREE.Vector3(0, 1.6, 0);
    const headForward = new THREE.Vector3(0, 0, -1);

    // Object directly in front at 1.0m (ideal comfort distance)
    const validPanel = new THREE.Object3D();
    validPanel.name = 'Ergonomic Data Panel';
    validPanel.position.set(0, 1.6, -1.0);

    const violations = SpatialErgonomicsLinter.lintObject(headPos, headForward, validPanel, {
      isInteractive: true,
      targetSizeMeters: 0.1, // 10cm at 1m is ~5.7 deg (comfortably above 2.5 deg)
    });

    expect(violations).toHaveLength(0);
  });

  it('detects objects placed too close causing vergence-accommodation eye strain', () => {
    const headPos = new THREE.Vector3(0, 1.6, 0);
    const headForward = new THREE.Vector3(0, 0, -1);

    const closeObj = new THREE.Object3D();
    closeObj.name = 'Too Close Panel';
    closeObj.position.set(0, 1.6, -0.3); // 30cm away (violates 0.75m min)

    const violations = SpatialErgonomicsLinter.lintObject(headPos, headForward, closeObj);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].category).toBe('depth');
    expect(violations[0].severity).toBe('error');
    expect(violations[0].message).toContain('Causes vergence-accommodation');
  });

  it('detects objects placed at extreme gaze angles requiring neck strain', () => {
    const headPos = new THREE.Vector3(0, 1.6, 0);
    const headForward = new THREE.Vector3(0, 0, -1);

    const sidePanel = new THREE.Object3D();
    sidePanel.name = 'Extreme Side Panel';
    sidePanel.position.set(1.5, 1.6, -0.5); // ~70 deg to the right (violates 30 deg comfort zone)

    const violations = SpatialErgonomicsLinter.lintObject(headPos, headForward, sidePanel);
    const fovViolation = violations.find((v) => v.category === 'fov');
    expect(fovViolation).toBeDefined();
    expect(fovViolation?.severity).toBe('warning');
    expect(fovViolation?.message).toContain('neck strain');
  });

  it('evaluates text legibility visual angle on Meta Quest 3', () => {
    const headPos = new THREE.Vector3(0, 1.6, 0);
    const headForward = new THREE.Vector3(0, 0, -1);

    const tinyText = new THREE.Object3D();
    tinyText.name = 'Microscopic Label';
    tinyText.position.set(0, 1.6, -1.5);

    const violations = SpatialErgonomicsLinter.lintObject(headPos, headForward, tinyText, {
      isText: true,
      targetSizeMeters: 0.005, // 5mm at 1.5m is ~0.19 deg (far below 1.2 deg threshold)
    });

    const textViolation = violations.find((v) => v.category === 'legibility');
    expect(textViolation).toBeDefined();
    expect(textViolation?.severity).toBe('error');
    expect(textViolation?.message).toContain('illegible on Meta Quest 3');
  });

  it('computes full scene ergonomics audit reports', () => {
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);

    const obj1 = new THREE.Object3D();
    obj1.position.set(0, 1.6, -1.0);

    const report = SpatialErgonomicsLinter.lintScene(camera, [
      { object: obj1, isInteractive: true, sizeMeters: 0.08 },
    ]);

    expect(report.passed).toBe(true);
    expect(report.score).toBe(100);
    expect(report.totalObjectsChecked).toBe(1);
  });
});
