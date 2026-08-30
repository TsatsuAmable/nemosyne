import * as THREE from 'three';

export type SemanticEmbodimentPresentationStatus =
  'PENDING' | 'REFUSED' | 'INVALID' | 'UNAVAILABLE' | 'READY';

export type SemanticEmbodimentPresentationCandidateId =
  | 'AGGREGATE_VOLUME'
  | 'DISTRIBUTION_FIELD';

export const SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME = 'semantic-embodiment-status';

const STATUS_STYLE: Record<
  Exclude<SemanticEmbodimentPresentationStatus, 'READY'>,
  { color: number; cssColor: string }
> = {
  PENDING: { color: 0xe69f00, cssColor: '#e69f00' },
  REFUSED: { color: 0xd55e00, cssColor: '#d55e00' },
  INVALID: { color: 0xcc79a7, cssColor: '#cc79a7' },
  UNAVAILABLE: { color: 0x999999, cssColor: '#999999' },
};

const CANDIDATE_COPY: Record<
  SemanticEmbodimentPresentationCandidateId,
  {
    label: string;
    pending: string;
    refused: string;
    invalid: string;
    unavailable: string;
  }
> = {
  DISTRIBUTION_FIELD: {
    label: 'DISTRIBUTION',
    pending: 'Building the empirical distribution in the analytical kernel.',
    refused: 'The analytical kernel refused this distribution request.',
    invalid: 'The returned payload did not match the governed distribution contract.',
    unavailable: 'No current analytical distribution result is available.',
  },
  AGGREGATE_VOLUME: {
    label: 'AGGREGATE',
    pending: 'Building the aggregate volume in the analytical kernel.',
    refused: 'The analytical kernel refused this aggregate request.',
    invalid: 'The returned payload did not match the governed aggregate contract.',
    unavailable: 'No current analytical aggregate result is available.',
  },
};

function statusPresentation(
  candidateId: SemanticEmbodimentPresentationCandidateId,
  status: Exclude<SemanticEmbodimentPresentationStatus, 'READY'>
): { title: string; fallback: string; color: number; cssColor: string } {
  const copy = CANDIDATE_COPY[candidateId];
  const style = STATUS_STYLE[status];
  const fallback =
    status === 'PENDING'
      ? copy.pending
      : status === 'REFUSED'
        ? copy.refused
        : status === 'INVALID'
          ? copy.invalid
          : copy.unavailable;
  return {
    title: `${copy.label} ${status}`,
    fallback,
    ...style,
  };
}

function disposeStatusSurface(surface: THREE.Object3D): void {
  if (!(surface instanceof THREE.Mesh)) return;
  surface.geometry.dispose();
  const materials = Array.isArray(surface.material) ? surface.material : [surface.material];
  for (const material of materials) {
    if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
    material.dispose();
  }
}

function removeStatusSurface(group: THREE.Group): void {
  const existing = group.getObjectByName(SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME);
  if (!existing) return;
  group.remove(existing);
  disposeStatusSurface(existing);
}

function statusMaterial(
  candidateId: SemanticEmbodimentPresentationCandidateId,
  status: Exclude<SemanticEmbodimentPresentationStatus, 'READY'>,
  message: string
): THREE.MeshBasicMaterial {
  const presentation = statusPresentation(candidateId, status);
  if (typeof document === 'undefined') {
    return new THREE.MeshBasicMaterial({ color: presentation.color, side: THREE.DoubleSide });
  }

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.MeshBasicMaterial({ color: presentation.color, side: THREE.DoubleSide });
  }

  context.fillStyle = 'rgba(4, 10, 20, 0.94)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = presentation.cssColor;
  context.lineWidth = 8;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.font = 'bold 34px monospace';
  context.fillStyle = presentation.cssColor;
  context.fillText(`// ${presentation.title}`, 34, 62);
  context.font = '24px monospace';
  context.fillStyle = '#d7f7ff';
  context.fillText(message.slice(0, 78), 34, 120, canvas.width - 68);
  context.font = '19px monospace';
  context.fillStyle = '#88ccff';
  context.fillText('No fallback visualisation has been substituted.', 34, 158);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/**
 * Present semantic loading/refusal state without creating an analytical mark.
 * The surface is deliberately excluded from Artifact.nodeMeshes and therefore
 * cannot be counted, selected or interpreted as Rust analytical evidence.
 */
export function setSemanticEmbodimentPresentationStatus(
  group: THREE.Group,
  status: SemanticEmbodimentPresentationStatus,
  detail?: string,
  candidateId: SemanticEmbodimentPresentationCandidateId = 'DISTRIBUTION_FIELD'
): void {
  group.userData.semanticEmbodimentStatus = status;
  group.userData.semanticEmbodimentCandidateId = candidateId;
  removeStatusSurface(group);
  if (status === 'READY') {
    delete group.userData.semanticEmbodimentStatusMessage;
    return;
  }

  const presentation = statusPresentation(candidateId, status);
  const message = detail?.trim() || presentation.fallback;
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.8),
    statusMaterial(candidateId, status, message)
  );
  surface.name = SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME;
  surface.position.set(0, 1.25, 0.1);
  surface.renderOrder = 20;
  surface.userData = {
    representationKind: 'SEMANTIC_STATUS',
    semanticEmbodimentCandidateId: candidateId,
    semanticEmbodimentStatus: status,
    semanticEmbodimentMessage: message,
    analyticalElement: false,
    selectable: false,
  };
  group.userData.semanticEmbodimentStatusMessage = message;
  group.add(surface);
}
