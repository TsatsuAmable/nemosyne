/**
 * Maps dataset operations to VR artefact transforms.
 *
 * Each function takes the current artefact (from VRTopologyTranslator) and the
 * result of a DatasetOperation, then updates mesh position/scale/opacity so the
 * visual change matches the data operation metaphorically.
 */

import * as THREE from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import type { OperationSpec } from '../../data/types.ts';
import { applyNestedRings, applyDendrogramArc, applyDensityCloud } from './ClusterTransforms.ts';
import {
  applyAnomalyHighlight,
  clearAnomalyHighlight,
  applyOutlierLens,
  releaseOutlierLens,
} from './AnomalyTransforms.ts';
import type { ArtifactRef, NodeMaterialLike } from '../coordinators/types.ts';

interface NodeUserData {
  row: Record<string, unknown>;
  baseScale?: number;
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

/**
 * Apply a filter operation: rows present in the filtered dataset remain visible,
 * absent rows shrink and fade below the DatumPlane.
 */
export function applyFilter(artifact: ArtifactRef, filteredDataset: Dataset) {
  const kept = new Set(filteredDataset.rows);
  for (const mesh of artifact.nodeMeshes) {
    const userData = getNodeUserData(mesh);
    const row = userData.row;
    const mat = getNodeMaterial(mesh);
    if (kept.has(row)) {
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

/**
 * Apply a sort operation: reorder visible nodes along a horizontal arc.
 */
export function applySort(artifact: ArtifactRef, sortedDataset: Dataset) {
  const order = sortedDataset.rows;
  const count = order.length;
  const radius = 4;
  const width = Math.min(radius * 2, count * 0.9);
  for (let i = 0; i < count; i++) {
    const row = order[i];
    const mesh = artifact.nodeMeshes.find(
      (m) => getNodeUserData(m).row === row
    );
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
 */
export function applyAggregate(artifact: ArtifactRef, aggregatedDataset: Dataset) {
  // For simplicity, hide all original nodes and scale the first node of each
  // group to represent the aggregate. In a full implementation this would spawn
  // new aggregate meshes.
  for (const mesh of artifact.nodeMeshes) {
    mesh.scale.setScalar(0.05);
    const mat = getNodeMaterial(mesh);
    if (mat.opacity !== undefined) mat.opacity = 0.2;
  }

  // Placeholder: keep the original dataset name so the operation is traceable.
  void aggregatedDataset.name;
  const count = aggregatedDataset.rowCount;
  if (count > 0 && artifact.nodeMeshes[0]) {
    const rep = artifact.nodeMeshes[0];
    const repUser = getNodeUserData(rep);
    const repMat = getNodeMaterial(rep);
    rep.scale.setScalar(Math.min(3, 1 + count * 0.15));
    repMat.opacity = 1;
    rep.position.set(0, rep.position.y + 0.5, -3.5);
    repUser.aggregated = true;
    repUser.aggregateCount = count;
  }
}

/**
 * Apply a cluster operation: move nodes into nested rings grouped by their `_cluster` value.
 */
export function applyCluster(artifact: ArtifactRef, clusteredDataset: Dataset) {
  applyNestedRings(artifact, clusteredDataset, {
    baseRadius: 2,
    ringStep: 0.8,
    centreZ: -3.5,
  });
}

/**
 * Apply a hierarchical clustering operation: arrange clusters in dendrogram-like arcs.
 */
export function applyHierarchicalCluster(artifact: ArtifactRef, clusteredDataset: Dataset) {
  applyDendrogramArc(artifact, clusteredDataset, {
    baseRadius: 1.2,
    ringStep: 1.2,
    centreZ: -3.5,
  });
}

/**
 * Apply a DBSCAN result: dense clusters become clouds; noise points sink below the plane.
 */
export function applyDensityCluster(artifact: ArtifactRef, clusteredDataset: Dataset) {
  applyDensityCloud(artifact, clusteredDataset, { spread: 1.4, centreZ: -3.5 });
}

/**
 * Apply anomaly highlighting: outliers lift and pulse.
 */
export function applyAnomaly(artifact: ArtifactRef, anomalyDataset: Dataset) {
  applyAnomalyHighlight(artifact, anomalyDataset);
}

/**
 * Clear anomaly highlighting and restore base transforms.
 */
export function clearAnomaly(artifact: ArtifactRef) {
  clearAnomalyHighlight(artifact);
}

/**
 * Focus an outlier lens around a world-space point.
 */
export function applyOutlierLensAt(
  artifact: ArtifactRef,
  anomalyDataset: Dataset,
  focusPoint: THREE.Vector3
) {
  applyOutlierLens(artifact, anomalyDataset, focusPoint);
}

/**
 * Release the outlier lens.
 */
export function releaseOutlierLensAt(artifact: ArtifactRef) {
  releaseOutlierLens(artifact);
}

/**
 * Apply a slice operation: rows inside the slice remain bright; rows outside dim.
 */
export function applySlice(
  artifact: ArtifactRef,
  slicedDataset: Dataset,
  _originalDataset: Dataset
) {
  const kept = new Set(slicedDataset.rows);
  for (const mesh of artifact.nodeMeshes) {
    const row = getNodeUserData(mesh).row;
    const mat = getNodeMaterial(mesh);
    if (kept.has(row)) {
      mesh.scale.setScalar(getNodeUserData(mesh).baseScale ?? 1);
      if (mat.opacity !== undefined) mat.opacity = 1;
    } else {
      mesh.scale.setScalar(0.2);
      if (mat.opacity !== undefined) mat.opacity = 0.2;
    }
  }
}

/**
 * Store base visual properties on each node mesh so operations can restore them.
 */
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

/**
 * Map a high-level operation name to a kernel {@link OperationSpec}. Every
 * operation produces a spec (the kernel is the ONLY analytical path); an
 * operation that cannot be meaningfully applied to the current dataset
 * resolves to an identity slice.
 *
 * `medianOf` is an optional thunk the controller supplies — it calls the
 * kernel statistics pass (median computed in Rust) so the default filter
 * predicate stays rule-compliant (no JS analytical computation).
 */
export function toKernelSpec(
  operation: string,
  dataset: Dataset,
  _originalDataset: Dataset,
  medianOf?: (column: string) => number
): OperationSpec {
  switch (operation) {
    case 'filter': {
      const col = dataset.numericColumns[0]?.name;
      if (!col) {
        return { op: 'slice', start: 0, end: dataset.rowCount };
      }
      return {
        op: 'filter',
        predicate: { op: 'gt', column: col, value: medianOf ? medianOf(col) : 0 },
      };
    }
    case 'sort': {
      const col =
        dataset.numericColumns[0]?.name || dataset.columns[0]?.name || 'value';
      return { op: 'sort', column: col, ascending: true };
    }
    case 'aggregate': {
      const cat = dataset.categoricalColumns[0]?.name || dataset.columns[0]?.name;
      if (!cat) {
        return { op: 'slice', start: 0, end: dataset.rowCount };
      }
      return { op: 'aggregate', group_by: cat };
    }
    case 'compare': {
      const groupBy = dataset.categoricalColumns[0]?.name;
      if (!groupBy) {
        return { op: 'slice', start: 0, end: dataset.rowCount };
      }
      const groups = [...new Set(dataset.rows.map((row) => row[groupBy]))];
      if (groups.length < 2) {
        return { op: 'slice', start: 0, end: dataset.rowCount };
      }
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
      if (!col) {
        return { op: 'slice', start: 0, end: dataset.rowCount };
      }
      return { op: 'anomaly_zscore', column: col, sensitivity: 2 };
    }
    case 'timeSlice': {
      // Slice a contiguous window of the CURRENT transformed dataset (the
      // kernel runs `slice` against the handle built from `dataset`). Bounding
      // by the current row count keeps the window valid after prior ops;
      // bounding by the original count would discard those ops and could yield
      // an empty slice once the view shrinks.
      const start = Math.floor(dataset.rowCount / 2);
      const end = dataset.rowCount;
      return { op: 'slice', start, end };
    }
    default:
      return { op: 'slice', start: 0, end: dataset.rowCount };
  }
}

/**
 * Reset all artefact meshes to their captured base state.
 */
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
