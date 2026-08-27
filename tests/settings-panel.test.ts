// @ts-nocheck
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { SettingsPanel } from '../src/vr/ui/SettingsPanel.ts';

type Dispatchable = { dispatchEvent: (e: { type: string }) => void };

function makePanel(opts: Record<string, unknown> = {}): SettingsPanel {
  return new SettingsPanel({
    torsoAnchor: new THREE.Group(),
    worldScene: new THREE.Scene(),
    ...opts,
  });
}

describe('SettingsPanel (UIKit substrate)', () => {
  let panel: SettingsPanel;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    panel = null as unknown as SettingsPanel;
    localStorage.clear();
  });

  it('loads defaults when localStorage is empty', () => {
    panel = makePanel();
    expect(panel.getSetting('lensTDA')).toBe(true);
    expect(panel.getSetting('lensCorrelation')).toBe(true);
    expect(panel.getSetting('feedbackAudio')).toBe(true);
    expect(panel.getSetting('feedbackHaptic')).toBe(true);
    expect(panel.getSetting('feedbackVisual')).toBe(true);
    expect(panel.getSetting('gesturesEnabled')).toBe(true);
    expect(panel.getSetting('userMode')).toBe('novice');
  });

  it('loads persisted settings merged onto defaults', () => {
    localStorage.setItem(
      SettingsPanel.STORAGE_KEY,
      JSON.stringify({ lensTDA: false, feedbackAudio: false, userMode: 'expert' }),
    );
    panel = makePanel();
    expect(panel.getSetting('lensTDA')).toBe(false);
    expect(panel.getSetting('feedbackAudio')).toBe(false);
    expect(panel.getSetting('userMode')).toBe('expert');
    // Untouched keys keep defaults.
    expect(panel.getSetting('feedbackHaptic')).toBe(true);
  });

  it('fires onChange and persists when a setting changes', () => {
    const onChange = vi.fn();
    panel = makePanel({ onChange });
    panel.setSetting('feedbackHaptic', false);
    expect(onChange).toHaveBeenCalledWith('feedbackHaptic', false);
    const stored = JSON.parse(localStorage.getItem(SettingsPanel.STORAGE_KEY) ?? '{}');
    expect(stored.feedbackHaptic).toBe(false);
    expect(panel.getSetting('feedbackHaptic')).toBe(false);
  });

  it('getAllSettings returns a defensive copy', () => {
    panel = makePanel();
    const all = panel.getAllSettings();
    expect(all.userMode).toBe('novice');
    all.userMode = 'expert';
    expect(panel.getSetting('userMode')).toBe('novice');
  });

  it('keeps the bound control in sync when a setting is set externally', () => {
    panel = makePanel();
    panel.setSetting('collabEnabled', true);
    const control = (panel as unknown as { _controls: Map<string, { value: unknown }> })._controls.get(
      'collabEnabled',
    );
    expect(control?.value).toBe(true);
  });

  it('wires the exit-VR button to the onExitVR callback', () => {
    const onExitVR = vi.fn();
    panel = makePanel({ onExitVR });
    const exit = (panel as unknown as { _exitButton: Dispatchable })._exitButton;
    exit.dispatchEvent({ type: 'click' });
    expect(onExitVR).toHaveBeenCalledTimes(1);
  });

  it('wires the export-bundle button to review-bundle generation', () => {
    panel = makePanel();
    const spy = vi.spyOn(
      panel as unknown as { _exportReviewBundle: () => void },
      '_exportReviewBundle',
    );
    const exportButton = (panel as unknown as { _exportButton: Dispatchable })._exportButton;
    exportButton.dispatchEvent({ type: 'click' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('privacy-level toggle flips the export privacy level', () => {
    panel = makePanel();
    const before = (panel as unknown as { _exportPrivacyLevel: string })._exportPrivacyLevel;
    const toggle = (panel as unknown as { _privacyToggle: Dispatchable })._privacyToggle;
    toggle.dispatchEvent({ type: 'click' });
    const after = (panel as unknown as { _exportPrivacyLevel: string })._exportPrivacyLevel;
    expect(before).not.toBe(after);
    expect(['metadata', 'full-session']).toContain(after);
  });

  it('show / hide / toggle keep mesh.visible consistent', () => {
    panel = makePanel();
    expect(panel.mesh.visible).toBe(true);
    panel.hide();
    expect(panel.mesh.visible).toBe(false);
    panel.show();
    expect(panel.mesh.visible).toBe(true);
    panel.toggle();
    expect(panel.mesh.visible).toBe(false);
  });

  it('applyAccessibility updates accessibility state and re-themes without throwing', () => {
    panel = makePanel();
    expect(() =>
      panel.applyAccessibility({ textScale: 1.5, highContrast: true, colorblindMode: 'deuteranopia' }),
    ).not.toThrow();
    const state = panel as unknown as {
      _textScale: number;
      _highContrast: boolean;
      _colorblindMode: string;
    };
    expect(state._textScale).toBe(1.5);
    expect(state._highContrast).toBe(true);
    expect(state._colorblindMode).toBe('deuteranopia');
  });

  it('fires onChange for accessibility settings and persists them', () => {
    const onChange = vi.fn();
    panel = makePanel({ onChange });
    panel.setSetting('highContrast', true);
    expect(onChange).toHaveBeenCalledWith('highContrast', true);
    const stored = JSON.parse(localStorage.getItem(SettingsPanel.STORAGE_KEY) ?? '{}');
    expect(stored.highContrast).toBe(true);
  });
});