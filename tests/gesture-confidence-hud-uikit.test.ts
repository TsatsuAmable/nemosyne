import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GestureConfidenceHUD } from '../src/vr/ui/GestureConfidenceHUD.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';

describe('GestureConfidenceHUD UXR1 UIKit migration', () => {
  it('uses SpatialPanel and preserves lifecycle', () => {
    const anchor = new THREE.Group();
    const hud = new GestureConfidenceHUD(anchor);
    expect(hud).toBeInstanceOf(SpatialPanel);
    expect(hud.parent).toBe(anchor);
    expect(hud.mesh).toBe(hud);

    hud.hide();
    expect(hud.visible).toBe(false);
    hud.show();
    expect(hud.visible).toBe(true);
  });

  it('clamps confidence values and records timestamps without owning gesture authority', () => {
    const hud = new GestureConfidenceHUD(new THREE.Group());
    hud.recordConfidence('pinchTogether', 1.5, 123);
    expect(hud.getConfidence('pinchTogether')).toEqual({
      gestureName: 'pinchTogether',
      confidence: 1,
      lastDetectedMs: 123,
    });

    hud.recordConfidence('swipeLeft', Number.NaN, 456);
    expect(hud.getConfidence('swipeLeft')?.confidence).toBe(0);
  });

  it('returns defensive confidence snapshots', () => {
    const hud = new GestureConfidenceHUD(new THREE.Group());
    hud.recordConfidence('custom', 0.75, 10);
    const snapshot = hud.getConfidence('custom');
    expect(snapshot).not.toBeNull();
    if (snapshot) snapshot.confidence = 0;
    expect(hud.getConfidence('custom')?.confidence).toBe(0.75);
  });

  it('preserves accessibility mutation on the UIKit path', () => {
    const hud = new GestureConfidenceHUD(new THREE.Group());
    expect(() =>
      hud.applyAccessibility({
        textScale: 1.25,
        highContrast: true,
        colorblindMode: 'none',
        reducedMotion: false,
      })
    ).not.toThrow();
  });
});
