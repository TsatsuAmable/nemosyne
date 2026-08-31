import * as THREE from 'three';
import { categoricalColor } from '../../data/Encodings.ts';
import type {
  ClusterRegionV1,
  SemanticEmbodimentEnvelopeV1,
} from '../representation/SemanticEmbodimentPayload.ts';
import { setSemanticEmbodimentPresentationStatus } from './SemanticEmbodimentStatus.ts';

export const CLUSTER_INSTANCED_SURFACE_NAME = 'cluster-instanced-regions';

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function meanFor(region: ClusterRegionV1, field: string): number | null {
  const axis = region.axes.find((candidate) => candidate.field === field);
  return axis && Number.isFinite(axis.mean) ? axis.mean : null;
}

/**
 * Thin R2D presentation adapter. Rust owns membership, group counts, numeric
 * summaries, method identity and provenance. This module only maps the bounded
 * region payload into spatial positions and presentation materials.
 */
export function buildClusterSemanticRegions(
  group: THREE.Group,
  nodeMeshes: THREE.Mesh[],
  envelope: SemanticEmbodimentEnvelopeV1 | null | undefined
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
    regions.length !== envelope.resource.elementCount ||
    regions.length > envelope.resource.maxElementCount
  ) {
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
    clusterField: payload.clusterField,
    analyticalMethod: envelope.analyticalMethod,
    approximation: envelope.approximation,
    informationContract: envelope.informationContract,
    provenance: envelope.provenance,
  };

  if (regions.length === 0) {
    setSemanticEmbodimentPresentationStatus(group, 'READY', undefined, 'CLUSTER_REGIONS');
    group.userData.semanticEmbodiment = { ...commonMetadata, resource: envelope.resource };
    return;
  }

  const fields = payload.measureFields.slice(0, 3);
  const domains = fields.map((field) => {
    const means = regions
      .map((region) => meanFor(region, field))
      .filter((value): value is number => value !== null);
    return {
      field,
      min: means.length > 0 ? Math.min(...means) : 0,
      max: means.length > 0 ? Math.max(...means) : 1,
    };
  });
  const maxCount = Math.max(1, ...regions.map((region) => region.count));

  const geometry = new THREE.SphereGeometry(1, 18, 12);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.48,
    roughness: 0.48,
    metalness: 0.08,
  });
  const batch = new THREE.InstancedMesh(geometry, material, regions.length);
  batch.name = CLUSTER_INSTANCED_SURFACE_NAME;
  batch.userData = {
    ...commonMetadata,
    semanticRegionCount: regions.length,
    candidateLocalDrawCalls: 1,
    interactionModel: 'non-rendering-semantic-proxies',
  };

  const proxyGeometry = new THREE.SphereGeometry(1, 12, 8);
  const proxyMaterial = new THREE.MeshBasicMaterial();
  proxyMaterial.visible = false;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  regions.forEach((region, index) => {
    if (domains.length >= 2) {
      const xMean = meanFor(region, domains[0].field) ?? (domains[0].min + domains[0].max) / 2;
      const zMean = meanFor(region, domains[1].field) ?? (domains[1].min + domains[1].max) / 2;
      const yMean =
        domains.length >= 3
          ? (meanFor(region, domains[2].field) ?? (domains[2].min + domains[2].max) / 2)
          : 0;
      position.set(
        -2.4 + normalize(xMean, domains[0].min, domains[0].max) * 4.8,
        domains.length >= 3 ? -1.1 + normalize(yMean, domains[2].min, domains[2].max) * 2.2 : 0.5,
        -2.4 + normalize(zMean, domains[1].min, domains[1].max) * 4.8
      );
    } else {
      const angle = (index / Math.max(1, regions.length)) * Math.PI * 2;
      const ring = 1.2 + Math.sqrt(regions.length) * 0.12;
      position.set(Math.cos(angle) * ring, 0.5, Math.sin(angle) * ring);
    }

    const radius = 0.28 + 0.72 * Math.sqrt(region.count / maxCount);
    scale.setScalar(radius);
    matrix.compose(position, quaternion, scale);
    batch.setMatrixAt(index, matrix);
    batch.setColorAt(index, new THREE.Color(categoricalColor(region.key, index, 'none')));

    const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
    proxy.name = region.semanticId;
    proxy.position.copy(position);
    proxy.scale.copy(scale);
    const row = {
      cluster: region.key,
      count: region.count,
      ...Object.fromEntries(region.axes.map((axis) => [`mean:${axis.field}`, axis.mean])),
    };
    proxy.userData = {
      ...commonMetadata,
      semanticId: region.semanticId,
      clusterKey: region.key,
      count: region.count,
      axes: region.axes,
      row,
      clusterInstanceIndex: index,
      nonRenderingSemanticProxy: true,
    };
    group.add(proxy);
    nodeMeshes.push(proxy);
  });

  batch.instanceMatrix.needsUpdate = true;
  if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
  batch.computeBoundingBox();
  batch.computeBoundingSphere();
  group.add(batch);

  setSemanticEmbodimentPresentationStatus(group, 'READY', undefined, 'CLUSTER_REGIONS');
  group.userData.semanticEmbodiment = {
    ...commonMetadata,
    resource: envelope.resource,
    counts: payload.counts,
    measureFields: payload.measureFields,
  };
}
