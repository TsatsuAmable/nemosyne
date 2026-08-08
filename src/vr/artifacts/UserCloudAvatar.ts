/**
 * 3D Living User Cloud Avatar Renderer.
 *
 * Renders peer analysts in VR space as dynamic 3D instanced particle clouds
 * derived from their interaction telemetry, focus columns, and sentiment profile.
 */

import * as THREE from 'three';
import type { UserMetadataDataset } from '../../data/UserMetadataDataset.ts';

export class UserCloudAvatar extends THREE.Group {
  particleMesh: THREE.InstancedMesh;
  headFallbackMesh: THREE.Mesh;
  userDataset: UserMetadataDataset;
  particleCount = 40;

  private _dummy = new THREE.Object3D();
  private _color = new THREE.Color();

  constructor(userDataset: UserMetadataDataset) {
    super();
    this.userDataset = userDataset;

    // 1. Particle Cloud Representation
    const pGeom = new THREE.SphereGeometry(0.015, 8, 8);
    const pMat = new THREE.MeshBasicMaterial({
      color: userDataset.profile.colorHex,
      transparent: true,
      opacity: 0.85,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeom, pMat, this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      const radius = 0.15 + Math.random() * 0.15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      this._dummy.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      this._dummy.scale.setScalar(0.8 + Math.random() * 0.5);
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.add(this.particleMesh);

    // 2. Head Wireframe Fallback Mesh
    const hGeom = new THREE.IcosahedronGeometry(0.12, 1);
    const hMat = new THREE.MeshBasicMaterial({
      color: userDataset.profile.colorHex,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    this.headFallbackMesh = new THREE.Mesh(hGeom, hMat);
    this.add(this.headFallbackMesh);
  }

  /**
   * Update particle cloud position, orbit pulse, and color based on peer telemetry.
   */
  updateTelemetry(headPosition: THREE.Vector3, time = performance.now()): void {
    this.position.copy(headPosition);

    const sentiment = this.userDataset.getAverageSentiment();
    const pulseSpeed = sentiment > 0 ? 3.0 : 1.5;

    // Shift color brightness based on sentiment score
    this._color.setHex(this.userDataset.profile.colorHex);
    if (sentiment < 0) {
      this._color.lerp(new THREE.Color(0xff0066), Math.abs(sentiment));
    }
    (this.particleMesh.material as THREE.MeshBasicMaterial).color.copy(this._color);

    // Orbit particles softly around head anchor
    const t = time / 1000.0;
    for (let i = 0; i < this.particleCount; i++) {
      const baseR = 0.15 + (i % 5) * 0.03;
      const angle = t * pulseSpeed + i * 0.2;
      this._dummy.position.set(
        Math.cos(angle) * baseR,
        Math.sin(angle * 1.5) * 0.08,
        Math.sin(angle) * baseR
      );
      this._dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.headFallbackMesh.geometry.dispose();
    (this.headFallbackMesh.material as THREE.Material).dispose();
  }
}
