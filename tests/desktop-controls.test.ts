// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { Engine } from '../src/vr/Engine.ts';
import { DesktopControls } from '../src/vr/DesktopControls.ts';

describe('DesktopControls', () => {
  let engine;
  let controls;

  beforeEach(() => {
    // Engine creates a canvas and attaches event listeners; we instantiate it
    // because DesktopControls depends on engine.camera/renderer/etc.
    globalThis.navigator.xr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        renderState: {},
        inputSources: [],
      }),
    };
    engine = new Engine();
    controls = engine.desktop;
  });

  afterEach(() => {
    controls.dispose();
    engine.dispose();

    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);

    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    vi.restoreAllMocks();
  });

  it('exists on the engine', () => {
    expect(controls).toBeInstanceOf(DesktopControls);
    expect(controls.engine).toBe(engine);
  });

  it('rotates the camera group and camera from synthetic mouse deltas', () => {
    const initialYaw = engine.cameraGroup.rotation.y;
    const initialPitch = engine.camera.rotation.x;

    controls.isDragging = true;
    controls._onMouseMove({ movementX: 100, movementY: 50 });

    expect(engine.cameraGroup.rotation.y).not.toBeCloseTo(initialYaw, 3);
    expect(engine.camera.rotation.x).not.toBeCloseTo(initialPitch, 3);
  });

  it('clamps pitch so the camera cannot flip over', () => {
    controls.isDragging = true;
    controls._onMouseMove({ movementX: 0, movementY: -100000 });
    expect(engine.camera.rotation.x).toBeLessThan(Math.PI / 2);

    controls._onMouseMove({ movementX: 0, movementY: 100000 });
    expect(engine.camera.rotation.x).toBeGreaterThan(-Math.PI / 2);
  });

  it('returns a ray from the camera through the mouse position', () => {
    controls.mouse.set(0, 0);
    const ray = controls.getRay(new THREE.Ray());
    expect(ray.origin.length()).toBeGreaterThan(0);
    expect(ray.direction.length()).toBeCloseTo(1, 5);
    // Center ray should point roughly forward (-Z).
    expect(ray.direction.z).toBeLessThan(0);
  });

  it('toggles keys in locomotion from keyboard events', () => {
    controls._onKeyDown({ code: 'KeyW' });
    expect(engine.locomotion.keys.has('KeyW')).toBe(true);

    controls._onKeyUp({ code: 'KeyW' });
    expect(engine.locomotion.keys.has('KeyW')).toBe(false);
  });

  it('hides the cursor when an XR session is active', () => {
    engine.renderer.xr.getSession = vi.fn().mockReturnValue({ inputSources: [] });
    controls.update();
    expect(controls._cursor.visible).toBe(false);
  });

  it('shows the cursor when no XR session is active', () => {
    engine.renderer.xr.getSession = vi.fn().mockReturnValue(null);
    controls.update();
    expect(controls._cursor.visible).toBe(true);
  });

  it('performs undo and redo from keyboard shortcuts', () => {
    engine.onUndo = vi.fn();
    engine.onRedo = vi.fn();

    const ev = new KeyboardEvent('keydown', { ctrlKey: true, key: 'z', code: 'KeyZ' });
    const preventDefault = vi.spyOn(ev, 'preventDefault');
    controls._onKeyDown(ev);
    expect(engine.onUndo).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();

    const redoEv = new KeyboardEvent('keydown', { ctrlKey: true, key: 'y', code: 'KeyY' });
    controls._onKeyDown(redoEv);
    expect(engine.onRedo).toHaveBeenCalled();
  });
});
