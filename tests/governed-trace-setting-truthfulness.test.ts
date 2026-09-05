import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SettingsPanel } from '../src/vr/ui/SettingsPanel.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('governed trace setting truthfulness', () => {
  it('loads the dev/Quest trace control as enabled even if stale storage says false', () => {
    expect(import.meta.env.DEV).toBe(true);
    localStorage.setItem(
      SettingsPanel.STORAGE_KEY,
      JSON.stringify({ ...SettingsPanel.DEFAULTS, prodTraceEnabled: false })
    );

    const panel = new SettingsPanel({
      torsoAnchor: new THREE.Group(),
      worldScene: new THREE.Scene(),
    });

    expect(panel.getSetting('prodTraceEnabled')).toBe(true);
    expect(JSON.parse(localStorage.getItem(SettingsPanel.STORAGE_KEY) ?? '{}').prodTraceEnabled).toBe(
      false
    );
    panel.dispose();
  });

  it('refuses to persist or publish an impossible off-state in governed dev mode', () => {
    expect(import.meta.env.DEV).toBe(true);
    const onChange = vi.fn();
    const panel = new SettingsPanel({
      torsoAnchor: new THREE.Group(),
      worldScene: new THREE.Scene(),
      onChange,
    });

    panel.setSetting('prodTraceEnabled', false);

    expect(panel.getSetting('prodTraceEnabled')).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith('prodTraceEnabled', true);
    expect(JSON.parse(localStorage.getItem(SettingsPanel.STORAGE_KEY) ?? '{}').prodTraceEnabled).toBe(
      true
    );
    panel.dispose();
  });
});
