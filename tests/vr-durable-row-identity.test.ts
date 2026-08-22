import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import type { ArtifactRef } from '../src/vr/coordinators/types.ts';
import {
  applyFilter,
  applySort,
  applySlice,
} from '../src/vr/interactions/DataOperations.ts';
import { applyAnomalyHighlight } from '../src/vr/interactions/AnomalyTransforms.ts';
import { applyNestedRings } from '../src/vr/interactions/ClusterTransforms.ts';

function meshFor(row: Record<string, unknown>): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  mesh.userData.row = row;
  mesh.userData.baseScale = 1;
  mesh.userData.baseOpacity = 1;
  return mesh;
}

function artifactFor(dataset: Dataset): ArtifactRef {
  const nodeMeshes = dataset.rows.map(meshFor);
  const group = new THREE.Group();
  for (const mesh of nodeMeshes) group.add(mesh);
  return { nodeMeshes, group };
}

describe('durable row identity across reconstructed VR results', () => {
  it('filter keeps only the matching durable observation when values are duplicated', () => {
    const source = new Dataset(
      'dup',
      [
        { name: 'label', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { label: 'same', value: 1 },
        { label: 'same', value: 1 },
      ],
      undefined,
      ['rust:a', 'rust:b']
    );
    const artifact = artifactFor(source);
    const filtered = new Dataset(
      source.name,
      source.columns,
      [{ label: 'same', value: 1 }],
      undefined,
      ['rust:b']
    );

    applyFilter(artifact, filtered);

    expect(artifact.nodeMeshes[0].scale.x).toBeLessThan(0.1);
    expect(artifact.nodeMeshes[1].scale.x).toBeGreaterThan(0.5);
  });

  it('sort reorders reconstructed rows by durable identity rather than object identity', () => {
    const source = new Dataset(
      'sort',
      [
        { name: 'label', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { label: 'a', value: 3 },
        { label: 'b', value: 1 },
        { label: 'c', value: 2 },
      ],
      undefined,
      ['rust:a', 'rust:b', 'rust:c']
    );
    const artifact = artifactFor(source);
    const sorted = new Dataset(
      source.name,
      source.columns,
      [
        { label: 'b', value: 1 },
        { label: 'c', value: 2 },
        { label: 'a', value: 3 },
      ],
      undefined,
      ['rust:b', 'rust:c', 'rust:a']
    );

    applySort(artifact, sorted);

    const leftmost = artifact.nodeMeshes.reduce((a, b) => (a.position.x < b.position.x ? a : b));
    expect(leftmost.userData.row.label).toBe('b');
  });

  it('slice matches reconstructed rows by durable identity', () => {
    const source = new Dataset(
      'slice',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }, { value: 3 }],
      undefined,
      ['rust:1', 'rust:2', 'rust:3']
    );
    const artifact = artifactFor(source);
    const sliced = new Dataset(
      source.name,
      source.columns,
      [{ value: 2 }],
      undefined,
      ['rust:2']
    );

    applySlice(artifact, sliced, source);

    expect(artifact.nodeMeshes[0].scale.x).toBeLessThanOrEqual(0.2);
    expect(artifact.nodeMeshes[1].scale.x).toBeGreaterThanOrEqual(0.5);
    expect(artifact.nodeMeshes[2].scale.x).toBeLessThanOrEqual(0.2);
  });

  it('anomaly highlighting follows durable identity after result reordering', () => {
    const source = new Dataset(
      'anomaly',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 99 }],
      undefined,
      ['rust:normal', 'rust:outlier']
    );
    const artifact = artifactFor(source);
    const anomalous = new Dataset(
      source.name,
      [...source.columns, { name: '_anomaly', type: ColumnType.UNKNOWN }],
      [
        { value: 99, _anomaly: true, _anomalyScore: 9 },
        { value: 1, _anomaly: false, _anomalyScore: 0 },
      ],
      undefined,
      ['rust:outlier', 'rust:normal']
    );

    applyAnomalyHighlight(artifact, anomalous);

    expect(artifact.nodeMeshes[0].userData.halo.visible).toBe(false);
    expect(artifact.nodeMeshes[1].userData.halo.visible).toBe(true);
  });

  it('cluster layouts resolve reconstructed members by durable identity', () => {
    const source = new Dataset(
      'cluster',
      [
        { name: 'label', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { label: 'a', value: 1 },
        { label: 'b', value: 2 },
      ],
      undefined,
      ['rust:a', 'rust:b']
    );
    const artifact = artifactFor(source);
    const clustered = new Dataset(
      source.name,
      [...source.columns, { name: '_cluster', type: ColumnType.NUMERIC }],
      [
        { label: 'b', value: 2, _cluster: 1 },
        { label: 'a', value: 1, _cluster: 0 },
      ],
      undefined,
      ['rust:b', 'rust:a']
    );

    applyNestedRings(artifact, clustered);

    expect(artifact.nodeMeshes.some((mesh) => Math.abs(mesh.position.x) > 0.5)).toBe(true);
  });
});
