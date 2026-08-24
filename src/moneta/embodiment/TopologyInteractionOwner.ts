import * as THREE from 'three';
import type { DatasetEdge } from '../../data/Dataset.ts';
import type {
  InteractionCallbacks,
  MetaphorActionHandlers,
  VRInteraction,
  VRTranslatorOptions,
} from '../types.ts';

export class TopologyInteractionOwner {
  constructor(private readonly _registeredActions: MetaphorActionHandlers) {}

  create(
    interactionType: VRInteraction,
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    edges: DatasetEdge[],
    options?: VRTranslatorOptions
  ): InteractionCallbacks {
    const actions = { ...this._registeredActions, ...options?.metaphorActions };
    const base = {
      onHover: (mesh: THREE.Mesh) => {
        if (
          (mesh.material as THREE.MeshStandardMaterial | undefined)?.emissiveIntensity !== undefined
        ) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2;
        } else if ((mesh.userData as { instancedCloud?: unknown }).instancedCloud) {
          (mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(
            1,
            (mesh.material as THREE.MeshBasicMaterial).opacity + 0.25
          );
        } else if (mesh.material) {
          (mesh.userData as { _originalOpacity?: number })._originalOpacity = (
            mesh.material as THREE.Material
          ).opacity;
          (mesh.material as THREE.Material).opacity = Math.min(
            1,
            (mesh.material as THREE.Material).opacity + 0.4
          );
        }
      },
      onUnhover: (mesh: THREE.Mesh) => {
        if (
          (mesh.material as THREE.MeshStandardMaterial | undefined)?.emissiveIntensity !== undefined
        ) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
        } else if (
          mesh.material &&
          (mesh.userData as { _originalOpacity?: number })._originalOpacity !== undefined
        ) {
          (mesh.material as THREE.Material).opacity = (
            mesh.userData as { _originalOpacity: number }
          )._originalOpacity;
        }
      },
      onSelect: (mesh: THREE.Mesh) => {
        if (
          (mesh.material as THREE.MeshStandardMaterial | undefined)?.emissiveIntensity !== undefined
        ) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 3;
        } else if (mesh.material) {
          (mesh.userData as { _originalOpacity?: number })._originalOpacity = (
            mesh.material as THREE.Material
          ).opacity;
          (mesh.material as THREE.Material).opacity = Math.min(
            1,
            (mesh.material as THREE.Material).opacity + 0.6
          );
        }
      },
    };
    const meshList = nodeMeshes.filter((mesh) => !(mesh instanceof THREE.InstancedMesh));
    const others = (target: THREE.Mesh) => meshList.filter((mesh) => mesh !== target);
    switch (interactionType) {
      case 'RESONANCE_PULSE':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            const partners: THREE.Mesh[] = [];
            if (edges.length && mesh.userData.row) {
              const row = mesh.userData.row as Record<string, unknown>;
              const id = (row.id ?? row.name) as string | number;
              for (const edge of edges) {
                if (edge.source === id) {
                  const partner = meshList.find(
                    (candidate) =>
                      ((candidate.userData.row as Record<string, unknown> | undefined)?.id ??
                        (candidate.userData.row as Record<string, unknown> | undefined)?.name) ===
                      edge.target
                  );
                  if (partner) partners.push(partner);
                }
                if (edge.target === id) {
                  const partner = meshList.find(
                    (candidate) =>
                      ((candidate.userData.row as Record<string, unknown> | undefined)?.id ??
                        (candidate.userData.row as Record<string, unknown> | undefined)?.name) ===
                      edge.source
                  );
                  if (partner) partners.push(partner);
                }
              }
            }
            actions.applyResonancePulse?.(group, mesh, partners);
          },
        };
      case 'FORK_PLANE':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            actions.applyForkPlane?.(group, mesh);
          },
        };
      case 'CHRONO_DIAL':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            actions.applyChronoDial?.(group, mesh);
          },
        };
      case 'CONSTELLATION':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            actions.applyConstellation?.(group, mesh, others(mesh).slice(0, 8));
          },
        };
      case 'BEACON':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            actions.applyBeacon?.(group, mesh);
          },
        };
      case 'ALEPH':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            actions.applyAleph?.(group, mesh, others(mesh));
          },
        };
      default:
        return { ...base, type: interactionType };
    }
  }
}
