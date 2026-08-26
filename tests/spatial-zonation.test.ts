// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SettingsPanel } from '../src/vr/ui/SettingsPanel.ts';
import { Engine } from '../src/vr/Engine.ts';

describe('Sprint 22.4 Spatial Zonation Architecture', () => {
  it('organizes settings panel sections with spatial zonation and legibility hierarchy', () => {
    const panel = new SettingsPanel({
      torsoAnchor: new THREE.Group(),
      worldScene: new THREE.Scene(),
    });

    const sections = panel.getSettingSections();

    expect(sections).toContain('SPATIAL ZONATION & NAVIGATION');
    expect(sections).toContain('ACCESSIBILITY & LEGIBILITY');
    expect(sections).toContain('COMFORT');

    // Panel distance should be under spatial zonation
    expect(panel.getSettingSection('defaultPanelDistance')).toBe('SPATIAL ZONATION & NAVIGATION');
  });

  it('attempts to apply fixed foveation on WebXR session start', () => {
    const engine = new Engine();
    const mockSession = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'visible',
    };

    const setFoveationSpy = vi.fn();
    (engine.renderer.xr as unknown as { getSession: () => unknown; setFoveation: unknown }).getSession = () => mockSession;
    (engine.renderer.xr as unknown as { setFoveation: unknown }).setFoveation = setFoveationSpy;

    // Trigger session start handler
    (engine as unknown as { _handleSessionStart: () => void })._handleSessionStart();

    expect(setFoveationSpy).toHaveBeenCalledWith(1.0);
    engine.dispose();
  });
});
