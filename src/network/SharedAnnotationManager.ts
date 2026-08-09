/**
 * Shared 3D Spatial Annotation & Co-Op Pin Drop Manager.
 *
 * Manages synchronized spatial annotations, pin drops, and text notes dropped by
 * analysts within the shared WebXR data space.
 */

import * as THREE from 'three';

export interface SpatialAnnotation {
  id: string;
  authorPeerId: string;
  position: [number, number, number];
  text: string;
  timestamp: number;
}

export class SharedAnnotationManager {
  scene: THREE.Scene;
  private _annotations: Map<string, SpatialAnnotation> = new Map();
  private _pinGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this._pinGroup = new THREE.Group();
    this.scene.add(this._pinGroup);
  }

  addAnnotation(position: [number, number, number], text: string, authorPeerId = 'local'): SpatialAnnotation {
    const id = `pin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const annotation: SpatialAnnotation = {
      id,
      authorPeerId,
      position,
      text,
      timestamp: Date.now(),
    };

    this._annotations.set(id, annotation);
    this._renderPinMesh(annotation);
    return annotation;
  }

  private _renderPinMesh(annotation: SpatialAnnotation): void {
    const pinMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    pinMesh.position.set(...annotation.position);
    pinMesh.userData = { annotationId: annotation.id };
    this._pinGroup.add(pinMesh);
  }

  getAnnotations(): SpatialAnnotation[] {
    return Array.from(this._annotations.values());
  }

  clearAnnotations(): void {
    this._annotations.clear();
    while (this._pinGroup.children.length > 0) {
      this._pinGroup.remove(this._pinGroup.children[0]);
    }
  }
}
