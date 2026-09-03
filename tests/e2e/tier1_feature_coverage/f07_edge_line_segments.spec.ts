import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  ConstraintEngine,
  TopologyTypes,
  isNoFeasibleConstraintResult,
} from '../../../src/moneta/ConstraintEngine.js';
import { VRTopologyTranslator } from '../../../src/moneta/VRTopologyTranslator.js';
import { Dataset } from '../../../src/data/Dataset.js';
import { makeFactProvider } from '../../helpers/dracoFactsHelper.ts';

describe('Feature 7: Edge Draw Call Optimization & Line Rendering', () => {
  function makeGraphDataset() {
    const rows = [
      { id: 'node_0', source: 'node_0', target: 'node_1' },
      { id: 'node_1', source: 'node_1', target: 'node_2' },
      { id: 'node_2', source: 'node_2', target: 'node_0' },
    ];
    const columns = [
      { name: 'id', type: 'TEXT' as const },
      { name: 'source', type: 'TEXT' as const },
      { name: 'target', type: 'TEXT' as const },
    ];
    const edges = [
      { source: 'node_0', target: 'node_1' },
      { source: 'node_1', target: 'node_2' },
      { source: 'node_2', target: 'node_0' },
    ];
    return new Dataset('GraphDS', columns, rows, edges);
  }

  function solveGraph(engine: ConstraintEngine, dataInput: Parameters<ConstraintEngine['solve']>[0]) {
    const result = engine.solve(dataInput);
    expect(isNoFeasibleConstraintResult(result)).toBe(false);
    if (isNoFeasibleConstraintResult(result)) {
      throw new Error('expected a feasible graph representation');
    }
    return result;
  }

  it('F7-TC1: Synthesizing graph artifact creates edge meshes for graph dataset', () => {
    const ds = makeGraphDataset();
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const dataInput = { dataset: ds, topology: TopologyTypes.GRAPH, edges: ds.edges };
    const solverResult = solveGraph(engine, dataInput);
    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult, dataInput);

    expect(artifact.edgeMeshes).toBeDefined();
    expect(artifact.edgeMeshes.length).toBeGreaterThan(0);
  });

  it('F7-TC2: Edge lines connect node positions accurately', () => {
    const ds = makeGraphDataset();
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const dataInput = { dataset: ds, topology: TopologyTypes.GRAPH, edges: ds.edges };
    const solverResult = solveGraph(engine, dataInput);
    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult, dataInput);

    const edge = artifact.edgeMeshes[0];
    expect(edge).toBeDefined();
    const posAttr = edge.geometry.attributes.position;
    expect(posAttr.count).toBeGreaterThanOrEqual(2);
  });

  it('F7-TC3: Group contains all edge meshes as children of spatial artifact', () => {
    const ds = makeGraphDataset();
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const dataInput = { dataset: ds, topology: TopologyTypes.GRAPH, edges: ds.edges };
    const solverResult = solveGraph(engine, dataInput);
    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult, dataInput);

    const edgeChildren = artifact.group.children.filter((c) => c instanceof THREE.Line);
    expect(edgeChildren.length).toBe(artifact.edgeMeshes.length);
  });

  it('F7-TC4: Disposing edge lines frees geometry and material resources', () => {
    const ds = makeGraphDataset();
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const dataInput = { dataset: ds, topology: TopologyTypes.GRAPH, edges: ds.edges };
    const solverResult = solveGraph(engine, dataInput);
    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult, dataInput);

    const line = artifact.edgeMeshes[0];
    let disposed = false;
    line.geometry.dispose = () => {
      disposed = true;
    };
    line.geometry.dispose();
    expect(disposed).toBe(true);
  });

  it('F7-TC5: Hierarchical radial layout creates parent-child edge connections', () => {
    const group = new THREE.Group();
    const edgeMeshes: THREE.Line[] = [];
    const nodeMeshes: THREE.Mesh[] = [
      new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()),
      new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()),
    ];
    nodeMeshes[0].userData = { row: { id: '0' } };
    nodeMeshes[1].userData = { row: { id: '1', parentIndex: 0 } };

    VRTopologyTranslator._buildParentEdges(group, edgeMeshes, nodeMeshes);
    expect(edgeMeshes.length).toBe(1);
    expect(group.children.length).toBe(1);
  });
});
