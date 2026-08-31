import * as THREE from 'three';
import { categoricalColor } from '../../data/Encodings.ts';
import type {
  ClusterAxisSummaryV1,
  ClusterEmbodimentEnvelopeV1,
  ClusterRegionV1,
} from '../representation/ClusterEmbodimentPayload.ts';
import { setSemanticEmbodimentPresentationStatus } from './SemanticEmbodimentStatus.ts';

export const CLUSTER_CENTROID_SURFACE_NAME = 'cluster-semantic-centroids';
export const CLUSTER_BOUNDS_SURFACE_NAME = 'cluster-descriptive-bounds';

interface PresentationDomain {
  field: string;
  min: number;
  max: number;
}

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0.5;
  if (min === max) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function mapAxis(value: number, domain: PresentationDomain, min: number, max: number): number {
  return min + normalize(value, domain.min, domain.max) * (max - min);
}

function validateAxes(
  region: ClusterRegionV1,
  coordinateFields: string[]
): ClusterAxisSummaryV1[] | null {
  const axes = region.spatialSummary?.axes;
  if (!axes) return null;
  if (axes.length !== coordinateFields.length) return [];
  for (let index = 0; index < axes.length; index += 1) {
    const axis = axes[index];
    if (
      axis.field !== coordinateFields[index] ||
      !Number.isFinite(axis.centroid) ||
      !Number.isFinite(axis.min) ||
      !Number.isFinite(axis.max) ||
      axis.min > axis.centroid ||
      axis.centroid > axis.max
    ) {
      return [];
    }
  }
  return axes;
}

function addSegment(
  positions: number[],
  colors: number[],
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: THREE.Color
): void {
  positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
  colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
}

function addRectangleEdges(
  positions: number[],
  colors: number[],
  min: THREE.Vector3,
  max: THREE.Vector3,
  color: THREE.Color
): void {
  const a = new THREE.Vector3(min.x, min.y, min.z);
  const b = new THREE.Vector3(max.x, min.y, min.z);
  const c = new THREE.Vector3(max.x, min.y, max.z);
  const d = new THREE.Vector3(min.x, min.y, max.z);
  addSegment(positions, colors, a, b, color);
  addSegment(positions, colors, b, c, color);
  addSegment(positions, colors, c, d, color);
  addSegment(positions, colors, d, a, color);
}

function addBoxEdges(
  positions: number[],
  colors: number[],
  min: THREE.Vector3,
  max: THREE.Vector3,
  color: THREE.Color
): void {
  const p = [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
    new THREE.Vector3(min.x, max.y, max.z),
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ] as const;
  for (const [from, to] of edges) addSegment(positions, colors, p[from], p[to], color);
}

/**
 * Thin C3 presentation adapter for the Rust-owned source-partition summary.
 *
 * Visible geometry deliberately consists of centroid markers plus wireframe
 * axis-aligned min/max envelopes. The wireframes are descriptive bounds, not
 * support/confidence/separation surfaces. No grouping, centroid, bounds or
 * source-row traversal occurs here.
 */
