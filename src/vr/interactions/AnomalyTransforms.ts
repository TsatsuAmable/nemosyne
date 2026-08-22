/**
 * VR anomaly/outlier visualisation transforms.
 *
 * Marks rows flagged by analytical operations with pulsing halos, lifts them
 * above the dataset, and provides an outlier lens around a focus point.
 */

import * as THREE from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import { rendererRowId } from '../../data/RowIdentity.ts';
import type { ArtifactRef, NodeMaterialLike } from '../coordinators/types.ts';

const HALO_COLOUR = 0xff0055;
const PULSE_RATE = 3;

interface NodeUserData {
  baseScale?: number;
  baseY?: number;
  row: Record<string, unknown>;
  halo?: THREE.Mesh;
}

function getNodeMaterial(mesh: THREE.Mesh): NodeMaterialLike {
  return mesh.material as unknown as NodeMaterialLike;
}

function getNodeUserData(mesh: THREE.Mesh): NodeUserData {
  return mesh.userData as NodeUserData;
}

export function applyAnomalyHighlight(artifact: ArtifactRef, anomalyDataset: Dataset) {
  captureBaseState(artifact);
  const flagsByRowId = new Map(
    anomalyDataset.rows.map((row) => [
      rendererRowId(row),
      { anomaly: row._anomaly === true, score: (row._anomalyScore as number | undefined) ?? 0 },
    ] as const)
  );

  for (const mesh of artifact.nodeMeshes) {
    const flag = flagsByRowId.get(rendererRowId(getNodeUserData(mesh).row));
    if (!flag) continue;
    ensureHalo(mesh);
    const userData = getNodeUserData(mesh);
    const mat = getNodeMaterial(mesh);
    userData.halo!.visible = flag.anomaly;
    if (flag.anomaly) {
      mesh.position.y = Math.max(0.6, (userData.baseY ?? mesh.position.y) + 0.4);
      mesh.scale.setScalar((userData.baseScale ?? 1) * 1.3);
      if (mat.emissive) mat.emissive.setHex(HALO_COLOUR);
    } else {
      mesh.position.y = userData.baseY ?? mesh.position.y;
      mesh.scale.setScalar(userData.baseScale ?? 1);
      if (mat.emissive) mat.emissive.setHex(0x000000);
    }
  }
}

export function clearAnomalyHighlight(artifact: ArtifactRef) {
  for (const mesh of artifact.nodeMeshes) {
    const userData = getNodeUserData(mesh);
    const mat = getNodeMaterial(mesh);
    if (userData.halo) userData.halo.visible = false;
    mesh.position.y = userData.baseY ?? mesh.position.y;
    mesh.scale.setScalar(userData.baseScale ?? 1);
    if (mat.emissive) mat.emissive.setHex(0x000000);
  }
}

export function applyOutlierLens(
  artifact: ArtifactRef,
  anomalyDataset: Dataset,
  focusPoint: THREE.Vector3,
  radius = 0.7
) {
  const outlierIds = new Set(
    anomalyDataset.rows.filter((row) => row._anomaly === true).map(rendererRowId)
  );
  let idx = 0;
  const count = outlierIds.size;
  for (const mesh of artifact.nodeMeshes) {
    const mat = getNodeMaterial(mesh);
    const userData = getNodeUserData(mesh);
    if (outlierIds.has(rendererRowId(userData.row))) {
      const angle = count > 1 ? (idx / count) * Math.PI * 2 : 0;
      mesh.position.set(
        focusPoint.x + Math.cos(angle) * radius,
        focusPoint.y + 0.1 * Math.sin(angle * 3),
        focusPoint.z + Math.sin(angle) * radius
      );
      mesh.scale.setScalar((userData.baseScale ?? 1) * 1.4);
      if (mat.opacity !== undefined) mat.opacity = 1;
      ensureHalo(mesh);
      userData.halo!.visible = true;
      idx++;
    } else {
      if (mat.opacity !== undefined) mat.opacity = 0.25;
      mesh.scale.setScalar(userData.baseScale ?? 1);
      if (userData.halo) userData.halo.visible = false;
    }
  }
}

export function releaseOutlierLens(artifact: ArtifactRef) {
  clearAnomalyHighlight(artifact);
}

export function updateAnomalyPulse(artifact: ArtifactRef, time: number) {
  for (const mesh of artifact.nodeMeshes) {
    const halo = getNodeUserData(mesh).halo;
    if (!halo || !halo.visible) continue;
    const scale = 1.4 + 0.2 * Math.sin(time * PULSE_RATE);
    halo.scale.setScalar(scale);
    const haloMat = halo.material as unknown as NodeMaterialLike;
    if (haloMat.opacity !== undefined) haloMat.opacity = 0.5 + 0.25 * Math.sin(time * PULSE_RATE);
  }
}

function ensureHalo(mesh: THREE.Mesh): THREE.Mesh {
  const userData = getNodeUserData(mesh);
  if (userData.halo) return userData.halo;
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
  userData.halo = halo;
  return halo;
}

function captureBaseState(artifact: ArtifactRef) {
  for (const mesh of artifact.nodeMeshes) {
    const userData = getNodeUserData(mesh);
    if (userData.baseScale == null) userData.baseScale = mesh.scale.x;
    if (userData.baseY == null) userData.baseY = mesh.position.y;
  }
}
