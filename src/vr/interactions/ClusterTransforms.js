/**
 * Cluster visualisation transforms for VR artefacts.
 *
 * Turns the `_cluster` column produced by k-means, hierarchical, or DBSCAN
 * into spatial layouts: nested rings for compact clusters, density clouds for
 * DBSCAN, and dendrogram arcs for hierarchical results.
 */

import * as THREE from 'three';

const DEFAULT_PALETTE = [0x00ffcc, 0xff0055, 0x88ccff, 0xffcc00, 0xcc66ff, 0x00cc66];

/** Move artefact nodes into nested rings, one ring per cluster. */
export function applyNestedRings(artifact, clusteredDataset, options = {}) {
  const clusters = collectClusters(clusteredDataset);
  const clusterIds = [...clusters.keys()].sort((a, b) => a - b);
  const { ringStep = 0.9, baseRadius = 1.6, centreZ = -3.5 } = options;

  clusterIds.forEach((id, cIdx) => {
    const members = clusters.get(id);
    const ringRadius = baseRadius + cIdx * ringStep;
    const count = members.length;
    members.forEach((row, i) => {
      const mesh = findMeshForRow(artifact, row);
      if (!mesh) return;
      const angle = count > 1 ? (i / count) * Math.PI * 2 : 0;
      const x = Math.cos(angle) * ringRadius;
      const z = Math.sin(angle) * ringRadius + centreZ;
      mesh.position.set(x, mesh.position.y, z);
      mesh.scale.setScalar(mesh.userData.baseScale ?? 1);
      if (mesh.material.opacity !== undefined) mesh.material.opacity = 1;
      colourMesh(mesh, cIdx);
    });
  });
}

/** Move DBSCAN results into density clouds; noise points sink below the plane. */
export function applyDensityCloud(artifact, clusteredDataset, options = {}) {
  const clusters = collectClusters(clusteredDataset);
  const clusterIds = [...clusters.keys()].sort((a, b) => a - b);
  const { spread = 1.4, baseY = 0, noiseY = -0.6, centreZ = -3.5 } = options;

  clusterIds.forEach((id, cIdx) => {
    const isNoise = id === -1;
    const members = clusters.get(id);
    const count = members.length;
    const radius = isNoise ? spread * 2.5 : spread * (1 + cIdx * 0.35);
    const y = isNoise ? noiseY : baseY;
    members.forEach((row, i) => {
      const mesh = findMeshForRow(artifact, row);
      if (!mesh) return;
      const angle = count > 1 ? (i / count) * Math.PI * 2 : 0;
      const r = isNoise ? radius * (0.5 + 0.5 * Math.random()) : radius;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r + centreZ;
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(mesh.userData.baseScale ?? 1);
      if (mesh.material.opacity !== undefined) {
        mesh.material.opacity = isNoise ? 0.4 : 1;
      }
      if (!isNoise) colourMesh(mesh, cIdx);
    });
  });
}

/** Place hierarchical clusters along arcs that hint at a dendrogram. */
export function applyDendrogramArc(artifact, clusteredDataset, options = {}) {
  const clusters = collectClusters(clusteredDataset);
  const clusterIds = [...clusters.keys()].sort((a, b) => a - b);
  const { baseRadius = 1.2, ringStep = 1.2, arcSpan = Math.PI, centreZ = -3.5 } = options;

  clusterIds.forEach((id, cIdx) => {
    const members = clusters.get(id);
    const count = members.length;
    const ringRadius = baseRadius + cIdx * ringStep;
    const startAngle = -arcSpan / 2 + cIdx * 0.2;
    const endAngle = arcSpan / 2 + cIdx * 0.2;
    members.forEach((row, i) => {
      const mesh = findMeshForRow(artifact, row);
      if (!mesh) return;
      const t = count > 1 ? i / (count - 1) : 0.5;
      const angle = startAngle + t * (endAngle - startAngle);
      const x = Math.cos(angle) * ringRadius;
      const z = Math.sin(angle) * ringRadius + centreZ;
      mesh.position.set(x, mesh.position.y + cIdx * 0.15, z);
      mesh.scale.setScalar(mesh.userData.baseScale ?? 1);
      if (mesh.material.opacity !== undefined) mesh.material.opacity = 1;
      colourMesh(mesh, cIdx);
    });
  });
}

/** Choose a layout style from the clustering algorithm used. */
export function autoLayout(artifact, clusteredDataset, algorithmHint = 'kmeans') {
  if (algorithmHint === 'dbscan') {
    applyDensityCloud(artifact, clusteredDataset);
  } else if (algorithmHint === 'hierarchical') {
    applyDendrogramArc(artifact, clusteredDataset);
  } else {
    applyNestedRings(artifact, clusteredDataset);
  }
}

function collectClusters(clusteredDataset) {
  const clusters = new Map();
  for (let i = 0; i < clusteredDataset.rowCount; i++) {
    const row = clusteredDataset.rows[i];
    const id = row._cluster ?? 0;
    if (!clusters.has(id)) clusters.set(id, []);
    clusters.get(id).push(row);
  }
  return clusters;
}

function findMeshForRow(artifact, row) {
  return artifact.nodeMeshes?.find((m) => m.userData.row === row);
}

function colourMesh(mesh, clusterIndex) {
  if (mesh.material && mesh.material.color) {
    mesh.material.color.setHex(DEFAULT_PALETTE[clusterIndex % DEFAULT_PALETTE.length]);
  }
}
