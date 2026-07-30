// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { TechnoCoreNode } from '../src/vr/artifacts/TechnoCoreNode.js';

describe('TechnoCoreNode', () => {
  let core;

  beforeEach(() => {
    core = new TechnoCoreNode({ position: [0, 0, 0], scale: 1 });
  });

  it('cycles through lens modes', () => {
    expect(core.lensMode).toBe('off');

    const first = core.nextLensMode();
    expect(first).toBe('statistical');
    expect(core.lensMode).toBe('statistical');

    const second = core.nextLensMode();
    expect(second).toBe('anomaly');
    expect(core.lensMode).toBe('anomaly');

    const third = core.nextLensMode();
    expect(third).toBe('off');
    expect(core.lensMode).toBe('off');
  });

  it('sets lens mode color on core, sphere, and rings', () => {
    core.setLensMode('anomaly');

    expect(core.coreMat.color.getHex()).toBe(0xff00cc);
    expect(core.sphereMat.color.getHex()).toBe(0xff00cc);
    expect(core.ring1.material.color.getHex()).toBe(0xff00cc);
    expect(core.ring2.material.color.getHex()).toBe(0xff00cc);
  });

  it('rejects unknown lens modes', () => {
    const result = core.setLensMode('unknown');
    expect(result).toBe(false);
    expect(core.lensMode).toBe('off');
  });

  it('increases core opacity with data activity', () => {
    core.update(0.016, 0);
    const lowOpacity = core.coreMat.opacity;

    core.setDataActivity(1);
    core.update(0.016, 0);

    expect(core.coreMat.opacity).toBeGreaterThan(lowOpacity);
  });

  it('exposes a static list of lens modes', () => {
    expect(TechnoCoreNode.LENS_MODES).toEqual(['off', 'statistical', 'anomaly']);
  });
});
