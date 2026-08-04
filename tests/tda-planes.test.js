// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  buildPersistencePlane,
  buildMapperPlane,
  buildBettiPlane,
  buildTDASummaryGroup,
} from '../src/vr/artifacts/TDAPlanes.js';

function makeDataset(rows) {
  const columns = [
    { name: 'x', type: ColumnType.NUMERIC },
    { name: 'y', type: ColumnType.NUMERIC },
  ];
  return new Dataset('TDA', columns, rows);
}

describe('TDAPlanes', () => {
  it('buildPersistencePlane returns a mesh and updates with intervals', () => {
    const { mesh, update } = buildPersistencePlane();
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.name).toBe('tda-persistence-plane');
    update([
      { birth: 0, death: 2 },
      { birth: 1, death: 3 },
      { birth: 0.5, death: Infinity },
    ]);
    expect(mesh.material.map.version).toBeGreaterThan(0);
  });

  it('buildMapperPlane returns a mesh and updates with a graph', () => {
    const { mesh, update } = buildMapperPlane();
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.name).toBe('tda-mapper-plane');
    update({
      nodes: [
        { id: 0, rows: [{ x: 0 }], filterCenter: 0, size: 1 },
        { id: 1, rows: [{ x: 1 }], filterCenter: 1, size: 2 },
      ],
      edges: [[0, 1]],
    });
    expect(mesh.material.map.version).toBeGreaterThan(0);
  });

  it('buildBettiPlane returns a mesh and updates with a curve', () => {
    const { mesh, update } = buildBettiPlane();
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.name).toBe('tda-betti-plane');
    update([
      { radius: 0, betti0: 5 },
      { radius: 1, betti0: 3 },
      { radius: 2, betti0: 1 },
    ]);
    expect(mesh.material.map.version).toBeGreaterThan(0);
  });

  it('buildTDASummaryGroup builds all three panels and recomputes', () => {
    const ds = makeDataset([
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 5, y: 5 },
      { x: 5.1, y: 5 },
    ]);
    const tda = buildTDASummaryGroup(ds, ['x', 'y'], 'x');
    expect(tda.group).toBeInstanceOf(THREE.Group);
    expect(tda.group.children.length).toBe(3);
    expect(tda.persistence).toHaveProperty('update');
    expect(tda.mapper).toHaveProperty('update');
    expect(tda.betti).toHaveProperty('update');
    expect(() => tda.recompute()).not.toThrow();
  });
});
