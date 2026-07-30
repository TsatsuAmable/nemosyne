// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VRTopologyTranslator } from '../src/draco/VRTopologyTranslator.js';
import { Dataset, ColumnType } from '../src/data/Dataset.js';

function makeDataset(rows) {
  return new Dataset(
    'Test',
    [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    rows
  );
}

describe('VRTopologyTranslator artefact geometries', () => {
  const geometries = [
    'ICOSA_NODE',
    'CUBE_MATRIX',
    'CONICAL_TREE',
    'FLOW_RAY',
    'GEO_COLUMN',
    'COLUMN',
    'ORB',
    'TOKEN',
    'PLINTH',
    'BEAM',
    'RING',
    'FIELD',
    'ZONE',
  ];

  for (const geometry of geometries) {
    it(`creates a mesh for geometry ${geometry}`, () => {
      const ds = makeDataset([{ id: 'A', value: 5 }]);
      const mesh = VRTopologyTranslator._makeNode({ id: 'A', value: 5 }, ds, { color: 'id', size: 'value' }, geometry);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.geometry).toBeTruthy();
      expect(mesh.material).toBeTruthy();
      expect(mesh.userData.row).toEqual({ id: 'A', value: 5 });
    });
  }

  it('scales nodes by the size encoding', () => {
    const ds = makeDataset([
      { id: 'A', value: 0 },
      { id: 'B', value: 100 },
    ]);
    const small = VRTopologyTranslator._makeNode({ id: 'A', value: 0 }, ds, { size: 'value' }, 'ORB');
    const large = VRTopologyTranslator._makeNode({ id: 'B', value: 100 }, ds, { size: 'value' }, 'ORB');
    expect(large.scale.x).toBeGreaterThan(small.scale.x);
  });

  it('colours nodes by categorical encoding', () => {
    const ds = makeDataset([
      { id: 'A', value: 1 },
      { id: 'B', value: 2 },
    ]);
    const a = VRTopologyTranslator._makeNode({ id: 'A', value: 1 }, ds, { color: 'id' }, 'ORB');
    const b = VRTopologyTranslator._makeNode({ id: 'B', value: 2 }, ds, { color: 'id' }, 'ORB');
    expect(a.material.color.getHex()).not.toBe(b.material.color.getHex());
  });
});
