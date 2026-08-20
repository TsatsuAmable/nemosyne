/**
 * Peer Avatar & Spatial Pointer Manager for WebXR Collaboration.
 *
 * Renders lightweight headset & dual-hand avatars for connected remote analysts,
 * complete with color-coded laser pointers and gaze target indicators.
 */

import * as THREE from 'three';
import type { PeerState } from './CollaborativeStateSync.ts';

export interface AvatarMeshGroup {
  peerId: string;
  headGroup: THREE.Group;
  leftHandMesh: THREE.Mesh;
  rightHandMesh: THREE.Mesh;
  laserPointer: THREE.Line;
  color: string;
}

export class PeerAvatarManager {
  scene: THREE.Scene;
  private _avatarMap: Map<string, AvatarMeshGroup> = new Map();
  private _palette = ['#00ffcc', '#ff0055', '#ffaa00', '#aa44ff', '#00ff66'];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  getOrCreateAvatar(peerId: string): AvatarMeshGroup {
    let existing = this._avatarMap.get(peerId);
    if (existing) return existing;

    const colorIdx = this._avatarMap.size % this._palette.length;
    const colorHex = this._palette[colorIdx];
    const colorObj = new THREE.Color(colorHex);

    // Head Group
    const headGroup = new THREE.Group();
    const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const headMat = new THREE.MeshBasicMaterial({ color: colorObj, wireframe: true });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headGroup.add(headMesh);

    // Hands
    const handGeo = new THREE.BoxGeometry(0.05, 0.05, 0.08);
    const handMat = new THREE.MeshBasicMaterial({ color: colorObj });
    const leftHandMesh = new THREE.Mesh(handGeo, handMat);
    const rightHandMesh = new THREE.Mesh(handGeo, handMat);

    // Laser Pointer
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -2.5),
    ]);
    const laserMat = new THREE.LineBasicMaterial({ color: colorObj, transparent: true, opacity: 0.7 });
    const laserPointer = new THREE.Line(laserGeo, laserMat);
    rightHandMesh.add(laserPointer);

    this.scene.add(headGroup);
    this.scene.add(leftHandMesh);
    this.scene.add(rightHandMesh);

    existing = {
      peerId,
      headGroup,
      leftHandMesh,
      rightHandMesh,
      laserPointer,
      color: colorHex,
    };

    this._avatarMap.set(peerId, existing);
    return existing;
  }

  updatePeerTransforms(peerState: PeerState): void {
    if (!peerState.cameraPose) return;
    const avatar = this.getOrCreateAvatar(peerState.peerId);

    const pos = peerState.cameraPose.position;
    const rot = peerState.cameraPose.rotation;

    avatar.headGroup.position.set(...pos);
    avatar.headGroup.quaternion.set(...rot);

    // Position hand avatars relative to headset
    avatar.leftHandMesh.position.set(pos[0] - 0.2, pos[1] - 0.25, pos[2] - 0.3);
    avatar.rightHandMesh.position.set(pos[0] + 0.2, pos[1] - 0.25, pos[2] - 0.3);
  }

  removePeer(peerId: string): void {
    const avatar = this._avatarMap.get(peerId);
    if (!avatar) return;

    this.scene.remove(avatar.headGroup);
    this.scene.remove(avatar.leftHandMesh);
    this.scene.remove(avatar.rightHandMesh);
    this._avatarMap.delete(peerId);
  }

  clearAll(): void {
    for (const peerId of Array.from(this._avatarMap.keys())) {
      this.removePeer(peerId);
    }
  }

  dispose(): void {
    this.clearAll();
  }

  getAvatarCount(): number {
    return this._avatarMap.size;
  }
}
