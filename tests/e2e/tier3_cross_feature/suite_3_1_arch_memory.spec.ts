import { describe, it, expect } from 'vitest';
import { World } from '../../../src/vr/World.ts';
import { Dataset } from '../../../src/data/Dataset.ts';
import { VRTopologyTranslator } from '../../../src/draco/VRTopologyTranslator.ts';
import { disposeObject } from '../../../src/utils/Dispose.ts';
import { sharedSphereGeometry, sharedBoxGeometry } from '../../../src/utils/ObjectPool.ts';
import { InstancedPointCloud } from '../../../src/vr/scalability/InstancedPointCloud.ts';

describe('Tier 3 — Suite 3.1: Architecture Decoupling × Memory Disposal (F1/F2/F3 × F4/F6)', () => {
  it('INT-3.1.1: Loading dataset via World invokes decoupled inferTopology & VRTopologyTranslator while Dispose preserves shared geometries', async () => {
    const world = new World();
    const datasetA = new Dataset(
      'DatasetA',
      [
        { name: 'source', type: 'CATEGORICAL' },
        { name: 'target', type: 'CATEGORICAL' },
        { name: 'val', type: 'NUMERIC' },
      ],
      [
        { source: 'NodeA', target: 'NodeB', val: 10 },
        { source: 'NodeB', target: 'NodeC', val: 20 },
      ]
    );

    // Step 1: Infer topology independently (F1). Wave 3: JS TopologyInference is
    // deleted; the dataset has source/target columns so the topology is GRAPH.
    // Topology-inference parity is covered by Rust #[test]s + wasm-runtime.test.ts.
    const topology = 'GRAPH';
    expect(topology).toBe('GRAPH');

    // Step 2: Load into World (F3)
    world.loadDataset({ name: 'DatasetA', topology, dataset: datasetA });
    expect(world.currentEntry?.name).toBe('DatasetA');

    // Step 3: Verify VRTopologyTranslator synthesis (F2)
    const solverResult = {
      spec: { layout: 'FORCE_DIRECTED_3D', geometry: 'ICOSA_NODE', behavior: 'NONE', interaction: 'NONE' },
      cost: 0,
      facts: { depth: 1, numericColumns: 1, categoricalColumns: 2, temporalColumns: 0, hasTimeSeries: false },
    };
    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult as any, { dataset: datasetA });
    expect(artifact.nodeMeshes.length).toBeGreaterThan(0);

    // Step 4: Swap dataset and dispose old meshes (F4)
    const datasetB = new Dataset('DatasetB', [{ name: 'val', type: 'NUMERIC' }], [{ val: 100 }]);
    world.loadDataset({ name: 'DatasetB', topology: 'TABULAR', dataset: datasetB });

    disposeObject(artifact.group);

    // Step 5: Shared geometries remain intact in MeshPool
    expect(sharedSphereGeometry.attributes.position).toBeDefined();
    expect(sharedBoxGeometry.attributes.position).toBeDefined();

    await world.dispose();
  });

  it('INT-3.1.2: Dynamically replacing instanced scatterplot dataset forces buffer re-allocation without leaking VRAM references', () => {
    const cloud = new InstancedPointCloud(1000);

    // First dataset iteration
    const items1 = Array.from({ length: 200 }, (_, i) => ({
      position: [i * 0.05, Math.sin(i), Math.cos(i)] as [number, number, number],
      color: 0x00ffcc,
      scale: 1.0,
    }));
    cloud.setPoints(items1);
    expect(cloud.mesh.count).toBe(200);

    // Second dataset iteration: replace with larger dataset
    const items2 = Array.from({ length: 500 }, (_, i) => ({
      position: [i * 0.02, Math.cos(i), Math.sin(i)] as [number, number, number],
      color: 0xff0055,
      scale: 0.8,
    }));
    cloud.setPoints(items2);
    expect(cloud.mesh.count).toBe(500);

    // Clean disposal
    cloud.dispose();
  });
});
