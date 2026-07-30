// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TDAGlyphs } from '../src/draco/TDAGlyphs.js';

describe('TDAGlyphs', () => {
  it('renders a persistence barcode with one line per interval', () => {
    const intervals = [
      { birth: 0, death: 2, dimension: 0 },
      { birth: 1, death: 3, dimension: 0 },
      { birth: 0.5, death: 1.5, dimension: 1 },
    ];
    const group = TDAGlyphs.persistenceBarcode(intervals);
    expect(group.children.length).toBe(3);
    expect(group.children[0]).toBeInstanceOf(THREE.Line);
  });

  it('renders an empty persistence frame when no intervals are given', () => {
    const group = TDAGlyphs.persistenceBarcode([]);
    expect(group.children.length).toBe(1);
  });

  it('renders a mapper graph with nodes and edges', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
    ];
    const group = TDAGlyphs.mapperGraph(nodes, edges);
    const lines = group.children.filter((c) => c instanceof THREE.Line);
    const meshes = group.children.filter((c) => c instanceof THREE.Mesh);
    expect(meshes.length).toBe(3);
    expect(lines.length).toBe(2);
  });

  it('renders a Betti curve with one line per dimension present', () => {
    const points = [
      { x: 0, b0: 1, b1: 0, b2: 0 },
      { x: 1, b0: 2, b1: 1, b2: 0 },
      { x: 2, b0: 1, b1: 2, b2: 1 },
    ];
    const group = TDAGlyphs.bettiCurve(points);
    expect(group.children.length).toBe(3);
    expect(group.children[0]).toBeInstanceOf(THREE.Line);
  });

  it('returns an empty group for too few Betti points', () => {
    const group = TDAGlyphs.bettiCurve([{ x: 0, b0: 1 }]);
    expect(group.children.length).toBe(0);
  });
});
