import * as THREE from 'three';
import type { FormaCompiledSliceV1 } from '../forma/FormaSpatialCompiler.ts';

/**
 * Builds 3D spatial presentation meshes from a compiled Forma slice.
 *
 * Each element is translated to a Box (VOXEL) or Sphere with visual encodings
 * and embeds its complete reverse explanation trace in userData.
 */
export function buildFormaSpatialSlice(
  group: THREE.Group,
  nodeMeshes: THREE.Mesh[],
  slice: FormaCompiledSliceV1
): void {
  for (const element of slice.elements) {
    const isVoxel = element.visualEncoding.shape === 'VOXEL';
    const sx = element.scale[0] || 0.2;
    const sy = element.scale[1] || 0.2;
    const sz = element.scale[2] || 0.2;

    const geom = isVoxel
      ? new THREE.BoxGeometry(sx, sy, sz)
      : new THREE.SphereGeometry(sx / 2, 16, 16);

    const isConjectural = Boolean(
      element.visualEncoding.isConjectural || element.bindingKind === 'CONJECTURAL'
    );

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(element.visualEncoding.colorHex),
      transparent: element.visualEncoding.opacity < 1,
      opacity: element.visualEncoding.opacity,
      wireframe: isConjectural,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(element.position[0], element.position[1], element.position[2]);

    const reverseTrace = slice.reverseExplanation.find(
      (trace) => trace.elementId === element.elementId
    );

    mesh.name = element.elementId;
    mesh.userData = {
      representationKind: 'FORMA_SPATIAL_SLICE',
      elementId: element.elementId,
      semanticId: element.semanticNodeId,
      semanticNodeId: element.semanticNodeId,
      channel: element.channel,
      bindingKind: element.bindingKind,
      epistemicStatus: element.epistemicStatus,
      proposalId: element.proposalId,
      isConjectural,
      reverseExplanation: reverseTrace,
      provenance: {
        sliceId: slice.sliceId,
        planId: slice.planId,
        snapshotId: slice.snapshotId,
        contextId: slice.contextId,
      },
    };

    group.add(mesh);
    nodeMeshes.push(mesh);
  }
}
