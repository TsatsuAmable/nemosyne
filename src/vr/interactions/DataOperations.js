/**
 * Maps dataset operations to VR artefact transforms.
 *
 * Each function takes the current artefact (from VRTopologyTranslator) and the
 * result of a DatasetOperation, then updates mesh position/scale/opacity so the
 * visual change matches the data operation metaphorically.
 */

import * as THREE from 'three';
import { applyNestedRings, applyDendrogramArc, applyDensityCloud } from './ClusterTransforms.js';
import { applyAnomalyHighlight, clearAnomalyHighlight, applyOutlierLens, releaseOutlierLens } from './AnomalyTransforms.js';

/**
 * Apply a filter operation: rows present in the filtered dataset remain visible,
 * absent rows shrink and fade below the DatumPlane.
 * @param {{ nodeMeshes: THREE.Mesh[], group: THREE.Group }} artifact
 * @param {import('../../data/Dataset.js').Dataset} filteredDataset
 */
export function applyFilter(artifact, filteredDataset) {
  const kept = new Set(filteredDataset.rows);
  for (const mesh of artifact.nodeMeshes) {
    const row = mesh.userData.row;
    if (kept.has(row)) {
      mesh.scale.setScalar(mesh.userData.baseScale ?? 1);
      mesh.material.opacity = mesh.userData.baseOpacity ?? 1;
      mesh.material.transparent = mesh.userData.baseTransparent ?? false;
      mesh.position.y = Math.max(0.2, mesh.position.y + 0.3);
    } else {
      mesh.scale.setScalar(0.05);
      if (mesh.material.opacity !== undefined) mesh.material.opacity = 0.15;
      mesh.position.y = -0.5;
    }
  }
}

/**
 * Apply a sort operation: reorder visible nodes along a horizontal arc.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 * @param {import('../../data/Dataset.js').Dataset} sortedDataset
 */
export function applySort(artifact, sortedDataset) {
  const order = sortedDataset.rows;
  const count = order.length;
  const radius = 4;
  const width = Math.min(radius * 2, count * 0.9);
  for (let i = 0; i < count; i++) {
    const row = order[i];
    const mesh = artifact.nodeMeshes.find((m) => m.userData.row === row);
    if (!mesh) continue;
    const t = count > 1 ? i / (count - 1) : 0.5;
    const x = (t - 0.5) * width;
    const z = -3.5 + Math.cos(t * Math.PI) * 1.2;
    mesh.position.set(x, mesh.position.y, z);
  }
}

/**
 * Apply an aggregate operation: grouped rows merge into a single larger orb/column.
 * For every unique aggregated row, matching original meshes are hidden and a new
 * aggregated marker is scaled by the group size.
 * @param {{ nodeMeshes: THREE.Mesh[], group: THREE.Group }} artifact
 * @param {import('../../data/Dataset.js').Dataset} aggregatedDataset
 */
export function applyAggregate(artifact, aggregatedDataset) {
  // For simplicity, hide all original nodes and scale the first node of each
  // group to represent the aggregate. In a full implementation this would spawn
  // new aggregate meshes.
  for (const mesh of artifact.nodeMeshes) {
    mesh.scale.setScalar(0.05);
    if (mesh.material.opacity !== undefined) mesh.material.opacity = 0.2;
  }

  const groupKey = aggregatedDataset.name; // placeholder
  const count = aggregatedDataset.rowCount;
  if (count > 0 && artifact.nodeMeshes[0]) {
    const rep = artifact.nodeMeshes[0];
    rep.scale.setScalar(Math.min(3, 1 + count * 0.15));
    rep.material.opacity = 1;
    rep.position.set(0, rep.position.y + 0.5, -3.5);
    rep.userData.aggregated = true;
    rep.userData.aggregateCount = count;
  }
}

/**
 * Apply a cluster operation: move nodes into nested rings grouped by their `_cluster` value.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 * @param {import('../../data/Dataset.js').Dataset} clusteredDataset
 */