export function buildClusterSemanticRegions(
  group: THREE.Group,
  nodeMeshes: THREE.Mesh[],
  envelope: ClusterEmbodimentEnvelopeV1 | null | undefined
): void {
  if (!envelope) {
    setSemanticEmbodimentPresentationStatus(group, 'PENDING', undefined, 'CLUSTER_REGIONS');
    return;
  }
  if (envelope.result.status === 'REFUSED') {
    setSemanticEmbodimentPresentationStatus(
      group,
      'REFUSED',
      envelope.result.refusal.message,
      'CLUSTER_REGIONS'
    );
    group.userData.semanticEmbodimentRefusal = envelope.result.refusal;
    return;
  }
  if (
    envelope.candidateId !== 'CLUSTER_REGIONS' ||
    envelope.representationFamily !== 'CLUSTER' ||
    envelope.result.payload.kind !== 'CLUSTER_REGIONS'
  ) {
    setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'CLUSTER_REGIONS');
    return;
  }

  const payload = envelope.result.payload.data;
  const regions = payload.regions;
  if (
    regions.length === 0 ||
    regions.length !== envelope.resource.elementCount ||
    regions.length > envelope.resource.maxElementCount ||
    (payload.coordinateFields.length !== 2 && payload.coordinateFields.length !== 3)
  ) {
    setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'CLUSTER_REGIONS');
    return;
  }

  const validated = regions.map((region) => ({
    region,
    axes: validateAxes(region, payload.coordinateFields),
  }));
  if (validated.some(({ axes }) => Array.isArray(axes) && axes.length === 0)) {
    setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'CLUSTER_REGIONS');
    return;
  }

  const spatial = validated.filter(
    (entry): entry is { region: ClusterRegionV1; axes: ClusterAxisSummaryV1[] } =>
      entry.axes !== null
  );
  if (spatial.length === 0) {
    setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'CLUSTER_REGIONS');
    return;
  }

  const domains: PresentationDomain[] = payload.coordinateFields.map((field, index) => ({
    field,
    min: Math.min(...spatial.map(({ axes }) => axes[index].min)),
    max: Math.max(...spatial.map(({ axes }) => axes[index].max)),
  }));
  if (domains.some((domain) => !Number.isFinite(domain.min) || !Number.isFinite(domain.max))) {
    setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'CLUSTER_REGIONS');
    return;
  }

  const artifactId = [
    'semantic-embodiment',
    envelope.datasetFingerprint,
    envelope.candidateId,
    envelope.provenance.algorithmVersion,
    envelope.provenance.decisionId ?? 'unbound-decision',
  ].join(':');
  const commonMetadata = {
    representationKind: 'CLUSTER_REGIONS',
    payloadKind: 'CLUSTER_REGIONS',
    artifactId,
    datasetFingerprint: envelope.datasetFingerprint,
    partitionField: payload.partitionField,
    coordinateFields: payload.coordinateFields,
    analyticalMethod: envelope.analyticalMethod,
    approximation: envelope.approximation,
    informationContract: envelope.informationContract,
    provenance: envelope.provenance,
    presentationSemantics: 'centroid-and-descriptive-axis-aligned-min-max-bounds',
    supportBoundaryClaim: false,
  };

  const maxAssigned = Math.max(1, ...spatial.map(({ region }) => region.assignedCount));
  const centroidGeometry = new THREE.BoxGeometry(1, 1, 1);
  const centroidMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.12,
  });
  const centroidBatch = new THREE.InstancedMesh(
    centroidGeometry,
    centroidMaterial,
    spatial.length
  );
  centroidBatch.name = CLUSTER_CENTROID_SURFACE_NAME;
  centroidBatch.userData = {
    ...commonMetadata,
    semanticRegionCount: regions.length,
    spatialRegionCount: spatial.length,
    candidateLocalDrawCalls: 2,
    interactionModel: 'non-rendering-semantic-proxies',
  };

  const proxyGeometry = new THREE.BoxGeometry(1, 1, 1);
  const proxyMaterial = new THREE.MeshBasicMaterial();
  proxyMaterial.visible = false;
  const positions: number[] = [];
  const colors: number[] = [];
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();

  spatial.forEach(({ region, axes }, spatialIndex) => {
    const color = new THREE.Color(categoricalColor(region.sourcePartitionValue, spatialIndex, 'none'));
    const centroid = new THREE.Vector3(
      mapAxis(axes[0].centroid, domains[0], -2.5, 2.5),
      axes.length === 3 ? mapAxis(axes[2].centroid, domains[2], 0.15, 3.15) : 0.45,
      mapAxis(axes[1].centroid, domains[1], -2.5, 2.5)
    );
    const boundsMin = new THREE.Vector3(
      mapAxis(axes[0].min, domains[0], -2.5, 2.5),
      axes.length === 3 ? mapAxis(axes[2].min, domains[2], 0.15, 3.15) : 0.45,
      mapAxis(axes[1].min, domains[1], -2.5, 2.5)
    );
    const boundsMax = new THREE.Vector3(
      mapAxis(axes[0].max, domains[0], -2.5, 2.5),
      axes.length === 3 ? mapAxis(axes[2].max, domains[2], 0.15, 3.15) : 0.45,
      mapAxis(axes[1].max, domains[1], -2.5, 2.5)
    );

    if (axes.length === 3) addBoxEdges(positions, colors, boundsMin, boundsMax, color);
    else addRectangleEdges(positions, colors, boundsMin, boundsMax, color);

    const markerSize = 0.12 + 0.28 * Math.sqrt(region.assignedCount / maxAssigned);
    matrix.compose(centroid, quaternion, new THREE.Vector3(markerSize, markerSize, markerSize));
    centroidBatch.setMatrixAt(spatialIndex, matrix);
    centroidBatch.setColorAt(spatialIndex, color);

    const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
    proxy.name = region.semanticId;
    proxy.position.copy(centroid);
    proxy.scale.set(
      Math.max(0.14, boundsMax.x - boundsMin.x),
      axes.length === 3 ? Math.max(0.14, boundsMax.y - boundsMin.y) : 0.14,
      Math.max(0.14, boundsMax.z - boundsMin.z)
    );
    proxy.userData = {
      ...commonMetadata,
      semanticId: region.semanticId,
      sourcePartitionValue: region.sourcePartitionValue,
      assignedCount: region.assignedCount,
      coordinateValidCount: region.coordinateValidCount,
      coordinateExcludedCount: region.coordinateExcludedCount,
      spatialSummary: region.spatialSummary,
      centroidInstanceIndex: spatialIndex,
      centroidInstanceBaseColor: color.getHex(),
      nonRenderingSemanticProxy: true,
      row: {
        partition: region.sourcePartitionValue,
        assignedCount: region.assignedCount,
        coordinateValidCount: region.coordinateValidCount,
        coordinateExcludedCount: region.coordinateExcludedCount,
      },
    };
    group.add(proxy);
    nodeMeshes.push(proxy);
  });

  centroidBatch.instanceMatrix.needsUpdate = true;
  if (centroidBatch.instanceColor) centroidBatch.instanceColor.needsUpdate = true;
  centroidBatch.computeBoundingBox();
  centroidBatch.computeBoundingSphere();
  group.add(centroidBatch);

  const boundsGeometry = new THREE.BufferGeometry();
  boundsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  boundsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const boundsMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
  });
  const bounds = new THREE.LineSegments(boundsGeometry, boundsMaterial);
  bounds.name = CLUSTER_BOUNDS_SURFACE_NAME;
  bounds.userData = {
    ...commonMetadata,
    descriptiveBoundsOnly: true,
    analyticalElement: false,
    selectable: false,
  };
  group.add(bounds);

  const unavailableSpatialRegions = validated
    .filter(({ axes }) => axes === null)
    .map(({ region }) => ({
      semanticId: region.semanticId,
      sourcePartitionValue: region.sourcePartitionValue,
      assignedCount: region.assignedCount,
      coordinateValidCount: region.coordinateValidCount,
      coordinateExcludedCount: region.coordinateExcludedCount,
    }));

  setSemanticEmbodimentPresentationStatus(group, 'READY', undefined, 'CLUSTER_REGIONS');
  group.userData.semanticEmbodiment = {
    ...commonMetadata,
    candidateId: envelope.candidateId,
    resource: envelope.resource,
    counts: payload.counts,
    unavailableSpatialRegions,
  };
  group.userData.clusterRenderSurface = {
    semanticRegionCount: regions.length,
    spatialRegionCount: spatial.length,
    unavailableSpatialRegionCount: unavailableSpatialRegions.length,
    renderedBatchCount: 2,
    candidateLocalDrawCalls: 2,
    interactionProxyCount: nodeMeshes.length,
  };
}
