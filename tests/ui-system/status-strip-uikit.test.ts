import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Text } from '@pmndrs/uikit';
import { StatusStripController } from '../../src/vr/ui/StatusStripController.ts';
import { StatusStripPanel } from '../../src/vr/ui/StatusStripPanel.ts';
import { SpatialPanel } from '../../src/vr/ui-system/SpatialPanel.ts';
import { DEFAULT_ACCESSIBILITY } from '../../src/vr/coordinators/types.ts';

type StatusStripInternals = {
  _lineTexts: Text[];
  _lastLines: string[];
};

function internals(panel: StatusStripPanel): StatusStripInternals {
  return panel as unknown as StatusStripInternals;
}

describe('UXR1 StatusStripPanel UIKit migration', () => {
  it('uses the SpatialPanel/UIKit substrate without a legacy canvas texture', () => {
    const anchor = new THREE.Group();
    const panel = new StatusStripPanel(anchor, { statusStrip: new StatusStripController() });

    expect(panel).toBeInstanceOf(SpatialPanel);
    expect(panel.parent).toBe(anchor);
    expect(panel.mesh).toBe(panel);
    expect('canvas' in panel).toBe(false);
    expect('texture' in panel).toBe(false);
    expect(panel.getGrabRailMesh()?.visible).toBe(false);
    expect(internals(panel)._lineTexts).toHaveLength(4);

    anchor.position.set(1, 0.5, -0.25);
    anchor.updateMatrixWorld(true);
    panel.updateMatrixWorld();
    const worldPosition = new THREE.Vector3();
    panel.getWorldPosition(worldPosition);
    expect(worldPosition.x).toBeCloseTo(anchor.position.x + panel.position.x);
    expect(worldPosition.y).toBeCloseTo(anchor.position.y + panel.position.y);

    panel.dispose();
    expect(panel.parent).toBeNull();
  });

  it('updates the four visible grounding rows from the existing controller authority', () => {
    const controller = new StatusStripController();
    const panel = new StatusStripPanel(new THREE.Group(), { statusStrip: controller });
    const state = internals(panel);
    const firstLineUpdate = vi.spyOn(state._lineTexts[0], 'setProperties');

    controller.setDatasetContext('Trial dataset', 'GRAPH', 42);
    controller.setFocusContext('structure', 'cluster-7');
    panel.update(1 / 72);

    expect(state._lastLines).toHaveLength(4);
    expect(state._lastLines[0]).toContain('Trial dataset');
    expect(state._lastLines[0]).toContain('GRAPH/42');
    expect(state._lastLines[0]).toContain('STRUCTURE:cluster-7');
    expect(firstLineUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Trial dataset') })
    );

    panel.dispose();
  });

  it('fails closed if pointer handlers are called despite not being registered', () => {
    const panel = new StatusStripPanel(new THREE.Group(), { statusStrip: new StatusStripController() });
    const raycaster = new THREE.Raycaster();
    const intersectSpy = vi.spyOn(raycaster, 'intersectObject');
    const pointer = { index: 1 } as never;

    expect(panel.handlePointerDown(raycaster, pointer)).toBeNull();
    panel.handlePointerMove(raycaster, pointer);
    panel.handlePointerUp(raycaster, pointer);
    expect(intersectSpy).not.toHaveBeenCalled();

    panel.dispose();
  });

  it('keeps accessibility theming available after leaving the legacy PanelManager', () => {
    const panel = new StatusStripPanel(new THREE.Group(), { statusStrip: new StatusStripController() });
    const state = internals(panel);
    const firstLineUpdate = vi.spyOn(state._lineTexts[0], 'setProperties');

    panel.applyAccessibility({ ...DEFAULT_ACCESSIBILITY, textScale: 1.5, highContrast: true });

    expect(firstLineUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 27 })
    );
    panel.dispose();
  });
});
