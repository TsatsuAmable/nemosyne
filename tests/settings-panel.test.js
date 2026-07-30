// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { SettingsPanel } from '../src/vr/ui/SettingsPanel.js';

describe('SettingsPanel', () => {
  let panel;
  const cameraGroup = new THREE.Group();

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    if (panel?.mesh?.parent) {
      panel.mesh.parent.remove(panel.mesh);
    }
    panel = null;
    localStorage.clear();
  });

  it('loads defaults when localStorage is empty', () => {
    panel = new SettingsPanel(cameraGroup);
    expect(panel.getSetting('lensTDA')).toBe(true);
    expect(panel.getSetting('lensCorrelation')).toBe(true);
    expect(panel.getSetting('feedbackAudio')).toBe(true);
    expect(panel.getSetting('feedbackHaptic')).toBe(true);
    expect(panel.getSetting('feedbackVisual')).toBe(true);
    expect(panel.getSetting('gesturesEnabled')).toBe(true);
  });

  it('loads persisted settings from localStorage', () => {
    localStorage.setItem(
      SettingsPanel.STORAGE_KEY,
      JSON.stringify({ lensTDA: false, feedbackAudio: false })
    );
    panel = new SettingsPanel(cameraGroup);
    expect(panel.getSetting('lensTDA')).toBe(false);
    expect(panel.getSetting('lensCorrelation')).toBe(true);
    expect(panel.getSetting('feedbackAudio')).toBe(false);
  });

  it('fires onChange and persists when a setting is toggled', () => {
    const onChange = vi.fn();
    panel = new SettingsPanel(cameraGroup, { onChange });

    panel.setSetting('feedbackHaptic', false);

    expect(panel.getSetting('feedbackHaptic')).toBe(false);
    expect(onChange).toHaveBeenCalledWith('feedbackHaptic', false);

    const stored = JSON.parse(localStorage.getItem(SettingsPanel.STORAGE_KEY));
    expect(stored.feedbackHaptic).toBe(false);
  });

  it('renders toggle buttons for every setting', () => {
    panel = new SettingsPanel(cameraGroup);
    const keys = panel._buttons.map((b) => b.key);
    expect(keys).toContain('lensTDA');
    expect(keys).toContain('lensCorrelation');
    expect(keys).toContain('feedbackAudio');
    expect(keys).toContain('feedbackHaptic');
    expect(keys).toContain('feedbackVisual');
    expect(keys).toContain('gesturesEnabled');
  });

  it('toggles a setting when its content button is clicked', () => {
    panel = new SettingsPanel(cameraGroup);
    panel.show();
    panel.mesh.updateMatrixWorld();

    const btn = panel._buttons.find((b) => b.key === 'gesturesEnabled');
    const hitPoint = new THREE.Vector3();
    // The mesh is a plane; compute a world point roughly inside the toggle.
    const u = (btn.bounds.x + btn.bounds.w / 2) / panel.width;
    const v = 1 - (btn.bounds.y + btn.bounds.h / 2) / panel.height;
    hitPoint.set((u - 0.5) * panel.worldSize[0], (v - 0.5) * panel.worldSize[1], 0);
    hitPoint.applyMatrix4(panel.mesh.matrixWorld);

    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.copy(hitPoint);
    raycaster.ray.origin.z += 0.1;
    raycaster.ray.direction.set(0, 0, -1);

    const before = panel.getSetting('gesturesEnabled');
    const consumed = panel.handleContentClick(raycaster);
    expect(consumed).toBe(true);
    expect(panel.getSetting('gesturesEnabled')).toBe(!before);
  });
});
