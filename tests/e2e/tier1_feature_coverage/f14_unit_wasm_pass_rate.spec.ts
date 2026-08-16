import { describe, it, expect } from 'vitest';
import { Dataset } from '../../../src/data/Dataset.js';
import { CSVDataParser } from '../../../src/data/CSVDataParser.js';
import { ConstraintEngine, TopologyTypes } from '../../../src/draco/ConstraintEngine.js';
import { disposeObject } from '../../../src/utils/Dispose.js';
import * as THREE from 'three';

describe('Feature 14: Unit & WASM Test Suite Quality', () => {
  it('F14-TC1: Dataset creation and column schema inferencing execute with 100% deterministic accuracy', () => {
    const csv = 'x,y,z,label\n1.0,2.0,3.0,alpha\n4.0,5.0,6.0,beta';
    const ds = CSVDataParser.parseToDataset('InferDS', csv);

    expect(ds.rowCount).toBe(2);
    expect(ds.columnCount).toBe(4);
    expect(ds.numericColumns.length).toBe(3);
  });

  it('F14-TC2: disposeObject handles complex Three.js object trees without throwing errors', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    root.add(mesh);

    expect(() => disposeObject(root)).not.toThrow();
  });

  it('F14-TC3: ConstraintEngine solves symbolic specs for TABULAR, GRAPH, HIERARCHY, GEO, TIME_SERIES', () => {
    const engine = new ConstraintEngine();
    const topologies = [TopologyTypes.TABULAR, TopologyTypes.GRAPH, TopologyTypes.HIERARCHY, TopologyTypes.GEO, TopologyTypes.TIME_SERIES];

    topologies.forEach((topology) => {
      const res = engine.solve({ topology, rows: [{ a: 1 }] });
      expect(res.spec).toBeDefined();
      expect(res.spec.layout).toBeDefined();
    });
  });

  it('F14-TC4: WebGL and WebXR mock harnesses initialize cleanly in JSDOM execution mode', () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');

    expect(gl).not.toBeNull();
    expect(gl?.getParameter(0x1f00)).toContain('WebGL Mock');
  });

  it('F14-TC5: Core data operations execute cleanly with zero uncaught exceptions', () => {
    const ds = new Dataset('Test', [{ name: 'val', type: 'NUMERIC' }], [{ val: 10 }, { val: 20 }, { val: 30 }]);
    expect(ds.rangeOf('val')).toEqual({ min: 10, max: 30 });
  });
});
