import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MonetaTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';

function createNode(): { node: MonetaTopologyNode; adjustWeight: ReturnType<typeof vi.fn> } {
  const adjustWeight = vi.fn();
  const node = {
    engine: { softConstraints: [{ name: 'prefer_grid', weight: 10, eval: () => 0 }] },
    solverResult: {
      facts: { topology: 'TABULAR' },
      spec: { layout: 'GRID_3D', geometry: 'CUBE_MATRIX', behavior: 'STATIC', interaction: 'INSPECT_CELL' },
      cost: 4,
    },
    adjustWeight,
  } as unknown as MonetaTopologyNode;
  return { node, adjustWeight };
}

describe('MonetaDiagnosticHUD UXR1 UIKit migration', () => {
  it('uses SpatialPanel and preserves Draco compatibility alias', () => {
    const { node } = createNode();
    const hud = new MonetaDiagnosticHUD(new THREE.Group(), node);
    expect(hud).toBeInstanceOf(SpatialPanel);
    expect(hud.dracoNode).toBe(node);
  });

  it('forwards explicit diagnostic weight adjustments to Moneta authority', () => {
    const { node, adjustWeight } = createNode();
    const hud = new MonetaDiagnosticHUD(new THREE.Group(), node);
    expect(hud.adjustConstraint('prefer_grid', 5, 1000)).toBe(true);
    expect(adjustWeight).toHaveBeenCalledWith('prefer_grid', 5);
  });

  it('retains click cooldown semantics', () => {
    const { node, adjustWeight } = createNode();
    const hud = new MonetaDiagnosticHUD(new THREE.Group(), node);
    expect(hud.adjustConstraint('prefer_grid', 5, 1000)).toBe(true);
    expect(hud.adjustConstraint('prefer_grid', 5, 1100)).toBe(false);
    expect(adjustWeight).toHaveBeenCalledTimes(1);
  });

  it('records bounded candidate history when solver cost changes', () => {
    const { node } = createNode();
    const hud = new MonetaDiagnosticHUD(new THREE.Group(), node);
    for (let i = 0; i < 7; i++) {
      node.solverResult = {
        ...node.solverResult,
        cost: i + 10,
        spec: { ...node.solverResult.spec, layout: 'GRID_3D', geometry: 'CUBE_MATRIX' },
      };
      hud.render();
    }
    expect(hud.candidateHistory).toHaveLength(5);
  });
});
