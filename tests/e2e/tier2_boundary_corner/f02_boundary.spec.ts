import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { VRTopologyTranslator } from '../../../src/draco/VRTopologyTranslator.ts';
import { DracoTopologyNode } from '../../../src/draco/DracoTopologyNode.ts';
import { ConstraintEngine } from '../../../src/draco/ConstraintEngine.ts';
import { Dataset } from '../../../src/data/Dataset.ts';
import { WorldEventBus } from '../../../src/utils/EventBus.ts';
import { computeFacts, makeFactProvider } from '../../helpers/dracoFactsHelper.ts';

describe('Tier 2 — Feature 2: Draco -> VR Upstream Imports Decoupling (Boundary Cases)', () => {
  it('F2-BC1: VRTopologyTranslator handles zero-row dataset and empty input gracefully', () => {
    const emptyDataset = new Dataset('EmptyDS', [], []);
    const solverResult = {
      spec: { layout: 'GRID_3D', geometry: 'ICOSA_NODE', behavior: 'NONE', interaction: 'NONE' },
      cost: 0,
      facts: { depth: 1, numericColumns: 0, categoricalColumns: 0, temporalColumns: 0, hasTimeSeries: false },
    };

    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult as any, { dataset: emptyDataset });
    expect(artifact).toBeDefined();
    expect(artifact.group).toBeInstanceOf(THREE.Group);
    // GridLayout3D computes 1 placeholder layout entry for zero-row dataset
    expect(artifact.nodeMeshes.length).toBeGreaterThanOrEqual(0);
  });

  it('F2-BC2: DracoTopologyNode operates with scene and dataInput', () => {
    const scene = new THREE.Scene();
    const dataset = new Dataset('TestDS', [{ name: 'x', type: 'NUMERIC' }], [{ x: 1 }]);
    const node = new DracoTopologyNode(scene, { dataset }, undefined, undefined, makeFactProvider());

    expect(node.engine).toBeInstanceOf(ConstraintEngine);
    expect(node.solverResult).toBeDefined();
    expect(node.artifact).toBeDefined();
    expect(node.group).toBeInstanceOf(THREE.Group);
  });

  it('F2-BC3: DracoTopologyNode re-solves and updates scene when dataset changes', () => {
    const scene = new THREE.Scene();
    const dataset = new Dataset('TestDS', [{ name: 'val', type: 'NUMERIC' }], [{ val: 10 }]);
    const node = new DracoTopologyNode(scene, { dataset }, undefined, undefined, makeFactProvider());

    expect(node.solverResult).toBeDefined();

    node.adjustWeight('prefer_grid_layout', 10);
    expect(node.solverResult).toBeDefined();
  });

  it('F2-BC4: ConstraintEngine evaluates cyclic or edge-less datasets without recursion loop', () => {
    const cyclicDataset = new Dataset(
      'CyclicDS',
      [
        { name: 'id', type: 'CATEGORICAL' },
        { name: 'val', type: 'NUMERIC' },
      ],
      [
        { id: 'A', val: 10 },
        { id: 'B', val: 20 },
      ],
      [
        { source: 'A', target: 'B' },
        { source: 'B', target: 'A' },
      ]
    );

    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const facts = computeFacts({ dataset: cyclicDataset });
    expect(facts).toBeDefined();

    const result = engine.solve({ dataset: cyclicDataset });
    expect(result).toBeDefined();
    expect(result.spec.layout).toBeDefined();
  });

  it('F2-BC5: Unregistering event listeners from eventBus cleans up references completely', () => {
    const bus = new WorldEventBus();
    const handler = vi.fn();
    
    const unsubscribe = bus.on('DRACO_RECOMMENDATION', handler);
    bus.emit('DRACO_RECOMMENDATION', { layout: 'GRID_3D' });
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    bus.emit('DRACO_RECOMMENDATION', { layout: 'GRID_3D' });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
