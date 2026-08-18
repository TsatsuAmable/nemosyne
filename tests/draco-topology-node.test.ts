// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { DracoTopologyNode } from '../src/draco/DracoTopologyNode.ts';
import { TopologyTypes } from '../src/draco/ConstraintEngine.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeFactProvider } from './helpers/dracoFactsHelper.ts';
import { solveDraco } from '../src/wasm/RuntimeBridge.ts';

// Mock only `solveDraco` on the WASM bridge so the Rust-solver path can be
// exercised in plain jsdom (the real wasm pkg is HTTP-served and skipped here).
// All other RuntimeBridge exports (computeGrid3d etc. used by the layout
// generators) are preserved via importOriginal so TS-path synthesis still works.
vi.mock('../src/wasm/RuntimeBridge.ts', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, solveDraco: vi.fn() };
});

describe('DracoTopologyNode', () => {
  let scene;
  let dataset;

  beforeEach(() => {
    scene = new THREE.Scene();
    dataset = new Dataset(
      'Tabular',
      [
        { name: 'value', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      [
        { value: 10, category: 'A' },
        { value: 20, category: 'B' },
        { value: 30, category: 'A' },
      ]
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs and synthesizes an artifact on creation', () => {
    const node = new DracoTopologyNode(scene, {
      topology: TopologyTypes.TABULAR,
      dataset,
      encodings: { color: 'category' },
    }, undefined, undefined, makeFactProvider());

    expect(node.engine).toBeTruthy();
    expect(node.solverResult).toBeTruthy();
    expect(node.solverResult.spec).toBeTruthy();
    expect(node.artifact).toBeTruthy();
    expect(node.group.parent).toBe(scene);
    expect(node.artifact.nodeMeshes.length).toBeGreaterThan(0);
  });

  it('adjusts a constraint weight and re-solves', () => {
    const node = new DracoTopologyNode(scene, {
      topology: TopologyTypes.TABULAR,
      dataset,
    }, undefined, undefined, makeFactProvider());

    const firstSpec = node.solverResult.spec;
    const firstRule = node.engine.softConstraints[0];
    const startWeight = firstRule.weight;

    node.adjustWeight(firstRule.name, 10);

    expect(firstRule.weight).toBe(startWeight + 10);
    expect(node.solverResult).toBeTruthy();
    expect(node.solverResult.spec).toBeTruthy();
  });

  it('reSolveAndSynthesize replaces the previous artifact in the scene', () => {
    const node = new DracoTopologyNode(scene, {
      topology: TopologyTypes.TABULAR,
      dataset,
    }, undefined, undefined, makeFactProvider());

    const firstGroup = node.group;
    node.reSolveAndSynthesize();

    expect(node.group).not.toBe(firstGroup);
    expect(scene.children).toContain(node.group);
    expect(scene.children).not.toContain(firstGroup);
  });

  it('update delegates to the artifact update', () => {
    const node = new DracoTopologyNode(scene, {
      topology: TopologyTypes.TABULAR,
      dataset,
    }, undefined, undefined, makeFactProvider());

    node.artifact.update = vi.fn();
    node.update(0.016, 1.0);

    expect(node.artifact.update).toHaveBeenCalledWith(0.016, 1.0);
  });

  it('interactWithRay returns a hit mesh for a ray through the artifact', () => {
    const node = new DracoTopologyNode(scene, {
      topology: TopologyTypes.TABULAR,
      dataset,
    }, undefined, undefined, makeFactProvider());

    // Find a node mesh and cast a ray from slightly in front of it toward it.
    const target = node.artifact.nodeMeshes[0];
    target.updateMatrixWorld(true);
    const center = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);
    const origin = center.clone().add(new THREE.Vector3(0, 0, 0.5));
    const direction = new THREE.Vector3().subVectors(center, origin).normalize();
    const raycaster = new THREE.Raycaster(origin, direction);
    const hit = node.interactWithRay(raycaster);

    expect(hit).toBeTruthy();
    expect(node.artifact.nodeMeshes).toContain(hit);
  });

  it('interactWithRay returns null for a ray that misses', () => {
    const node = new DracoTopologyNode(scene, {
      topology: TopologyTypes.TABULAR,
      dataset,
    }, undefined, undefined, makeFactProvider());

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(10, 10, 10),
      new THREE.Vector3(1, 0, 0)
    );
    const hit = node.interactWithRay(raycaster);

    expect(hit).toBeNull();
  });

  it('appendRows updates the dataset and returns true when incremental succeeds', () => {
    const node = new DracoTopologyNode(scene, {
      topology: TopologyTypes.TABULAR,
      dataset,
    }, undefined, undefined, makeFactProvider());

    const before = node.dataInput.dataset.rowCount;
    const result = node.appendRows([{ value: 40, category: 'C' }], { mode: 'append' });

    expect(node.dataInput.dataset.rowCount).toBe(before + 1);
  });

  it('appendRows returns true when incremental path succeeds', () => {
    const node = new DracoTopologyNode(scene, {
      topology: TopologyTypes.TIME_SERIES,
      dataset: new Dataset(
        'Time',
        [
          { name: 'time', type: ColumnType.TEMPORAL },
          { name: 'value', type: ColumnType.NUMERIC },
        ],
        [{ time: '2026-07-28T00:00:00', value: 1 }]
      ),
    }, undefined, undefined, makeFactProvider());

    const before = node.dataInput.dataset.rowCount;
    const result = node.appendRows([{ time: '2026-07-28T01:00:00', value: 2 }]);

    expect(node.dataInput.dataset.rowCount).toBe(before + 1);
  });
});

describe('DracoTopologyNode — Rust solver cutover (opt-in)', () => {
  let scene;
  let dataset;
  const dataInput = () => ({
    topology: TopologyTypes.TABULAR,
    dataset,
    encodings: { color: 'category' },
  });

  beforeEach(() => {
    scene = new THREE.Scene();
    dataset = new Dataset(
      'Tabular',
      [
        { name: 'value', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
      ],
      [
        { value: 10, category: 'A' },
        { value: 20, category: 'B' },
        { value: 30, category: 'A' },
      ]
    );
    solveDraco.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('solves via Rust draco_solve when useRustSolver is true', () => {
    solveDraco.mockReturnValue({
      facts: { rowCount: 3 },
      spec: { layout: 'GRID_3D', geometry: 'CUBE_MATRIX', behavior: 'STATIC', interaction: 'INSPECT_CELL' },
      cost: 42,
    });

    const node = new DracoTopologyNode(scene, dataInput(), undefined, undefined, makeFactProvider(), true);

    expect(solveDraco).toHaveBeenCalledTimes(1);
    // The single call happened during construction; verify the spec came from Rust.
    expect(node.solverResult.spec.layout).toBe('GRID_3D');
    expect(node.solverResult.spec.geometry).toBe('CUBE_MATRIX');
    expect(node.solverResult.cost).toBe(42);
    // The authoritative facts are the TS FactProvider's, not the Rust subset.
    expect(node.solverResult.facts.rowCount).toBe(3);
    expect(node.solverResult.facts).toHaveProperty('columnStats');
    // An artifact was still synthesized from the Rust spec.
    expect(node.artifact).toBeTruthy();
    expect(node.group.parent).toBe(scene);
  });

  it('throws when useRustSolver is true but the WASM runtime is not initialised (null)', () => {
    solveDraco.mockReturnValue(null);
    expect(() => new DracoTopologyNode(scene, dataInput(), undefined, undefined, makeFactProvider(), true)).toThrow(
      /draco_solve returned null/
    );
  });

  it('throws when useRustSolver is true but no FactProvider is configured', () => {
    solveDraco.mockReturnValue({ spec: { layout: 'GRID_3D' }, cost: 1 });
    expect(() => new DracoTopologyNode(scene, dataInput(), undefined, undefined, null, true)).toThrow(
      /no facts provided/
    );
  });

  it('rejects adjustWeight under the Rust path (not exposed through the ABI)', () => {
    solveDraco.mockReturnValue({
      spec: { layout: 'GRID_3D', geometry: 'CUBE_MATRIX', behavior: 'STATIC', interaction: 'INSPECT_CELL' },
      cost: 1,
    });
    const node = new DracoTopologyNode(scene, dataInput(), undefined, undefined, makeFactProvider(), true);
    expect(() => node.adjustWeight('preferGridForTabular', 10)).toThrow(/not exposed through the Rust draco_solve ABI/);
  });

  it('re-solve re-invokes the Rust solver', () => {
    solveDraco.mockReturnValue({
      spec: { layout: 'GRID_3D', geometry: 'CUBE_MATRIX', behavior: 'STATIC', interaction: 'INSPECT_CELL' },
      cost: 1,
    });
    const node = new DracoTopologyNode(scene, dataInput(), undefined, undefined, makeFactProvider(), true);
    node.reSolveAndSynthesize();
    expect(solveDraco).toHaveBeenCalledTimes(2);
  });
});
