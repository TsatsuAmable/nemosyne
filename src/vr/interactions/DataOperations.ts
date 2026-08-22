/**
 * Maps dataset operations to VR artefact transforms.
 *
 * Each function takes the current artefact (from VRTopologyTranslator) and the
 * result of a DatasetOperation, then updates mesh position/scale/opacity so the
 * visual change matches the data operation metaphorically.
 */

import * as THREE from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import { rendererRowId } from '../../data/RowIdentity.ts';
import type { OperationSpec } from '../../data/types.ts';
import type { AnalysisSpec } from '../../atlas/types.ts';
import { applyNestedRings, applyDendrogramArc, applyDensityCloud } from './ClusterTransforms.ts';
import {
  applyAnomalyHighlight,
  clearAnomalyHighlight,
} from './AnomalyTransforms.ts';
import type { ArtifactRef, NodeMaterialLike } from '../coordinators/types.ts';

interface NodeUserData {
  row: Record<string, unknown>;
  baseScale?: number;
  baseY?: number;
  baseOpacity?: number;
  baseTransparent?: boolean;
  aggregated?: boolean;
  aggregateCount?: number;
}

function getNodeMaterial(mesh: THREE.Mesh): NodeMaterialLike {
  return mesh.material as unknown as NodeMaterialLike;
}

function getNodeUserData(mesh: THREE.Mesh): NodeUserData {
  return mesh.userData as NodeUserData;
}

function meshesByRowId(artifact: ArtifactRef): Map<string, THREE.Mesh> {
  return new Map(
    artifact.nodeMeshes.map((mesh) => [rendererRowId(getNodeUserData(mesh).row), mesh] as const)
  );
}

export function applyFilter(artifact: ArtifactRef, filteredDataset: Dataset) {
  const kept = new Set(filteredDataset.rows.map(rendererRowId));
  for (const mesh of artifact.nodeMeshes) {
    const userData = getNodeUserData(mesh);
    const mat = getNodeMaterial(mesh);
    if (kept.has(rendererRowId(userData.row))) {
      mesh.scale.setScalar(userData.baseScale ?? 1);
      mat.opacity = userData.baseOpacity ?? 1;
      mat.transparent = userData.baseTransparent ?? false;
      mesh.position.y = Math.max(0.2, mesh.position.y + 0.3);
    } else {
      mesh.scale.setScalar(0.05);
      if (mat.opacity !== undefined) mat.opacity = 0.15;
      mesh.position.y = -0.5;
    }
  }
}

export function isolateRowIndices(artifact: ArtifactRef, rowIndices: number[]) {
  const kept = new Set(rowIndices);
  for (let i = 0; i < artifact.nodeMeshes.length; i++) {
    const mesh = artifact.nodeMeshes[i];
    const userData = getNodeUserData(mesh);
    const mat = getNodeMaterial(mesh);
    if (kept.has(i)) {
      mesh.scale.setScalar(userData.baseScale ?? 1);
      mat.opacity = userData.baseOpacity ?? 1;
      mat.transparent = userData.baseTransparent ?? false;
      mesh.visible = true;
    } else {
      mesh.scale.setScalar(0.05);
      if (mat.opacity !== undefined) mat.opacity = 0.1;
      mesh.visible = false;
    }
  }
}

export function highlightRowIndices(artifact: ArtifactRef, rowIndices: number[]) {
  const highlighted = new Set(rowIndices);
  for (let i = 0; i < artifact.nodeMeshes.length; i++) {
    const mesh = artifact.nodeMeshes[i];
    const mat = getNodeMaterial(mesh);
    if (highlighted.has(i)) {
      mesh.scale.setScalar((getNodeUserData(mesh).baseScale ?? 1) * 1.3);
      if (mat.opacity !== undefined) mat.opacity = 1;
    } else {
      mesh.scale.setScalar(getNodeUserData(mesh).baseScale ?? 1);
      if (mat.opacity !== undefined) mat.opacity = 0.3;
    }
  }
}

export function applySort(artifact: ArtifactRef, sortedDataset: Dataset) {
  const order = sortedDataset.rows;
  const meshIndex = meshesByRowId(artifact);
  const count = order.length;
  const radius = 4;
  const width = Math.min(radius * 2, count * 0.9);
  for (let i = 0; i < count; i++) {
    const mesh = meshIndex.get(rendererRowId(order[i]));
    if (!mesh) continue;
    const t = count > 1 ? i / (count - 1) : 0.5;
    const x = (t - 0.5) * width;
    const z = -3.5 + Math.cos(t * Math.PI) * 1.2;
    mesh.position.set(x, mesh.position.y, z);
  }
}

