import * as THREE from 'three';
import { numericColor } from '../../data/Encodings.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../representation/SemanticEmbodimentPayload.ts';
import { setSemanticEmbodimentPresentationStatus } from './SemanticEmbodimentStatus.ts';

export const DENSITY_INSTANCED_SURFACE_NAME = 'density-instanced-cells';

/**
 * Thin R2C M3/M4 density presentation adapter. Rust owns field selection,
 * domains, bin assignment, counts, exclusions, semantic IDs, method identity
 * and provenance. The adapter maps that bounded payload to one rendered
 * InstancedMesh plus non-rendering per-cell interaction proxies.
 *
 * The proxies deliberately remain ordinary Mesh objects so the existing
 * tooltip/selection surface can address every Rust semantic cell by name.
 * Their material is not rendered, so they contribute no draw calls. The
 * visible InstancedMesh carries one instance per semantic cell.
 */
export function buildDensitySemanticField(
  group: THREE.Group,
  nodeMeshes: THREE.Mesh[],
  envelope: SemanticEmbodimentEnvelopeV1 | null | undefined
): void {
  if (!envelope) {
    setSemanticEmbodimentPresentationStatus(group, 'PENDING', undefined, 'DENSITY_FIELD');
    return;
  }
  if (envelope.result.status === 'REFUSED') {
    setSemanticEmbodimentPresentationStatus(
      group,
      'REFUSED',
      envelope.result.refusal.message,
      'DENSITY_FIELD'
    );
    group.userData.semanticEmbodimentRefusal = envelope.result.refusal;
    return;
  }
  if (
    envelope.candidateId !== 'DENSITY_FIELD' ||
    envelope.representationFamily !== 'DENSITY' ||
    envelope.result.payload.kind !== 'BINNED_DENSITY'
  ) {
    setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'DENSITY_FIELD');
    return;
  }

  const density = envelope.result.payload.data;
  const expectedCellCount = density.binsX * density.binsY;
  if (
    !Number.isSafeInteger(density.binsX) ||
    !Number.isSafeInteger(density.binsY) ||
    density.binsX <= 0 ||
    density.binsY <= 0 ||
    density.grid.length !== expectedCellCount ||
    envelope.resource.elementCount !== expectedCellCount
  ) {
    setSemanticEmbodimentPresentationStatus(group, 'INVALID', undefined, 'DENSITY_FIELD');
    return;
  }

  const artifactId = [
    'semantic-embodiment',
    envelope.datasetFingerprint,
    envelope.candidateId,
    envelope.provenance.algorithmVersion,
    envelope.provenance.decisionId ?? 'unbound-decision',
  ].join(':');
  const maxCount = Math.max(1, ...density.grid.map((cell) => cell.count));
  const stepX = 4 / density.binsX;
  const stepZ = 4 / density.binsY;
  const commonMetadata = {
    representationKind: 'DENSITY_FIELD',
    payloadKind: 'BINNED_DENSITY',
    artifactId,
    datasetFingerprint: envelope.datasetFingerprint,
    measureFieldX: density.measureFieldX,
    measureFieldY: density.measureFieldY,
    analyticalMethod: envelope.analyticalMethod,
    approximation: envelope.approximation,
    informationContract: envelope.informationContract,
    provenance: envelope.provenance,
  };

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const visibleMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.15,
  });
  const batch = new THREE.InstancedMesh(boxGeometry, visibleMaterial, expectedCellCount);
  batch.name = DENSITY_INSTANCED_SURFACE_NAME;
  batch.userData = {
    ...commonMetadata,
    semanticCellCount: expectedCellCount,
    candidateLocalDrawCalls: 1,
    interactionModel: 'non-rendering-semantic-proxies',
  };

  const proxyGeometry = new THREE.BoxGeometry(1, 1, 1);
  const proxyMaterial = new THREE.MeshBasicMaterial();
  proxyMaterial.visible = false;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  density.grid.forEach((cell, instanceIndex) => {
    const fraction = cell.count / maxCount;
    const height = cell.count === 0 ? 0.035 : 0.08 + 2.5 * fraction;
    const x = -2 + (cell.xIndex + 0.5) * stepX;
    const z = -2 + (cell.yIndex + 0.5) * stepZ;
    const colorValue = numericColor(cell.count, 0, maxCount, 0x0072b2, 0xe69f00);
    const color = new THREE.Color(colorValue);

    position.set(x, height / 2, z);
    scale.set(stepX * 0.88, height, stepZ * 0.88);
    matrix.compose(position, quaternion, scale);
    batch.setMatrixAt(instanceIndex, matrix);
    batch.setColorAt(instanceIndex, color);

    const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
    proxy.name = cell.semanticId;
    proxy.position.copy(position);
    proxy.scale.copy(scale);
    proxy.userData = {
      ...commonMetadata,
      semanticId: cell.semanticId,
      densityElementKind: 'BIN',
      xIndex: cell.xIndex,
      yIndex: cell.yIndex,
      xLowerBound: cell.xLowerBound,
      xUpperBound: cell.xUpperBound,
      yLowerBound: cell.yLowerBound,
      yUpperBound: cell.yUpperBound,
      xUpperInclusive: cell.xUpperInclusive,
      yUpperInclusive: cell.yUpperInclusive,
      count: cell.count,
      countFraction: fraction,
      instancedDensityBatch: batch,
      densityInstanceIndex: instanceIndex,
      densityInstanceBaseColor: color.getHex(),
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

  setSemanticEmbodimentPresentationStatus(group, 'READY', undefined, 'DENSITY_FIELD');
  group.userData.semanticEmbodiment = {
    candidateId: envelope.candidateId,
    payloadKind: 'BINNED_DENSITY',
    artifactId,
    datasetFingerprint: envelope.datasetFingerprint,
    measureFieldX: density.measureFieldX,
    measureFieldY: density.measureFieldY,
    resource: envelope.resource,
    provenance: envelope.provenance,
  };
  group.userData.densityRenderSurface = {
    semanticCellCount: expectedCellCount,
    renderedBatchCount: 1,
    candidateLocalDrawCalls: 1,
    interactionProxyCount: nodeMeshes.length,
  };
}
