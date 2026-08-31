import * as THREE from 'three';
import type { SemanticDetailEnvelopeV1 } from '../../../moneta/representation/SemanticDrillDown.ts';

export const SEMANTIC_DETAIL_OVERLAY_NAME = 'semantic-detail-observations';

/**
 * Presentation-only A3 overlay for a bounded semantic-detail page.
 *
 * The source semantic representation remains mounted and selected. Returned
 * observation identities are mapped to a neutral local grid with no analytical
 * position claim. One InstancedMesh keeps visible draw cost independent of the
 * page size; per-observation identity is retained in bounded metadata rather
 * than reconstructed from transient instance indexes.
 */
export class SemanticDetailObservationOverlay {
  private group: THREE.Group | null = null;

  get visibleGroup(): THREE.Group | null {
    return this.group;
  }

  clear(): void {
    const current = this.group;
    if (!current) return;
    current.parent?.remove(current);
    current.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const entry of material) entry.dispose();
      } else {
        material?.dispose?.();
      }
    });
    this.group = null;
  }

  show(parent: THREE.Group, anchor: THREE.Mesh, envelope: SemanticDetailEnvelopeV1): void {
    this.clear();
    if (envelope.result.status !== 'READY' || envelope.result.returnedCount === 0) return;

    const result = envelope.result;
    const group = new THREE.Group();
    group.name = SEMANTIC_DETAIL_OVERLAY_NAME;
    group.position.copy(anchor.position);
    group.position.y += Math.max(0.3, Math.abs(anchor.scale.y) * 0.5 + 0.2);
    group.userData = {
      representationKind: 'SEMANTIC_DETAIL_OBSERVATIONS',
      presentationSemantics: 'neutral-bounded-detail-layout-no-analytical-position-claim',
      datasetFingerprint: envelope.request.target.datasetFingerprint,
      decisionId: envelope.request.target.decisionId,
      representationFamily: envelope.request.target.representationFamily,
      parentSemanticId: envelope.request.target.semanticObjectId,
      totalMemberCount: result.totalMemberCount,
      returnedCount: result.returnedCount,
      observationIds: [...result.observationIds],
      candidateLocalDrawCalls: 1,
    };

    const count = result.returnedCount;
    const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    const spacing = Math.max(0.055, Math.min(0.14, 1.5 / Math.max(columns, rows)));
    const geometry = new THREE.SphereGeometry(0.025, 6, 4);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const instances = new THREE.InstancedMesh(geometry, material, count);
    instances.name = `${SEMANTIC_DETAIL_OVERLAY_NAME}-instances`;
    instances.userData = {
      representationKind: 'SEMANTIC_DETAIL_OBSERVATIONS',
      parentSemanticId: envelope.request.target.semanticObjectId,
      observationIds: [...result.observationIds],
      compactViews: result.compactViews ? [...result.compactViews] : undefined,
      candidateLocalDrawCalls: 1,
    };

    const object = new THREE.Object3D();
    const startX = -((columns - 1) * spacing) / 2;
    const startZ = -((rows - 1) * spacing) / 2;
    for (let index = 0; index < count; index += 1) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      object.position.set(startX + col * spacing, 0, startZ + row * spacing);
      object.scale.setScalar(1);
      object.updateMatrix();
      instances.setMatrixAt(index, object.matrix);
    }
    instances.instanceMatrix.needsUpdate = true;

    group.add(instances);
    parent.add(group);
    this.group = group;
  }
}
