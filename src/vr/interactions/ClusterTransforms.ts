/**
 * Cluster visualisation transforms for VR artefacts.
 *
 * Turns the `_cluster` column produced by k-means, hierarchical, or DBSCAN
 * into spatial layouts: nested rings for compact clusters, density clouds for
 * DBSCAN, and dendrogram arcs for hierarchical results.
 */

import * as THREE from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import { rendererRowId } from '../../data/RowIdentity.ts';
import type { ArtifactRef, NodeMaterialLike } from '../coordinators/types.ts';

interface RingOptions { ringStep?: number; baseRadius?: number; centreZ?: number; }
interface DensityOptions { spread?: number; baseY?: number; noiseY?: number; centreZ?: number; }
interface DendrogramOptions { baseRadius?: number; ringStep?: number; arcSpan?: number; centreZ?: number; }

const DEFAULT_PALETTE = [0x00ffcc, 0xff0055, 0x88ccff, 0xffcc00, 0xcc66ff, 0x00cc66];

function getNodeMaterial(mesh: THREE.Mesh): NodeMaterialLike {
  return mesh.material as unknown as NodeMaterialLike;
}

function getNodeUserData(mesh: THREE.Mesh): { baseScale?: number; row?: Record<string, unknown> } {
  return mesh.userData as { baseScale?: number; row?: Record<string, unknown> };
}

function meshIndexByRowId(artifact: ArtifactRef): Map<string, THREE.Mesh> {
  const index = new Map<string, THREE.Mesh>();
  for (const mesh of artifact.nodeMeshes) {
    const row = getNodeUserData(mesh).row;
    if (row) index.set(rendererRowId(row), mesh);
  }
  return index;
}

export function applyNestedRings(artifact: ArtifactRef, clusteredDataset: Dataset, options: RingOptions = {}) {
  const clusters = collectClusters(clusteredDataset);
  const meshes = meshIndexByRowId(artifact);
  const clusterIds = [...clusters.keys()].sort((a, b) => a - b);
  const { ringStep = 0.9, baseRadius = 1.6, centreZ = -3.5 } = options;

  clusterIds.forEach((id, cIdx) => {
    const members = clusters.get(id) ?? [];
    const ringRadius = baseRadius + cIdx * ringStep;
    members.forEach((row, i) => {
      const mesh = meshes.get(rendererRowId(row));
      if (!mesh) return;
      const angle = members.length > 1 ? (i / members.length) * Math.PI * 2 : 0;
      mesh.position.set(Math.cos(angle) * ringRadius, mesh.position.y, Math.sin(angle) * ringRadius + centreZ);
      mesh.scale.setScalar(getNodeUserData(mesh).baseScale ?? 1);
      const mat = getNodeMaterial(mesh);
      if (mat.opacity !== undefined) mat.opacity = 1;
      colourMesh(mesh, cIdx);
    });
  });
}

export function applyDensityCloud(artifact: ArtifactRef, clusteredDataset: Dataset, options: DensityOptions = {}) {
  const clusters = collectClusters(clusteredDataset);
  const meshes = meshIndexByRowId(artifact);
  const clusterIds = [...clusters.keys()].sort((a, b) => a - b);
  const { spread = 1.4, baseY = 0, noiseY = -0.6, centreZ = -3.5 } = options;

  clusterIds.forEach((id, cIdx) => {
    const isNoise = id === -1;
    const members = clusters.get(id) ?? [];
    const radius = isNoise ? spread * 2.5 : spread * (1 + cIdx * 0.35);
    const y = isNoise ? noiseY : baseY;
    members.forEach((row, i) => {
      const mesh = meshes.get(rendererRowId(row));
      if (!mesh) return;
      const angle = members.length > 1 ? (i / members.length) * Math.PI * 2 : 0;
      const r = isNoise ? radius * (0.5 + 0.5 * Math.random()) : radius;
      mesh.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r + centreZ);
      mesh.scale.setScalar(getNodeUserData(mesh).baseScale ?? 1);
      const mat = getNodeMaterial(mesh);
      if (mat.opacity !== undefined) mat.opacity = isNoise ? 0.4 : 1;
      if (!isNoise) colourMesh(mesh, cIdx);
    });
  });
}

export function applyDendrogramArc(artifact: ArtifactRef, clusteredDataset: Dataset, options: DendrogramOptions = {}) {
  const clusters = collectClusters(clusteredDataset);
  const meshes = meshIndexByRowId(artifact);
  const clusterIds = [...clusters.keys()].sort((a, b) => a - b);
  const { baseRadius = 1.2, ringStep = 1.2, arcSpan = Math.PI, centreZ = -3.5 } = options;

  clusterIds.forEach((id, cIdx) => {
    const members = clusters.get(id) ?? [];
    const ringRadius = baseRadius + cIdx * ringStep;
    const startAngle = -arcSpan / 2 + cIdx * 0.2;
    const endAngle = arcSpan / 2 + cIdx * 0.2;
    members.forEach((row, i) => {
      const mesh = meshes.get(rendererRowId(row));
      if (!mesh) return;
      const t = members.length > 1 ? i / (members.length - 1) : 0.5;
      const angle = startAngle + t * (endAngle - startAngle);
      mesh.position.set(Math.cos(angle) * ringRadius, mesh.position.y + cIdx * 0.15, Math.sin(angle) * ringRadius + centreZ);
      mesh.scale.setScalar(getNodeUserData(mesh).baseScale ?? 1);
      const mat = getNodeMaterial(mesh);
      if (mat.opacity !== undefined) mat.opacity = 1;
      colourMesh(mesh, cIdx);
    });
  });
}

export function autoLayout(artifact: ArtifactRef, clusteredDataset: Dataset, algorithmHint: 'kmeans' | 'dbscan' | 'hierarchical' = 'kmeans') {
  if (algorithmHint === 'dbscan') applyDensityCloud(artifact, clusteredDataset);
  else if (algorithmHint === 'hierarchical') applyDendrogramArc(artifact, clusteredDataset);
  else applyNestedRings(artifact, clusteredDataset);
}

function collectClusters(clusteredDataset: Dataset): Map<number, Record<string, unknown>[]> {
  const clusters = new Map<number, Record<string, unknown>[]>();
  for (const row of clusteredDataset.rows) {
    const id = typeof row._cluster === 'number' ? row._cluster : 0;
    if (!clusters.has(id)) clusters.set(id, []);
    clusters.get(id)?.push(row);
  }
  return clusters;
}

function colourMesh(mesh: THREE.Mesh, clusterIndex: number) {
  const mat = getNodeMaterial(mesh);
  if (mat.color) mat.color.setHex(DEFAULT_PALETTE[clusterIndex % DEFAULT_PALETTE.length]);
}