export function sortByRowIndices(artifact: ArtifactRef, rowIndices: number[]) {
  const count = rowIndices.length;
  if (count === 0) return;
  const radius = 4;
  const width = Math.min(radius * 2, count * 0.9);
  for (let i = 0; i < count; i++) {
    const mesh = artifact.nodeMeshes[rowIndices[i]];
    if (!mesh) continue;
    const t = count > 1 ? i / (count - 1) : 0.5;
    const x = (t - 0.5) * width;
    const z = -3.5 + Math.cos(t * Math.PI) * 1.2;
    mesh.position.set(x, mesh.position.y, z);
  }
}

export function applyAggregate(artifact: ArtifactRef, aggregatedDataset: Dataset) {
  const groupCount = aggregatedDataset.rowCount;
  const meshCount = artifact.nodeMeshes.length;

  for (let i = 0; i < meshCount; i++) {
    const mesh = artifact.nodeMeshes[i];
    const mat = getNodeMaterial(mesh);
    const user = getNodeUserData(mesh);

    if (i < groupCount) {
      const row = aggregatedDataset.rows[i];
      const count = Number(
        (row as Record<string, unknown>)?._count ??
          (row as Record<string, unknown>)?.count ??
          Math.max(1, Math.floor(meshCount / groupCount))
      );
      const t = groupCount > 1 ? i / (groupCount - 1) : 0.5;
      const arcWidth = Math.min(6, groupCount * 1.2);
      const x = (t - 0.5) * arcWidth;
      const z = -3.5 + Math.cos((t - 0.5) * Math.PI) * 0.8;

      mesh.position.set(x, (user.baseY ?? mesh.position.y) + 0.3, z);
      mesh.scale.setScalar(Math.min(3, 1 + count * 0.15));
      if (mat.opacity !== undefined) mat.opacity = 1;
      user.aggregated = true;
      user.aggregateCount = count;
    } else {
      mesh.scale.setScalar(0.05);
      if (mat.opacity !== undefined) mat.opacity = 0.2;
      user.aggregated = false;
    }
  }
}

export function applyCluster(artifact: ArtifactRef, clusteredDataset: Dataset) {
  applyNestedRings(artifact, clusteredDataset, {
    baseRadius: 2,
    ringStep: 0.8,
    centreZ: -3.5,
  });
}

export function clusterByRowIndices(artifact: ArtifactRef, clusters: number[][]) {
  const baseRadius = 2;
  const ringStep = 0.8;
  const centreZ = -3.5;
  for (let ring = 0; ring < clusters.length; ring++) {
    const members = clusters[ring];
    const radius = baseRadius + ring * ringStep;
    for (let i = 0; i < members.length; i++) {
      const mesh = artifact.nodeMeshes[members[i]];
      if (!mesh) continue;
      const angle = (i / Math.max(members.length, 1)) * Math.PI * 2;
      mesh.position.set(
        Math.cos(angle) * radius,
        mesh.position.y,
        centreZ + Math.sin(angle) * radius,
      );
    }
  }
}

export function applyHierarchicalCluster(artifact: ArtifactRef, clusteredDataset: Dataset) {
  applyDendrogramArc(artifact, clusteredDataset, {
    baseRadius: 1.2,
    ringStep: 1.2,
    centreZ: -3.5,
  });
}

export function applyDensityCluster(artifact: ArtifactRef, clusteredDataset: Dataset) {
  applyDensityCloud(artifact, clusteredDataset, { spread: 1.4, centreZ: -3.5 });
}

export function applyAnomaly(artifact: ArtifactRef, anomalyDataset: Dataset) {
  applyAnomalyHighlight(artifact, anomalyDataset);
}

export function anomalyByRowIndices(artifact: ArtifactRef, rowIndices: number[]) {
  const flagged = new Set(rowIndices);
  for (let i = 0; i < artifact.nodeMeshes.length; i++) {
    const mesh = artifact.nodeMeshes[i];
    const mat = getNodeMaterial(mesh);
    const userData = getNodeUserData(mesh);
    if (flagged.has(i)) {
      mesh.scale.setScalar((userData.baseScale ?? 1) * 1.5);
      if (mat.opacity !== undefined) mat.opacity = 1;
      mesh.position.y = (userData.baseScale ?? 1) + 0.8;
    } else {
      mesh.scale.setScalar(userData.baseScale ?? 1);
      if (mat.opacity !== undefined) mat.opacity = 0.4;
    }
  }
}

export function clearAnomaly(artifact: ArtifactRef) {
  clearAnomalyHighlight(artifact);
}

export function applySlice(
  artifact: ArtifactRef,
  slicedDataset: Dataset,
  _originalDataset: Dataset
) {
  const kept = new Set(slicedDataset.rows.map(rendererRowId));
  for (const mesh of artifact.nodeMeshes) {
    const mat = getNodeMaterial(mesh);
    if (kept.has(rendererRowId(getNodeUserData(mesh).row))) {
      mesh.scale.setScalar(getNodeUserData(mesh).baseScale ?? 1);
      if (mat.opacity !== undefined) mat.opacity = 1;
    } else {
      mesh.scale.setScalar(0.2);
      if (mat.opacity !== undefined) mat.opacity = 0.2;
    }
  }
}

