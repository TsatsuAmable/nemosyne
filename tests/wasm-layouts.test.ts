import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GridLayout3D } from '../src/moneta/layouts/GridLayout3D.ts';
import { ForceDirected3D } from '../src/moneta/layouts/ForceDirected3D.ts';

describe('Moneta layout JS/Rust boundary', () => {
  it('maps an authoritative grid coordinate buffer into presentation objects', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: i }));
    const result = GridLayout3D.compute(items, { spacing: 1.1, yOffset: 1.2 });

    expect(result).toHaveLength(items.length);
    expect(result.every((entry) => entry.position instanceof THREE.Vector3)).toBe(true);
    expect(
      result.every(
        (entry) =>
          Number.isFinite(entry.position.x) &&
          Number.isFinite(entry.position.y) &&
          Number.isFinite(entry.position.z),
      ),
    ).toBe(true);
  });

  it('passes graph edges through Rust authority and maps finite positions', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}` }));
    const result = ForceDirected3D.compute(nodes, {
      edges: [{ source: 'n0', target: 'n1', weight: 1 }],
      iterations: 20,
      radius: 4,
      yOffset: 1.2,
    });

    expect(result).toHaveLength(nodes.length);
    expect(result.every((entry) => entry.position instanceof THREE.Vector3)).toBe(true);
    expect(
      result.every(
        (entry) =>
          Number.isFinite(entry.position.x) &&
          Number.isFinite(entry.position.y) &&
          Number.isFinite(entry.position.z),
      ),
    ).toBe(true);
  });
});
