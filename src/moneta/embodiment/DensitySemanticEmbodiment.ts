import * as THREE from 'three';
import { numericColor } from '../../data/Encodings.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../representation/SemanticEmbodimentPayload.ts';
import { setSemanticEmbodimentPresentationStatus } from './SemanticEmbodimentStatus.ts';

/**
 * Thin R2C M3 density presentation adapter. Rust owns field selection, domains,
 * bin assignment, counts, exclusions, semantic IDs, method identity and
 * provenance. This adapter maps the bounded binned payload to Three.js only.
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

  for (const cell of density.grid) {
    const fraction = cell.count / maxCount;
    const height = cell.count === 0 ? 0.035 : 0.08 + 2.5 * fraction;
    const geometry = new THREE.BoxGeometry(stepX * 0.88, height, stepZ * 0.88);
    geometry.translate(0, height / 2, 0);
    const color = numericColor(cell.count, 0, maxCount, 0x0072b2, 0xe69f00);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: cell.count === 0 ? 0x001122 : color,
      emissiveIntensity: cell.count === 0 ? 0.08 : 0.22,
      transparent: cell.count === 0,
      opacity: cell.count === 0 ? 0.18 : 0.9,
      roughness: 0.35,
      metalness: 0.15,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = cell.semanticId;
    mesh.position.set(
      -2 + (cell.xIndex + 0.5) * stepX,
      0,
      -2 + (cell.yIndex + 0.5) * stepZ
    );
    mesh.userData = {
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
    };
    group.add(mesh);
    nodeMeshes.push(mesh);
  }

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
}
