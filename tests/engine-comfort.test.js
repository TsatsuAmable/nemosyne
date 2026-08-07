// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Engine } from '../src/vr/Engine.ts';

describe('Engine comfort settings', () => {
  let engine;

  beforeEach(() => {
    engine = new Engine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('creates a hidden vignette mesh attached to the camera', () => {
    expect(engine._vignetteMesh).toBeTruthy();
    expect(engine._vignetteMesh.visible).toBe(false);
    expect(engine.camera.children).toContain(engine._vignetteMesh);
  });

  it('enables vignette with intensity', () => {
    engine.setVignetteEnabled(true, 0.55);
    expect(engine._vignetteMesh.visible).toBe(true);
    expect(engine._vignetteMesh.material.opacity).toBeCloseTo(0.55, 5);
  });

  it('disables vignette', () => {
    engine.setVignetteEnabled(true, 0.5);
    engine.setVignetteEnabled(false);
    expect(engine._vignetteMesh.visible).toBe(false);
    expect(engine._vignetteMesh.material.opacity).toBe(0);
  });
});
