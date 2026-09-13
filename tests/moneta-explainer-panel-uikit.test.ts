import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MonetaExplainerPanel } from '../src/vr/ui/MonetaExplainerPanel.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';

describe('MonetaExplainerPanel UXR1 UIKit migration', () => {
  it('uses SpatialPanel and preserves lifecycle', () => {
    const anchor = new THREE.Group();
    const panel = new MonetaExplainerPanel(anchor);
    expect(panel).toBeInstanceOf(SpatialPanel);
    expect(panel.parent).toBe(anchor);
    panel.hide();
    expect(panel.visible).toBe(false);
    panel.show();
    expect(panel.visible).toBe(true);
  });

  it('keeps rationale generation dependent on supplied Moneta facts/spec', () => {
    const panel = new MonetaExplainerPanel(new THREE.Group());
    panel.setExplanation(
      { topology: 'TABULAR', rowCount: 250, numericColumns: 2, categoricalColumns: 2, temporalColumns: 2 } as never,
      { layout: 'TIME_RIBBON', geometry: 'BEAM', behavior: 'WAVE_OSCILLATION', interaction: 'CHRONO_DIAL' } as never
    );
    const rationale = panel._generateRationale().join(' ');
    expect(rationale).toContain('250 rows');
    expect(rationale).toContain('TIME_RIBBON');
    expect(rationale).toContain('BEAM');
    expect(rationale).toContain('CHRONO_DIAL');
  });

  it('preserves Draco compatibility aliases without adding a second authority', () => {
    const panel = new MonetaExplainerPanel(new THREE.Group());
    const node = {
      solverResult: {
        facts: { topology: 'GRAPH', rowCount: 1 },
        spec: {
          layout: 'FORCE_DIRECTED_3D',
          geometry: 'ICOSA_NODE',
          behavior: 'STATIC',
          interaction: 'POINT_AND_CLICK',
        },
      },
    } as never;
    panel.setDracoNode(node);
    expect(panel.dracoNode).toBe(node);
    expect(panel.monetaNode).toBe(node);
  });
});
