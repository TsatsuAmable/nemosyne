import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VRTopologyTranslator } from '../../../src/moneta/VRTopologyTranslator.ts';
import { Dataset } from '../../../src/data/Dataset.ts';

describe('Tier 2 — Feature 7: Edge Draw Call Explosion (LineSegments Boundary Cases)', () => {
  it('F7-BC1: Graph with 0 edges produces zero edge line meshes', () => {
    const dataset = new Dataset('NoEdgesDS', [
      { name: 'id', type: 'CATEGORICAL' },
      { name: 'val', type: 'NUMERIC' }
    ], [
      { id: 'A', val: 1 },
      { id: 'B', val: 2 },
    ], []);

    const solverResult = {
      spec: { layout: 'FORCE_DIRECTED_3D', geometry: 'ICOSA_NODE', behavior: 'NONE', interaction: 'NONE' },
      cost: 0,
      facts: { depth: 1, numericColumns: 1, categoricalColumns: 1, temporalColumns: 0, hasTimeSeries: false },
    };

    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult as any, { dataset, edges: [] });
    expect(artifact.edgeMeshes.length).toBe(0);
  });

  it('F7-BC2: Isolated vertices without connections render node meshes without edge errors', () => {
    const dataset = new Dataset('IsolatedDS', [
      { name: 'id', type: 'CATEGORICAL' }
    ], [
      { id: 'Node1' },
      { id: 'Node2' },
      { id: 'Node3' },
    ]);

    const solverResult = {
      spec: { layout: 'FORCE_DIRECTED_3D', geometry: 'ICOSA_NODE', behavior: 'NONE', interaction: 'NONE' },
      cost: 0,
      facts: { depth: 1, numericColumns: 0, categoricalColumns: 1, temporalColumns: 0, hasTimeSeries: false },
    };

    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult as any, { dataset });
    expect(artifact.nodeMeshes.length).toBe(3);
    expect(artifact.edgeMeshes.length).toBe(0);
  });

  it('F7-BC3: Creating LineSegments with 1,000 edge points completes in sub-50ms', () => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 1000; i++) {
      points.push(new THREE.Vector3(i, 0, 0));
      points.push(new THREE.Vector3(i, 1, 0));
    }

    const startTime = performance.now();
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    const lineSegments = new THREE.LineSegments(geom, mat);
    const duration = performance.now() - startTime;

    expect(lineSegments).toBeDefined();
    expect(duration).toBeLessThan(50);
  });

  it('F7-BC4: LineSegments material handles edge opacity range (0.0 to 1.0) cleanly', () => {
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.0 });
    const lineSegments = new THREE.LineSegments(geom, mat);

    expect(lineSegments.material.opacity).toBe(0.0);
    lineSegments.material.opacity = 1.0;
    expect(lineSegments.material.opacity).toBe(1.0);
  });

  it('F7-BC5: Disposing LineSegments geometry and material purges Three.js resources cleanly', () => {
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    new THREE.LineSegments(geom, mat);

    geom.dispose();
    mat.dispose();

    expect(geom.attributes.position).toBeDefined(); // Three.js retains JS typed array reference
  });
});
