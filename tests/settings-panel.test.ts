// @ts-nocheck
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { SettingsPanel } from '../src/vr/ui/SettingsPanel.ts';
import { setBodyFrameViewerTargetLocal } from '../src/vr/spatial/BodyFrameState.ts';

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
      JSON.stringify({ lensTDA: false, feedbackAudio: false, userMode: 'expert' })
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
    const control = (
      panel as unknown as { _controls: Map<string, { value: unknown }> }
    )._controls.get('collabEnabled');
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
      '_exportReviewBundle'
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
      panel.applyAccessibility({
        textScale: 1.5,
        highContrast: true,
        colorblindMode: 'deuteranopia',
      })
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

  it('update() faces the BodyFrameState target after locomotion, not the live viewer', () => {
    // Revision-5 replacement: this test formerly pinned per-frame
    // lookAt(viewer), which Chromium-verified evidence shows rotates the
    // panel 8.17deg on a 25cm lean. The body-locked panel must instead face
    // the anchor-local BodyFrameState target — never the live HMD pose,
    // never a fixed world point — so locomotion keeps it readable.
    const anchor = new THREE.Group();
    anchor.position.set(5, 0, 3);
    const viewer = new THREE.Object3D();
    viewer.position.set(5, 1.6, 4);
    const scene = new THREE.Scene();
    scene.add(anchor, viewer);
    panel = new SettingsPanel({
      torsoAnchor: anchor,
      worldScene: scene,
      viewer,
    });
    setBodyFrameViewerTargetLocal(anchor, new THREE.Vector3(0, 0, 1.4));
    panel.show();
    scene.updateMatrixWorld(true);
    panel.update(0.016);
    scene.updateMatrixWorld(true);

    const panelPos = new THREE.Vector3();
    const facing = new THREE.Vector3();
    panel.getWorldPosition(panelPos);
    panel.getWorldDirection(facing);
    facing.y = 0;
    facing.normalize();
    const targetWorld = anchor.localToWorld(new THREE.Vector3(0, 0, 1.4));
    const toTarget = targetWorld.sub(panelPos);
    toTarget.y = 0;
    toTarget.normalize();
    expect(facing.dot(toTarget)).toBeGreaterThan(0.99);
  });

  it('settings rows cannot compress below label height (squished-text regression)', () => {
    // Live defect: the scrollport shrank rows to ~2px while 19px labels
    // still painted, stacking every line onto its neighbours in the
    // headset. Rows must refuse to shrink below their tallest control.
    panel = makePanel();
    // Panel-level rows only (depth <= 2): settings rows, section headers,
    // footer rows. Control internals (e.g. segmented options) lay out along
    // a different axis and are out of scope for this regression.
    const rows: Array<{ inputProperties?: Record<string, unknown> }> = [];
    const visit = (node: { children?: unknown[] }, depth: number): void => {
      for (const child of node.children ?? []) {
        const c = child as {
          children?: unknown[];
          constructor?: { name?: string };
          inputProperties?: Record<string, unknown>;
        };
        const kind = c.constructor?.name ?? '';
        if (depth <= 2 && (kind === 'Container' || kind === 'SectionHeader')) {
          const kids = (c.children ?? []).map(
            (k) => (k as { constructor?: { name?: string } }).constructor?.name ?? ''
          );
          if (kids.includes('Text')) rows.push(c);
        }
        visit(c, depth + 1);
      }
    };
    visit(panel as unknown as { children?: unknown[] }, 0);
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      expect(row.inputProperties?.flexShrink).toBe(0);
      expect(row.inputProperties?.minHeight).toBeGreaterThanOrEqual(24);
    }
  });

  it('update() holds parent-local facing when the viewer leans (revision 5)', () => {
    // Live defect (Chromium-verified): per-frame head billboard rotated the
    // panel 8.17deg on a 25cm lean with a stationary parent. Revision 5
    // (panelLayout.ts header) mandates local facing: lean/gaze must not
    // rotate the panel within its parent frame.
    const anchor = new THREE.Group();
    const viewer = new THREE.Object3D();
    viewer.position.set(0, 1.6, 0);
    const scene = new THREE.Scene();
    scene.add(anchor, viewer);
    panel = new SettingsPanel({
      torsoAnchor: anchor,
      worldScene: scene,
      viewer,
    });
    panel.show();
    scene.updateMatrixWorld(true);
    panel.update(0.016);
    const before = panel.quaternion.clone();
    viewer.position.x += 0.25;
    scene.updateMatrixWorld(true);
    panel.update(0.016);
    expect(panel.quaternion.angleTo(before)).toBeLessThan(1e-3);
  });

  it('update() faces the anchor-local BodyFrameState target, not the viewer', () => {
    const anchor = new THREE.Group();
    const viewer = new THREE.Object3D();
    viewer.position.set(2, 1.6, 2);
    const scene = new THREE.Scene();
    scene.add(anchor, viewer);
    panel = new SettingsPanel({
      torsoAnchor: anchor,
      worldScene: scene,
      viewer,
    });
    setBodyFrameViewerTargetLocal(anchor, new THREE.Vector3(0, 0, 1.4));
    panel.show();
    scene.updateMatrixWorld(true);
    panel.update(0.016);
    scene.updateMatrixWorld(true);
    // Parent-local yaw toward (0,0,1.4) from the panel slot; the viewer at
    // (2,1.6,2) must not influence it.
    const toTarget = new THREE.Vector3(0, 0, 1.4).sub(panel.position);
    toTarget.y = 0;
    toTarget.normalize();
    const facing = new THREE.Vector3();
    panel.getWorldDirection(facing);
    facing.y = 0;
    facing.normalize();
    expect(facing.dot(toTarget)).toBeGreaterThan(0.99);
  });

  it('update() does not overwrite the orientation of a world-locked panel', () => {
    panel = makePanel();
    panel.setReferenceFrame('WORLD_LOCKED', false);
    panel.show();
    panel.position.set(0.3, 1.4, -1);
    panel.rotation.set(0.1, 0.4, 0.2);
    const placed = panel.quaternion.clone();
    panel.update(0.016);
    expect(panel.quaternion.angleTo(placed)).toBeLessThan(1e-6);
  });

  it('show() preserves a user-placed position instead of resetting to default', () => {
    // Live defect: show() reset a dragged [.3,.2,-.8] placement to default.
    panel = makePanel();
    panel.position.set(0.3, 0.2, -0.8);
    panel.hide();
    panel.show();
    expect(panel.position.toArray()).toEqual([0.3, 0.2, -0.8]);
  });

  it('update() faces the anchor-local target when no viewer is supplied', () => {
    // Revision-5 replacement: the legacy lookAt(world-origin) fallback is
    // removed with head billboarding. Without a viewer the panel still
    // faces the anchor-local BodyFrameState target (default local origin).
    const anchor = new THREE.Group();
    const scene = new THREE.Scene();
    scene.add(anchor);
    panel = new SettingsPanel({ torsoAnchor: anchor, worldScene: scene });
    panel.show();
    scene.updateMatrixWorld(true);
    panel.update(0.016);
    scene.updateMatrixWorld(true);

    const facing = new THREE.Vector3();
    panel.getWorldDirection(facing);
    facing.y = 0;
    facing.normalize();
    // Default BodyFrameState target is the anchor-local origin; the anchor
    // is identity here, so expected yaw points from the slot at the origin.
    const toTarget = panel.position.clone().setY(0).negate().normalize();
    expect(facing.dot(toTarget)).toBeGreaterThan(0.99);
  });
});