export function sliceByRowIndices(artifact: ArtifactRef, rowIndices: number[]) {
  const kept = new Set(rowIndices);
  for (let i = 0; i < artifact.nodeMeshes.length; i++) {
    const mesh = artifact.nodeMeshes[i];
    const mat = getNodeMaterial(mesh);
    if (kept.has(i)) {
      mesh.scale.setScalar(getNodeUserData(mesh).baseScale ?? 1);
      if (mat.opacity !== undefined) mat.opacity = 1;
      mesh.visible = true;
    } else {
      mesh.scale.setScalar(0.2);
      if (mat.opacity !== undefined) mat.opacity = 0.15;
    }
  }
}

export function captureBaseState(artifact: ArtifactRef) {
  for (const mesh of artifact.nodeMeshes) {
    const userData = getNodeUserData(mesh);
    const mat = getNodeMaterial(mesh);
    if (userData.baseScale == null) userData.baseScale = mesh.scale.x;
    if (userData.baseOpacity == null && mat.opacity !== undefined) {
      userData.baseOpacity = mat.opacity;
      userData.baseTransparent = mat.transparent;
    }
  }
}

export function toKernelSpec(
  operation: string,
  dataset: Dataset,
  _originalDataset: Dataset,
  medianOf?: (column: string) => number
): OperationSpec {
  switch (operation) {
    case 'filter': {
      const col = dataset.numericColumns[0]?.name;
      if (!col) return { op: 'slice', start: 0, end: dataset.rowCount };
      return {
        op: 'filter',
        predicate: { op: 'gt', column: col, value: medianOf ? medianOf(col) : 0 },
      };
    }
    case 'sort': {
      const col = dataset.numericColumns[0]?.name || dataset.columns[0]?.name || 'value';
      return { op: 'sort', column: col, ascending: true };
    }
    case 'aggregate': {
      const cat = dataset.categoricalColumns[0]?.name || dataset.columns[0]?.name;
      if (!cat) return { op: 'slice', start: 0, end: dataset.rowCount };
      return { op: 'aggregate', group_by: cat };
    }
    case 'compare': {
      const groupBy = dataset.categoricalColumns[0]?.name;
      if (!groupBy) return { op: 'slice', start: 0, end: dataset.rowCount };
      const groups = [...new Set(dataset.rows.map((row) => row[groupBy]))];
      if (groups.length < 2) return { op: 'slice', start: 0, end: dataset.rowCount };
      return {
        op: 'compare',
        group_by: groupBy,
        group_a: String(groups[0]),
        group_b: String(groups[1]),
      };
    }
    case 'cluster':
      return { op: 'k_means', k: 3 };
    case 'hierarchical': {
      const features = dataset.numericColumns.map((c) => c.name);
      return { op: 'hierarchical', k: 3, linkage: 'average', features };
    }
    case 'density': {
      const features = dataset.numericColumns.map((c) => c.name);
      return { op: 'dbscan', eps: 1, min_points: 1, features };
    }
    case 'anomaly': {
      const col = dataset.numericColumns[0]?.name;
      if (!col) return { op: 'slice', start: 0, end: dataset.rowCount };
      return { op: 'anomaly_zscore', column: col, sensitivity: 2 };
    }
    case 'timeSlice': {
      const start = Math.floor(dataset.rowCount / 2);
      const end = dataset.rowCount;
      return { op: 'slice', start, end };
    }
    default:
      return { op: 'slice', start: 0, end: dataset.rowCount };
  }
}

export interface AnalysisSpecAtlas {
  datasetFingerprint: string | null;
  datasetVersion: number;
  kernelVersion(): string | null;
  medianFor(column: string): number;
}

export function toAnalysisSpec(
  operation: string,
  dataset: Dataset,
  atlas: AnalysisSpecAtlas
): AnalysisSpec {
  const op = toKernelSpec(operation, dataset, dataset, (col) => atlas.medianFor(col));
  return {
    datasetFingerprint: atlas.datasetFingerprint ?? '',
    datasetVersion: atlas.datasetVersion,
    operation: op,
    algorithmVersion: atlas.kernelVersion() ?? '0.2.0',
    label: operation,
    seed: null,
    normalization: 'none',
    missingness: 'exclude-non-finite',
  };
}

export function resetTransforms(artifact: ArtifactRef) {
  for (const mesh of artifact.nodeMeshes) {
    const userData = getNodeUserData(mesh);
    const mat = getNodeMaterial(mesh);
    const baseScale = userData.baseScale ?? 1;
    mesh.scale.setScalar(baseScale);
    if (mat.opacity !== undefined) {
      mat.opacity = userData.baseOpacity ?? 1;
      mat.transparent = userData.baseTransparent ?? false;
    }
  }
}

export function resetVisibility(artifact: ArtifactRef) {
  for (const mesh of artifact.nodeMeshes) mesh.visible = true;
}
