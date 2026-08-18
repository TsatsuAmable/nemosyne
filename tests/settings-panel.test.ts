// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { SettingsPanel } from '../src/vr/ui/SettingsPanel.ts';
import { downloadText } from '../src/utils/Download.ts';

vi.mock('../src/utils/Download.ts', () => ({
  downloadText: vi.fn(() => Promise.resolve()),
}));

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
    expect(panel.getSetting('userMode')).toBe('novice');
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
    expect(keys).toContain('userMode');
    expect(keys).toContain('snapTurn');
    expect(keys).toContain('vignette');
    expect(keys).toContain('reducedMotion');
  });

  it('cycles the user mode choice when clicked', () => {
    panel = new SettingsPanel(cameraGroup);
    panel.show();
    panel.mesh.updateMatrixWorld();

    const btn = panel._buttons.find((b) => b.key === 'userMode');
    const hitPoint = new THREE.Vector3();
    const u = (btn.choiceBounds.next.x + btn.choiceBounds.next.w / 2) / panel.width;
    const v = 1 - (btn.bounds.y + btn.bounds.h / 2) / panel.height;
    hitPoint.set((u - 0.5) * panel.worldSize[0], (v - 0.5) * panel.worldSize[1], 0);
    hitPoint.applyMatrix4(panel.mesh.matrixWorld);

    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.copy(hitPoint);
    raycaster.ray.origin.z += 0.1;
    raycaster.ray.direction.set(0, 0, -1);

    expect(panel.getSetting('userMode')).toBe('novice');
    expect(panel.handleContentClick(raycaster)).toBe(true);
    expect(panel.getSetting('userMode')).toBe('intermediate');
    expect(panel.handleContentClick(raycaster)).toBe(true);
    expect(panel.getSetting('userMode')).toBe('expert');
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

  /** Build a raycaster whose first hit reports the UV for canvas-space (cx, cy).
   *  Mocking intersectObject lets us reach rows below the visible fold (their
   *  absolute bounds.y can exceed the panel height, so a real plane raycast
   *  would miss). handleContentClick maps this UV straight back to (cx, cy). */
  function raycastAt(panel, cx, cy) {
    const u = cx / panel.width;
    const v = 1 - cy / panel.height;
    const raycaster = new THREE.Raycaster();
    vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
      { object: panel.mesh, uv: new THREE.Vector2(u, v) },
    ]);
    return raycaster;
  }

  it.each([
    ['textScale', 0.75, 2, 0.25],
    ['snapTurnAngle', 15, 90, 15],
    ['vignetteIntensity', 0.1, 0.9, 0.1],
    ['seatedHeightOffset', -0.5, 0.5, 0.1],
    ['defaultPanelDistance', 0.7, 2.5, 0.1],
  ])('stepper %s increments and decrements within its clamp', (key, min, max, step) => {
    panel = new SettingsPanel(cameraGroup);
    panel.show();
    panel.mesh.updateMatrixWorld();

    const btn = panel._buttons.find((b) => b.key === key);
    expect(btn.type).toBe('stepper');
    const dec = btn.stepperBounds.dec;
    const inc = btn.stepperBounds.inc;

    const current = Number(panel.getSetting(key));

    // Increment.
    expect(panel.handleContentClick(raycastAt(panel, inc.x + inc.w / 2, inc.y + inc.h / 2))).toBe(true);
    expect(panel.getSetting(key)).toBeCloseTo(Math.min(max, current + step), 5);

    // Decrement twice to confirm the lower clamp.
    panel.handleContentClick(raycastAt(panel, dec.x + dec.w / 2, dec.y + dec.h / 2));
    panel.handleContentClick(raycastAt(panel, dec.x + dec.w / 2, dec.y + dec.h / 2));
    const afterTwoDec = Number(panel.getSetting(key));
    expect(afterTwoDec).toBeGreaterThanOrEqual(min);
    expect(afterTwoDec).toBeCloseTo(Math.max(min, current - step), 5);
  });

  it.each([
    ['colorblindMode', ['none', 'deuteranopia', 'protanopia', 'tritanopia']],
    ['collabRoom', ['default', 'team-a', 'team-b', 'demo']],
    ['collabName', ['Analyst', 'Observer', 'Guest', 'Peer']],
  ])('choice %s advances with next and wraps with prev', (key, choices) => {
    panel = new SettingsPanel(cameraGroup);
    panel.show();
    panel.mesh.updateMatrixWorld();

    const btn = panel._buttons.find((b) => b.key === key);
    expect(btn.type).toBe('choice');
    const prev = btn.choiceBounds.prev;
    const next = btn.choiceBounds.next;

    const startIdx = choices.indexOf(String(panel.getSetting(key)));

    // Next advances by one (mod length).
    expect(panel.handleContentClick(raycastAt(panel, next.x + next.w / 2, next.y + next.h / 2))).toBe(true);
    expect(panel.getSetting(key)).toBe(choices[(startIdx + 1) % choices.length]);

    // Prev wraps back below the start.
    expect(panel.handleContentClick(raycastAt(panel, prev.x + prev.w / 2, prev.y + prev.h / 2))).toBe(true);
    expect(panel.getSetting(key)).toBe(choices[startIdx]);
  });

  it('export-bundle privacy toggle flips level without exporting', () => {
    panel = new SettingsPanel(cameraGroup);
    panel.show();
    panel.mesh.updateMatrixWorld();

    const eb = panel._exportBundleBounds;
    expect(eb).toBeTruthy();
    expect(panel._exportPrivacyLevel).toBe('metadata');

    const t = eb.toggle;
    expect(panel.handleContentClick(raycastAt(panel, t.x + t.w / 2, t.y + t.h / 2))).toBe(true);
    expect(panel._exportPrivacyLevel).toBe('full-session');

    expect(panel.handleContentClick(raycastAt(panel, t.x + t.w / 2, t.y + t.h / 2))).toBe(true);
    expect(panel._exportPrivacyLevel).toBe('metadata');

    expect(downloadText).not.toHaveBeenCalled();
  });

  it('export-bundle EXPORT button no-ops without telemetry + budget', () => {
    panel = new SettingsPanel(cameraGroup);
    panel.show();
    panel.mesh.updateMatrixWorld();

    const eb = panel._exportBundleBounds;
    const e = eb.export;
    expect(panel.handleContentClick(raycastAt(panel, e.x + e.w / 2, e.y + e.h / 2))).toBe(true);
    expect(downloadText).not.toHaveBeenCalled();
  });

  it('export-bundle EXPORT button downloads a review bundle with telemetry + budget', () => {
    const telemetryCollector = { getReport: () => ({ errors: { last: null } }) };
    const performanceBudget = { getViolations: () => [] };
    panel = new SettingsPanel(cameraGroup, { telemetryCollector, performanceBudget });
    panel.show();
    panel.mesh.updateMatrixWorld();

    vi.mocked(downloadText).mockClear();
    const eb = panel._exportBundleBounds;
    const e = eb.export;
    expect(panel.handleContentClick(raycastAt(panel, e.x + e.w / 2, e.y + e.h / 2))).toBe(true);
    expect(downloadText).toHaveBeenCalledTimes(1);
    const [, filename, mime] = vi.mocked(downloadText).mock.calls[0];
    expect(filename).toBe('nemosyne-review-bundle.json');
    expect(mime).toBe('application/json');
  });

  it('exit VR button triggers onExitVR callback when clicked', () => {
    const onExitVR = vi.fn();
    panel = new SettingsPanel(cameraGroup, { onExitVR });
    panel.show();
    panel.mesh.updateMatrixWorld();

    const evb = panel._exitVRBounds;
    expect(evb).toBeTruthy();

    const hit = panel.handleContentClick(raycastAt(panel, evb.x + evb.w / 2, evb.y + evb.h / 2));
    expect(hit).toBe(true);
    expect(onExitVR).toHaveBeenCalledTimes(1);
  });
});
