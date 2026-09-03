import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  ConstraintEngine,
  TopologyTypes,
  isNoFeasibleConstraintResult,
} from '../../../src/moneta/ConstraintEngine.js';
import { VRTopologyTranslator } from '../../../src/moneta/VRTopologyTranslator.js';
import { MonetaTopologyNode } from '../../../src/moneta/MonetaTopologyNode.js';
import { Dataset } from '../../../src/data/Dataset.js';
import { generateTabularCSV, generateGraphCSV } from '../harness/dataset_fixtures.js';
import { makeKernelMockBridge } from '../../helpers/kernelMock.ts';
import { makeFactProvider } from '../../helpers/dracoFactsHelper.ts';

// Wave 3: CSVDataParser is deleted. The CSV fixtures are parsed through the
// kernel mock (canned CSV parser). Parse parity is covered by Rust #[test]s +
// wasm-runtime.test.ts; these cases assert Moneta/VR decoupling, not parsing.
function datasetFromCsv(name: string, csv: string): Dataset {
  const bridge = makeKernelMockBridge();
  const json = bridge.parseDatasetBytes(new TextEncoder().encode(csv), 'csv');
  const ds = Dataset.fromJSON(json as any);
  ds.name = name;
  return ds;
}

describe('Feature 2: Moneta -> VR Upstream Imports Decoupling', () => {
  it('F2-TC1: VRTopologyTranslator synthesizes valid artifact from solver result', () => {
    const csv = generateTabularCSV(10, 4);
    const ds = datasetFromCsv('TabularDS', csv);
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const dataInput = { dataset: ds, topology: TopologyTypes.TABULAR };
    const solverResult = engine.solve(dataInput);
    expect(isNoFeasibleConstraintResult(solverResult)).toBe(false);
    if (isNoFeasibleConstraintResult(solverResult)) {
      throw new Error('expected a feasible tabular representation');
    }

    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult, dataInput);
    expect(artifact).toBeDefined();
    expect(artifact.group).toBeInstanceOf(THREE.Group);
    expect(artifact.nodeMeshes.length).toBeGreaterThan(0);
  });

  it('F2-TC2: MonetaTopologyNode creates node in scene without direct UI coupling', () => {
    const scene = new THREE.Scene();
    const csv = generateGraphCSV(5);
    const ds = datasetFromCsv('GraphDS', csv);
    const node = new MonetaTopologyNode(
      scene,
      { dataset: ds, topology: TopologyTypes.GRAPH },
      undefined,
      undefined,
      makeFactProvider()
    );

    expect(node.solverResult).toBeDefined();
    expect(node.artifact).toBeDefined();
    expect(scene.children.length).toBeGreaterThan(0);
  });

  it('F2-TC3: MonetaTopologyNode allows soft constraint weight adjustments and re-solves cleanly', () => {
    const scene = new THREE.Scene();
    const csv = generateTabularCSV(8, 3);
    const ds = datasetFromCsv('TabularDS2', csv);
    const node = new MonetaTopologyNode(
      scene,
      { dataset: ds, topology: TopologyTypes.TABULAR },
      undefined,
      undefined,
      makeFactProvider()
    );

    node.adjustWeight('prefer_grid_for_tabular', 50);

    expect(node.solverResult).toBeDefined();
    expect(typeof node.solverResult.cost).toBe('number');
  });

  it('F2-TC4: Decoupled ConstraintEngine solves constraints independently of scene state', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const result = engine.solve({ topology: TopologyTypes.TABULAR, rows: [{ a: 1 }, { a: 2 }] });

    expect(result.facts).toBeDefined();
    expect(isNoFeasibleConstraintResult(result)).toBe(false);
    if (isNoFeasibleConstraintResult(result)) {
      throw new Error('expected a feasible tabular representation');
    }
    expect(result.spec.layout).toBeDefined();
    expect(result.spec.geometry).toBeDefined();
  });

  it('F2-TC5: MonetaTopologyNode supports appending rows to artifacts', () => {
    const scene = new THREE.Scene();
    const csv = generateTabularCSV(5, 3);
    const ds = datasetFromCsv('TabularDS3', csv);
    const node = new MonetaTopologyNode(
      scene,
      { dataset: ds, topology: TopologyTypes.TABULAR },
      undefined,
      undefined,
      makeFactProvider()
    );

    const newRows = [{ dim_1: 10, dim_2: 20, dim_3: 30 }];
    const appended = node.appendRows(newRows);
    expect(typeof appended).toBe('boolean');
  });
});
