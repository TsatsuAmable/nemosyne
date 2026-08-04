/**
 * VR anomaly/outlier visualisation transforms.
 *
 * Marks rows flagged by `DatasetOperations.anomaly()` with pulsing halos,
 * lifts them above the dataset, and provides an "outlier lens" that gathers
 * outliers into a local swarm around the pointing hand.
 */

import * as THREE from 'three';

const HALO_COLOUR = 0xff0055;
const PULSE_RATE = 3;

/**
 * Apply anomaly highlighting: outliers get an emissive halo mesh and lift up.
 * @param {{ nodeMeshes: THREE.Mesh[], group: THREE.Group }} artifact
 * @param {import('../../data/Dataset.ts').Dataset} anomalyDataset
 */
export function applyAnomalyHighlight(artifact, anomalyDataset) {
  captureBaseState(artifact);
  // Build a map from row identity to anomaly flag/score so we can match rows
  // even when the anomaly dataset is a clone with new row objects.
  const flagById = new Map();
  for (let i = 0; i < anomalyDataset.rowCount; i++) {
    const row = anomalyDataset.rows[i];
    flagById.set(i, { anomaly: row._anomaly === true, score: row._anomalyScore ?? 0 });
  }

  for (let i = 0; i < artifact.nodeMeshes.length && i < anomalyDataset.rowCount; i++) {
    const mesh = artifact.nodeMeshes[i];
    const { anomaly: isOutlier } = flagById.get(i);
    ensureHalo(mesh);
    mesh.userData.halo.visible = isOutlier;
    if (isOutlier) {
      mesh.position.y = Math.max(0.6, (mesh.userData.baseY ?? mesh.position.y) + 0.4);
      mesh.scale.setScalar((mesh.userData.baseScale ?? 1) * 1.3);
      mesh.material.emissive?.setHex?.(HALO_COLOUR);
    } else {
      mesh.position.y = mesh.userData.baseY ?? mesh.position.y;
      mesh.scale.setScalar(mesh.userData.baseScale ?? 1);
      mesh.material.emissive?.setHex?.(0x000000);
    }
  }
}

/**
 * Remove all anomaly halos and restore node transforms.
 * @param {{ nodeMeshes: THREE.Mesh[], group: THREE.Group }} artifact
 */
export function clearAnomalyHighlight(artifact) {
  for (const mesh of artifact.nodeMeshes) {
    if (mesh.userData.halo) {
      mesh.userData.halo.visible = false;
    }
    mesh.position.y = mesh.userData.baseY ?? mesh.position.y;
    mesh.scale.setScalar(mesh.userData.baseScale ?? 1);
    mesh.material.emissive?.setHex?.(0x000000);
  }
}

/**
 * Gather outliers into a local swarm around a focus point (e.g. the user's hand).
 * Non-outliers dim.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 * @param {import('../../data/Dataset.ts').Dataset} anomalyDataset
 * @param {THREE.Vector3} focusPoint
 * @param {number} [radius]
 */
export function applyOutlierLens(artifact, anomalyDataset, focusPoint, radius = 0.7) {
  const outlierRows = new Set(anomalyDataset.rows.filter((r) => r._anomaly === true));
  let idx = 0;
  const count = outlierRows.size;
  for (const mesh of artifact.nodeMeshes) {
    const row = mesh.userData.row;
    if (outlierRows.has(row)) {
      const angle = count > 1 ? (idx / count) * Math.PI * 2 : 0;
      const x = focusPoint.x + Math.cos(angle) * radius;
      const z = focusPoint.z + Math.sin(angle) * radius;
      const y = focusPoint.y + 0.1 * Math.sin(angle * 3);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar((mesh.userData.baseScale ?? 1) * 1.4);
      if (mesh.material.opacity !== undefined) mesh.material.opacity = 1;
      ensureHalo(mesh);
      mesh.userData.halo.visible = true;
      idx++;
    } else {
      if (mesh.material.opacity !== undefined) mesh.material.opacity = 0.25;
      mesh.scale.setScalar(mesh.userData.baseScale ?? 1);
      if (mesh.userData.halo) mesh.userData.halo.visible = false;
    }
  }
}

/**
 * Release the outlier lens and restore base state.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 */
export function releaseOutlierLens(artifact) {
  clearAnomalyHighlight(artifact);
}

/**
 * Update halo pulse animation. Call once per frame.
 * @param {{ nodeMeshes: THREE.Mesh[] }} artifact
 * @param {number} time
 */
export function updateAnomalyPulse(artifact, time) {
  for (const mesh of artifact.nodeMeshes) {
    const halo = mesh.userData.halo;
    if (!halo || !halo.visible) continue;
    const scale = 1.4 + 0.2 * Math.sin(time * PULSE_RATE);
    halo.scale.setScalar(scale);
    const material = halo.material;
    if (material.opacity !== undefined) {
      material.opacity = 0.5 + 0.25 * Math.sin(time * PULSE_RATE);
    }
  }
}

function ensureHalo(mesh) {
  if (mesh.userData.halo) return mesh.userData.halo;
  const geometry = new THREE.SphereGeometry(1, 16, 16);
  const material = new THREE.MeshBasicMaterial({
    color: HALO_COLOUR,
    transparent: true,
    opacity: 0.6,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(geometry, material);
  halo.name = 'anomaly-halo';
  halo.visible = false;
  mesh.add(halo);
  mesh.userData.halo = halo;
  return halo;
}

function captureBaseState(artifact) {
  for (const mesh of artifact.nodeMeshes) {
    if (mesh.userData.baseScale == null) mesh.userData.baseScale = mesh.scale.x;
    if (mesh.userData.baseY == null) mesh.userData.baseY = mesh.position.y;
  }
}
