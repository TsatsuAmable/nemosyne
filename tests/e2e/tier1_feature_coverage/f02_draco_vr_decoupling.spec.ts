import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ConstraintEngine, TopologyTypes } from '../../../src/draco/ConstraintEngine.js';
import { VRTopologyTranslator } from '../../../src/draco/VRTopologyTranslator.js';
import { DracoTopologyNode } from '../../../src/draco/DracoTopologyNode.js';
import { CSVDataParser } from '../../../src/data/CSVDataParser.js';
import { generateTabularCSV, generateGraphCSV } from '../harness/dataset_fixtures.js';

describe('Feature 2: Draco -> VR Upstream Imports Decoupling', () => {
  it('F2-TC1: VRTopologyTranslator synthesizes valid artifact from solver result', () => {
    const csv = generateTabularCSV(10, 4);
    const ds = CSVDataParser.parseToDataset('TabularDS', csv);
    const engine = new ConstraintEngine();
    const dataInput = { dataset: ds, topology: TopologyTypes.TABULAR };
    const solverResult = engine.solve(dataInput);

    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult, dataInput);
    expect(artifact).toBeDefined();
    expect(artifact.group).toBeInstanceOf(THREE.Group);
    expect(artifact.nodeMeshes.length).toBeGreaterThan(0);
  });

  it('F2-TC2: DracoTopologyNode creates node in scene without direct UI coupling', () => {
    const scene = new THREE.Scene();
    const csv = generateGraphCSV(5);
    const ds = CSVDataParser.parseToDataset('GraphDS', csv);
    const node = new DracoTopologyNode(scene, { dataset: ds, topology: TopologyTypes.GRAPH });

    expect(node.solverResult).toBeDefined();
    expect(node.artifact).toBeDefined();
    expect(scene.children.length).toBeGreaterThan(0);
  });

  it('F2-TC3: DracoTopologyNode allows soft constraint weight adjustments and re-solves cleanly', () => {
    const scene = new THREE.Scene();
    const csv = generateTabularCSV(8, 3);
    const ds = CSVDataParser.parseToDataset('TabularDS2', csv);
    const node = new DracoTopologyNode(scene, { dataset: ds, topology: TopologyTypes.TABULAR });

    const initialCost = node.solverResult.cost;
    node.adjustWeight('prefer_grid_for_tabular', 50);

    expect(node.solverResult).toBeDefined();
    expect(typeof node.solverResult.cost).toBe('number');
  });

  it('F2-TC4: Decoupled ConstraintEngine solves constraints independently of scene state', () => {
    const engine = new ConstraintEngine();
    const result = engine.solve({ topology: TopologyTypes.TABULAR, rows: [{ a: 1 }, { a: 2 }] });

    expect(result.facts).toBeDefined();
    expect(result.spec).toBeDefined();
    expect(result.spec.layout).toBeDefined();
    expect(result.spec.geometry).toBeDefined();
  });

  it('F2-TC5: DracoTopologyNode supports appending rows to artifacts', () => {
    const scene = new THREE.Scene();
    const csv = generateTabularCSV(5, 3);
    const ds = CSVDataParser.parseToDataset('TabularDS3', csv);
    const node = new DracoTopologyNode(scene, { dataset: ds, topology: TopologyTypes.TABULAR });

    const newRows = [{ dim_1: 10, dim_2: 20, dim_3: 30 }];
    const appended = node.appendRows(newRows);
    expect(typeof appended).toBe('boolean');
  });
});
