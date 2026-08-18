// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GridLayout3D } from '../src/draco/layouts/GridLayout3D.ts';
import { ForceDirected3D } from '../src/draco/layouts/ForceDirected3D.ts';
import { RadialTreeLayout } from '../src/draco/layouts/RadialTreeLayout.ts';

describe('Spatial Layout Engines', () => {
  it('computes 3D grid layout coordinates for 8 items', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: i }));
    const result = GridLayout3D.compute(items, { spacing: 1.1, yOffset: 1.2 });

    expect(result).toHaveLength(8);
    expect(result[0].position).toBeInstanceOf(THREE.Vector3);
    expect(result[0].position.y).toBeCloseTo(0.65);
  });

  it('computes force-directed layout coordinates for graph nodes', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}` }));
    const edges = [{ source: 'n0', target: 'n1', weight: 1 }];

    const result = ForceDirected3D.compute(nodes, {
      edges,
      iterations: 20,
      radius: 4,
      yOffset: 1.2,
    });

    expect(result).toHaveLength(5);
    expect(result[0].position.x).not.toBeNaN();
    expect(result[0].position.y).not.toBeNaN();
  });

  it('computes radial tree layout coordinates for hierarchy levels', () => {
    const nodes = [
      { id: 'root', level: 0 },
      { id: 'child1', level: 1, parent: 'root' },
      { id: 'child2', level: 1, parent: 'root' },
    ];

    const result = RadialTreeLayout.compute(nodes, {
      levelKey: 'level',
      parentKey: 'parent',
      ringSpacing: 1.8,
      yStep: 0.8,
      yOffset: 1.2,
    });

    expect(result).toHaveLength(3);
    expect(result[0].position.x).toBeCloseTo(0.0);
    expect(result[0].position.y).toBeCloseTo(1.2);
    expect(result[0].position.z).toBeCloseTo(0.0);
  });
});
