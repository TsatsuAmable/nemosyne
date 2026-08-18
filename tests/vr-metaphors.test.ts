// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ConstraintEngine, TopologyTypes } from '../src/draco/ConstraintEngine.ts';
import { VRTopologyTranslator } from '../src/draco/VRTopologyTranslator.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeFactProvider } from './helpers/dracoFactsHelper.ts';
import {
  applyResonancePulse,
  applyForkPlane,
  applyChronoDial,
  applyConstellation,
  applyBeacon,
  applyAleph,
} from '../src/vr/interactions/MetaphorActions.ts';

function makeGraphDataset(count) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    value: i,
  }));
  const edges = [];
  for (let i = 0; i < count - 1; i++) {
    edges.push({ source: `n${i}`, target: `n${i + 1}` });
  }
  return {
    dataset: new Dataset(
      'Graph',
      [
        { name: 'id', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      rows
    ),
    edges,
  };
}

describe('Interaction metaphors', () => {
  it('includes the six new metaphor interaction types in the constraint channel', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const { dataset, edges } = makeGraphDataset(3);
    const result = engine.solve({ topology: TopologyTypes.GRAPH, dataset, edges });

    // Metaphors are available but base interactions still win by default.
    expect(result.spec.interaction).toBe('TRAVERSE_EDGE');
  });

  it('can solve for each metaphor interaction when weights are tuned', () => {
    const engine = new ConstraintEngine({ factProvider: makeFactProvider() });
    const { dataset, edges } = makeGraphDataset(3);
    engine.setWeight('match_interaction_to_topology', 0);
    engine.setWeight('prefer_resonance_for_graphs', 100);

    const result = engine.solve({ topology: TopologyTypes.GRAPH, dataset, edges });
    expect(result.spec.interaction).toBe('RESONANCE_PULSE');
  });

  it('synthesises a beacon artefact for geo topology', () => {
    const ds = new Dataset(
      'Geo',
      [
        { name: 'lat', type: ColumnType.NUMERIC },
        { name: 'lon', type: ColumnType.NUMERIC },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [{ lat: 35, lon: -118, value: 10 }]
    );

    const result = {
      facts: { rowCount: 1, topology: 'GEO' },
      spec: {
        layout: 'GEO_SURFACE',
        geometry: 'GEO_COLUMN',
        behavior: 'STATIC',
        interaction: 'BEACON',
      },
      cost: 0,
    };
    const artifact = VRTopologyTranslator.synthesizeArtifact(result, {
      topology: 'GEO',
      dataset: ds,
    });
    expect(artifact.interactions.type).toBe('BEACON');
    expect(() => artifact.interactions.onSelect(artifact.nodeMeshes[0])).not.toThrow();
  });

  it('applies a resonance pulse effect to graph neighbours', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial()
    );
    mesh.position.set(0, 0, 0);
    const neighbor = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial()
    );
    neighbor.position.set(1, 0, 0);

    applyResonancePulse(group, mesh, [neighbor], { duration: 10 });
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('applies a fork plane effect', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial()
    );
    applyForkPlane(group, mesh, { duration: 10 });
    expect(group.children.length).toBe(1);
  });

  it('applies a chrono dial effect', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial()
    );
    applyChronoDial(group, mesh, { duration: 10 });
    expect(group.children.length).toBe(1);
  });

  it('applies a constellation effect to related nodes', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial()
    );
    const related = [
      new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()),
    ];
    applyConstellation(group, mesh, related, { duration: 10 });
    expect(group.children.length).toBe(1);
  });

  it('applies a beacon effect', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial()
    );
    applyBeacon(group, mesh, { duration: 10 });
    expect(group.children.length).toBe(1);
  });

  it('applies an aleph effect to all other nodes', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial()
    );
    const others = [
      new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()),
      new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()),
    ];
    applyAleph(group, mesh, others, { duration: 10 });
    expect(group.children.length).toBe(2);
  });
});
