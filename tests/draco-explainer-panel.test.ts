// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { DracoExplainerPanel } from '../src/vr/ui/DracoExplainerPanel.ts';

describe('DracoExplainerPanel', () => {
  let cameraGroup: THREE.Group;
  let panel: DracoExplainerPanel;

  beforeEach(() => {
    cameraGroup = new THREE.Group();
    panel = new DracoExplainerPanel(cameraGroup);
  });

  it('initializes with default empty state', () => {
    expect(panel).toBeDefined();
    expect(panel.facts).toBeNull();
    expect(panel.spec).toBeNull();
    expect(panel.mesh).toBeDefined();
  });

  it('renders rationale when facts and spec are set', () => {
    const facts = {
      topology: 'TABULAR',
      rowCount: 250,
      columnCount: 6,
      hasTimeSeries: true,
      hasGeo: false,
      hasHighCardinality: true,
    };

    const spec = {
      layout: 'TIME_RIBBON',
      geometry: 'BEAM',
      behavior: 'WAVE_OSCILLATION',
      interaction: 'CHRONO_DIAL',
    };

    panel.setExplanation(facts, spec);
    expect(panel.facts).toBe(facts);
    expect(panel.spec).toBe(spec);

    const rationale = panel._generateRationale();
    expect(rationale.some((line: string) => line.includes('TIME_RIBBON'))).toBe(true);
    expect(rationale.some((line: string) => line.includes('BEAM'))).toBe(true);
    expect(rationale.some((line: string) => line.includes('CHRONO_DIAL'))).toBe(true);
    expect(rationale.some((line: string) => line.includes('250 rows'))).toBe(true);
  });

  it('handles multiple topology layout rationales', () => {
    const topologies = [
      { layout: 'GRID_3D', expected: 'voxels' },
      { layout: 'FORCE_DIRECTED_3D', expected: 'springs' },
      { layout: 'GEO_SURFACE', expected: 'geographic' },
      { layout: 'RADIAL_ORBITAL', expected: 'hierarchical' },
      { layout: 'VECTOR_STREAMLINE', expected: 'particle streamlines' },
    ];

    for (const { layout, expected } of topologies) {
      panel.setExplanation(
        { topology: 'TABULAR', rowCount: 10, columnCount: 2 },
        { layout, geometry: 'ORB', behavior: 'STATIC', interaction: 'POINT_AND_CLICK' }
      );
      const rationale = panel._generateRationale().join(' ');
      expect(rationale.toLowerCase()).toContain(expected);
    }
  });

  it('updates when dracoNode solverResult is supplied', () => {
    const mockDracoNode = {
      solverResult: {
        facts: { topology: 'GRAPH', rowCount: 120, columnCount: 4 },
        spec: { layout: 'FORCE_DIRECTED_3D', geometry: 'ICOSA_NODE', behavior: 'PULSE_QUANTITATIVE', interaction: 'RESONANCE_PULSE' },
        cost: 14.5,
      },
    };

    panel.setDracoNode(mockDracoNode);
    expect(panel.facts.topology).toBe('GRAPH');
    expect(panel.spec.layout).toBe('FORCE_DIRECTED_3D');
  });
});
