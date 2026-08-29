import * as THREE from 'three';

export type SemanticEmbodimentPresentationStatus =
  'PENDING' | 'REFUSED' | 'INVALID' | 'UNAVAILABLE' | 'READY';

export const SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME = 'semantic-embodiment-status';

const STATUS_PRESENTATION: Record<
  Exclude<SemanticEmbodimentPresentationStatus, 'READY'>,
  { title: string; fallback: string; color: number; cssColor: string }
> = {
  PENDING: {
    title: 'DISTRIBUTION PENDING',
    fallback: 'Building the empirical distribution in the analytical kernel.',
    color: 0xe69f00,
    cssColor: '#e69f00',
  },
  REFUSED: {
    title: 'DISTRIBUTION REFUSED',
    fallback: 'The analytical kernel refused this distribution request.',
    color: 0xd55e00,
    cssColor: '#d55e00',
  },
  INVALID: {
    title: 'DISTRIBUTION INVALID',
    fallback: 'The returned payload did not match the governed distribution contract.',
    color: 0xcc79a7,
    cssColor: '#cc79a7',
  },
  UNAVAILABLE: {
    title: 'DISTRIBUTION UNAVAILABLE',
    fallback: 'No current analytical distribution result is available.',
    color: 0x999999,
    cssColor: '#999999',
  },
};

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
  status: Exclude<SemanticEmbodimentPresentationStatus, 'READY'>,
  message: string
): THREE.MeshBasicMaterial {
  const presentation = STATUS_PRESENTATION[status];
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
 * cannot be counted, selected or interpreted as Rust distribution evidence.
 */
export function setSemanticEmbodimentPresentationStatus(
  group: THREE.Group,
  status: SemanticEmbodimentPresentationStatus,
  detail?: string
): void {
  group.userData.semanticEmbodimentStatus = status;
  removeStatusSurface(group);
  if (status === 'READY') {
    delete group.userData.semanticEmbodimentStatusMessage;
    return;
  }

  const presentation = STATUS_PRESENTATION[status];
  const message = detail?.trim() || presentation.fallback;
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.8),
    statusMaterial(status, message)
  );
  surface.name = SEMANTIC_EMBODIMENT_STATUS_SURFACE_NAME;
  surface.position.set(0, 1.25, 0.1);
  surface.renderOrder = 20;
  surface.userData = {
    representationKind: 'SEMANTIC_STATUS',
    semanticEmbodimentStatus: status,
    semanticEmbodimentMessage: message,
    analyticalElement: false,
    selectable: false,
  };
  group.userData.semanticEmbodimentStatusMessage = message;
  group.add(surface);
}