export function applyCluster(artifact, clusteredDataset) {
  applyNestedRings(artifact, clusteredDataset, { baseRadius: 2, ringStep: 0.8, centreZ: -3.5 });
}

/**
 * Apply a hierarchical clustering operation: arrange clusters in dendrogram-like arcs.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 * @param {import('../../data/Dataset.js').Dataset} clusteredDataset
 */
export function applyHierarchicalCluster(artifact, clusteredDataset) {
  applyDendrogramArc(artifact, clusteredDataset, { baseRadius: 1.2, ringStep: 1.2, centreZ: -3.5 });
}

/**
 * Apply a DBSCAN result: dense clusters become clouds; noise points sink below the plane.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 * @param {import('../../data/Dataset.js').Dataset} clusteredDataset
 */
export function applyDensityCluster(artifact, clusteredDataset) {
  applyDensityCloud(artifact, clusteredDataset, { spread: 1.4, centreZ: -3.5 });
}

/**
 * Apply anomaly highlighting: outliers lift and pulse.
 * @param {{ nodeMeshes: THREE.Mesh[], group: THREE.Group }} artifact
 * @param {import('../../data/Dataset.js').Dataset} anomalyDataset
 */
export function applyAnomaly(artifact, anomalyDataset) {
  applyAnomalyHighlight(artifact, anomalyDataset);
}

/**
 * Clear anomaly highlighting and restore base transforms.
 * @param {{ nodeMeshes: THREE.Mesh[], group: THREE.Group }} artifact
 */
export function clearAnomaly(artifact) {
  clearAnomalyHighlight(artifact);
}

/**
 * Focus an outlier lens around a world-space point.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 * @param {import('../../data/Dataset.js').Dataset} anomalyDataset
 * @param {import('three').Vector3} focusPoint
 */
export function applyOutlierLensAt(artifact, anomalyDataset, focusPoint) {
  applyOutlierLens(artifact, anomalyDataset, focusPoint);
}

/**
 * Release the outlier lens.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 */
export function releaseOutlierLensAt(artifact) {
  releaseOutlierLens(artifact);
}

/**
 * Apply a slice operation: rows inside the slice remain bright; rows outside dim.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 * @param {import('../../data/Dataset.js').Dataset} slicedDataset
 * @param {import('../../data/Dataset.js').Dataset} originalDataset
 */
export function applySlice(artifact, slicedDataset, originalDataset) {
  const kept = new Set(slicedDataset.rows);
  for (const mesh of artifact.nodeMeshes) {
    const row = mesh.userData.row;
    if (kept.has(row)) {
      mesh.scale.setScalar(mesh.userData.baseScale ?? 1);
      if (mesh.material.opacity !== undefined) mesh.material.opacity = 1;
    } else {
      mesh.scale.setScalar(0.2);
      if (mesh.material.opacity !== undefined) mesh.material.opacity = 0.2;
    }
  }
}

/**
 * Store base visual properties on each node mesh so operations can restore them.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 */
export function captureBaseState(artifact) {
  for (const mesh of artifact.nodeMeshes) {
    if (mesh.userData.baseScale == null) mesh.userData.baseScale = mesh.scale.x;
    if (mesh.userData.baseOpacity == null && mesh.material.opacity !== undefined) {
      mesh.userData.baseOpacity = mesh.material.opacity;
      mesh.userData.baseTransparent = mesh.material.transparent;
    }
  }
}

/**
 * Reset all artefact meshes to their captured base state.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 */
export function resetTransforms(artifact) {
  for (const mesh of artifact.nodeMeshes) {
    const baseScale = mesh.userData.baseScale ?? 1;
    mesh.scale.setScalar(baseScale);
    if (mesh.material.opacity !== undefined) {
      mesh.material.opacity = mesh.userData.baseOpacity ?? 1;
      mesh.material.transparent = mesh.userData.baseTransparent ?? false;
    }
  }
}
