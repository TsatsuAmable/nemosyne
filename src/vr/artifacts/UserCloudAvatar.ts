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
  nameTagMesh: THREE.Mesh;
  leftHandMesh: THREE.Mesh;
  rightHandMesh: THREE.Mesh;
  leftPointerRay: THREE.Line;
  rightPointerRay: THREE.Line;
  userDataset: UserMetadataDataset;
  particleCount = 40;

  private _dummy = new THREE.Object3D();
  private _color = new THREE.Color();
  private _nameTagCanvas: HTMLCanvasElement;
  private _nameTagTexture: THREE.CanvasTexture;

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

    // 3. Floating 3D Name Tag Label
    this._nameTagCanvas = this._createNameTagCanvas(
      userDataset.profile.userName,
      userDataset.profile.role,
      userDataset.profile.colorHex
    );
    this._nameTagTexture = new THREE.CanvasTexture(this._nameTagCanvas);
    const tagGeom = new THREE.PlaneGeometry(0.35, 0.12);
    const tagMat = new THREE.MeshBasicMaterial({
      map: this._nameTagTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.nameTagMesh = new THREE.Mesh(tagGeom, tagMat);
    this.nameTagMesh.position.set(0, 0.28, 0);
    this.add(this.nameTagMesh);

    // 4. VR Hand / Controller Meshes & Pointer Rays
    const handGeom = new THREE.SphereGeometry(0.035, 12, 12);
    const handMat = new THREE.MeshBasicMaterial({
      color: userDataset.profile.colorHex,
      transparent: true,
      opacity: 0.8,
    });

    this.leftHandMesh = new THREE.Mesh(handGeom, handMat);
    this.leftHandMesh.position.set(-0.25, -0.2, -0.3);
    this.add(this.leftHandMesh);

    this.rightHandMesh = new THREE.Mesh(handGeom, handMat.clone());
    this.rightHandMesh.position.set(0.25, -0.2, -0.3);
    this.add(this.rightHandMesh);

    // Pointer rays projecting from hands
    const rayGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1.5),
    ]);
    const rayMat = new THREE.LineBasicMaterial({
      color: userDataset.profile.colorHex,
      transparent: true,
      opacity: 0.5,
    });

    this.leftPointerRay = new THREE.Line(rayGeom, rayMat);
    this.leftHandMesh.add(this.leftPointerRay);

    this.rightPointerRay = new THREE.Line(rayGeom, rayMat.clone());
    this.rightHandMesh.add(this.rightPointerRay);
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

  /**
   * Updates full 6DoF head and hand poses from WebRTC peer stream.
   */
  updatePose(
    headPosition: THREE.Vector3,
    headRotation?: THREE.Quaternion,
    leftHandPos?: THREE.Vector3,
    rightHandPos?: THREE.Vector3
  ): void {
    this.position.copy(headPosition);
    if (headRotation) {
      this.quaternion.copy(headRotation);
      // Billboard name tag so it stays upright/facing viewer
      this.nameTagMesh.quaternion.copy(headRotation).invert();
    }
    if (leftHandPos) {
      this.leftHandMesh.position.copy(leftHandPos).sub(headPosition);
      this.leftHandMesh.visible = true;
    }
    if (rightHandPos) {
      this.rightHandMesh.position.copy(rightHandPos).sub(headPosition);
      this.rightHandMesh.visible = true;
    }
  }

  private _createNameTagCanvas(name: string, role: string, colorHex: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Background pill
    ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
    ctx.roundRect?.(4, 4, 248, 88, 16);
    ctx.fill();

    // Border highlight
    ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Peer Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name || 'Analyst', 128, 42);

    // Peer Role
    ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.font = '16px sans-serif';
    ctx.fillText(role || 'Peer Analyst', 128, 72);

    return canvas;
  }

  dispose(): void {
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.headFallbackMesh.geometry.dispose();
    (this.headFallbackMesh.material as THREE.Material).dispose();
    this.nameTagMesh.geometry.dispose();
    (this.nameTagMesh.material as THREE.Material).dispose();
    this._nameTagTexture.dispose();
    this.leftHandMesh.geometry.dispose();
    (this.leftHandMesh.material as THREE.Material).dispose();
    this.rightHandMesh.geometry.dispose();
    (this.rightHandMesh.material as THREE.Material).dispose();
    this.leftPointerRay.geometry.dispose();
    (this.leftPointerRay.material as THREE.Material).dispose();
    this.rightPointerRay.geometry.dispose();
    (this.rightPointerRay.material as THREE.Material).dispose();
  }
}
