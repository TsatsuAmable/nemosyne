// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  applyFilter,
  applySort,
  applySlice,
  captureBaseState,
} from '../src/vr/interactions/DataOperations.ts';
import { applyAnomalyHighlight } from '../src/vr/interactions/AnomalyTransforms.ts';
import { applyNestedRings } from '../src/vr/interactions/ClusterTransforms.ts';

function makeDataset(rows: Record<string, unknown>[], ids: string[]): Dataset {
  return new Dataset(
    'rows',
    [
      { name: 'label', type: ColumnType.CATEGORICAL },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    rows,
    undefined,
    ids
  );
}

function artifactFrom(dataset: Dataset) {
  const rendered = Dataset.fromJSON(dataset.toJSON());
  const nodeMeshes = rendered.rows.map((row, index) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshStandardMaterial({ opacity: 1 })
    );
    mesh.position.set(index, 0, -3.5);
    mesh.userData.row = row;
    mesh.userData.baseScale = 1;
    mesh.userData.baseOpacity = 1;
    return mesh;
  });
  const artifact = { nodeMeshes } as any;
  captureBaseState(artifact);
  return artifact;
}

describe('VR durable row identity', () => {
  it('filters duplicate-valued reconstructed observations independently', () => {
    const source = makeDataset(
      [
        { label: 'same', value: 42 },
        { label: 'same', value: 42 },
      ],
      ['rust:0', 'rust:1']
    );
    const artifact = artifactFrom(source);
    const result = makeDataset([{ label: 'same', value: 42 }], ['rust:1']);

    applyFilter(artifact, result);

    expect(artifact.nodeMeshes[0].scale.x).toBeLessThan(0.1);
    expect(artifact.nodeMeshes[1].scale.x).toBeGreaterThan(0.5);
  });

  it('sorts reconstructed observations by durable identity rather than object identity', () => {
    const source = makeDataset(
      [
        { label: 'a', value: 30 },
        { label: 'b', value: 10 },
        { label: 'c', value: 20 },
      ],
      ['rust:a', 'rust:b', 'rust:c']
    );
    const artifact = artifactFrom(source);
    const sorted = makeDataset(
      [
        { label: 'b', value: 10 },
        { label: 'c', value: 20 },
        { label: 'a', value: 30 },
      ],
      ['rust:b', 'rust:c', 'rust:a']
    );

    applySort(artifact, sorted);

    const leftmost = [...artifact.nodeMeshes].sort((a, b) => a.position.x - b.position.x)[0];
    expect(leftmost.userData.row.label).toBe('b');
  });

  it('slices reconstructed observations using IDs instead of reference equality', () => {
    const source = makeDataset(
      [
        { label: 'a', value: 1 },
        { label: 'b', value: 2 },
        { label: 'c', value: 3 },
      ],
      ['rust:a', 'rust:b', 'rust:c']
    );
    const artifact = artifactFrom(source);
    const sliced = makeDataset([{ label: 'c', value: 3 }], ['rust:c']);

    applySlice(artifact, sliced, source);

    expect(artifact.nodeMeshes[2].scale.x).toBeGreaterThan(0.5);
    expect(artifact.nodeMeshes[0].scale.x).toBeLessThan(0.3);
    expect(artifact.nodeMeshes[1].scale.x).toBeLessThan(0.3);
  });

  it('maps anomaly flags to the correct mesh after result reordering', () => {
    const source = makeDataset(
      [
        { label: 'a', value: 1 },
        { label: 'b', value: 100 },
      ],
      ['rust:a', 'rust:b']
    );
    const artifact = artifactFrom(source);
    const anomalous = new Dataset(
      source.name,
      [...source.columns, { name: '_anomaly', type: ColumnType.CATEGORICAL }],
      [
        { label: 'b', value: 100, _anomaly: true, _anomalyScore: 9 },
        { label: 'a', value: 1, _anomaly: false, _anomalyScore: 0 },
      ],
      undefined,
      ['rust:b', 'rust:a']
    );

    applyAnomalyHighlight(artifact, anomalous);

    expect(artifact.nodeMeshes[0].userData.halo?.visible).toBe(false);
    expect(artifact.nodeMeshes[1].userData.halo?.visible).toBe(true);
  });

  it('maps cluster layouts across reconstructed row objects', () => {
    const source = makeDataset(
      [
        { label: 'a', value: 1 },
        { label: 'b', value: 2 },
      ],
      ['rust:a', 'rust:b']
    );
    const artifact = artifactFrom(source);
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
