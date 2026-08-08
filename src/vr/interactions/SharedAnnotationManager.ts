/**
 * Shared 3D Spatial Annotations, Bookmarks, and Synchronized Tours Manager.
 *
 * Renders 3D spatial pin markers and floating text cards for multi-user collaboration.
 * Synchronizes annotations, camera bookmarks, and guided tour steps across WebRTC peers.
 */

import * as THREE from 'three';
import type { NetworkManager } from '../../network/NetworkManager.ts';

export interface SpatialAnnotation {
  id: string;
  position: [number, number, number];
  text: string;
  authorId: string;
  authorName: string;
  timestamp: number;
  colorHex?: number;
}

export interface SpatialBookmark {
  id: string;
  title: string;
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number, number];
  authorId: string;
  timestamp: number;
}

export interface AnnotationManagerEventMap extends THREE.Object3DEventMap {
  remoteTourStep: THREE.Event & { detail: Record<string, unknown> };
}

export class SharedAnnotationManager extends THREE.Group<AnnotationManagerEventMap> {
  annotations: Map<string, SpatialAnnotation> = new Map();
  bookmarks: Map<string, SpatialBookmark> = new Map();
  annotationMeshes: Map<string, THREE.Group> = new Map();

  networkManager: NetworkManager | null = null;
  currentTourStep: number = 0;

  constructor(networkManager?: NetworkManager | null) {
    super();
    this.networkManager = networkManager ?? null;

    if (this.networkManager) {
      this._wireNetwork();
    }
  }

  /**
   * Connect network event listeners for state deltas.
   */
  setNetworkManager(net: NetworkManager | null): void {
    this.networkManager = net;
    if (net) {
      this._wireNetwork();
    }
  }

  /**
   * Adds a new 3D spatial pin annotation and broadcasts it to peers.
   */
  addAnnotation(
    position: [number, number, number],
    text: string,
    authorId = 'local',
    authorName = 'Analyst',
    colorHex = 0x3388ff
  ): SpatialAnnotation {
    const id = `annot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const annotation: SpatialAnnotation = {
      id,
      position,
      text,
      authorId,
      authorName,
      timestamp: Date.now(),
      colorHex,
    };

    this.annotations.set(id, annotation);
    this._renderAnnotationMesh(annotation);

    if (this.networkManager) {
      this.networkManager.broadcastStateDelta('annotations_add', annotation as unknown as Record<string, unknown>);
    }

    return annotation;
  }

  /**
   * Removes an annotation by ID.
   */
  removeAnnotation(id: string): boolean {
    const deleted = this.annotations.delete(id);
    if (deleted) {
      const mesh = this.annotationMeshes.get(id);
      if (mesh) {
        this.remove(mesh);
        this._disposeGroup(mesh);
        this.annotationMeshes.delete(id);
      }
      if (this.networkManager) {
        this.networkManager.broadcastStateDelta('annotations_remove', { id });
      }
    }
    return deleted;
  }

  /**
   * Creates a saved camera bookmark and broadcasts to peers.
   */
  addBookmark(
    title: string,
    cameraPosition: [number, number, number],
    cameraRotation: [number, number, number, number],
    authorId = 'local'
  ): SpatialBookmark {
    const id = `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const bookmark: SpatialBookmark = {
      id,
      title,
      cameraPosition,
      cameraRotation,
      authorId,
      timestamp: Date.now(),
    };

    this.bookmarks.set(id, bookmark);

    if (this.networkManager) {
      this.networkManager.broadcastStateDelta('bookmarks_add', bookmark as unknown as Record<string, unknown>);
    }

    return bookmark;
  }

  /**
   * Removes a bookmark by ID.
   */
  removeBookmark(id: string): boolean {
    const deleted = this.bookmarks.delete(id);
    if (deleted && this.networkManager) {
      this.networkManager.broadcastStateDelta('bookmarks_remove', { id });
    }
    return deleted;
  }

  /**
   * Synchronizes guided tour step progress across connected peers.
   */
  broadcastTourStep(stepIndex: number, tourId = 'default'): void {
    this.currentTourStep = stepIndex;
    if (this.networkManager) {
      this.networkManager.broadcastStateDelta('tour_step', { stepIndex, tourId });
    }
  }

  /**
   * Handles incoming remote state deltas for annotations, bookmarks, and tour steps.
   */
  handleRemoteDelta(topic: string, data: Record<string, unknown>): void {
    if (topic === 'annotations_add' && data && typeof data.id === 'string') {
      const annotation = data as unknown as SpatialAnnotation;
      this.annotations.set(annotation.id, annotation);
      this._renderAnnotationMesh(annotation);
    } else if (topic === 'annotations_remove' && typeof data?.id === 'string') {
      const id = data.id as string;
      this.annotations.delete(id);
      const mesh = this.annotationMeshes.get(id);
      if (mesh) {
        this.remove(mesh);
        this._disposeGroup(mesh);
        this.annotationMeshes.delete(id);
      }
    } else if (topic === 'bookmarks_add' && data && typeof data.id === 'string') {
      const bookmark = data as unknown as SpatialBookmark;
      this.bookmarks.set(bookmark.id, bookmark);
    } else if (topic === 'bookmarks_remove' && typeof data?.id === 'string') {
      this.bookmarks.delete(data.id as string);
    } else if (topic === 'tour_step' && typeof data?.stepIndex === 'number') {
      this.currentTourStep = data.stepIndex;
      this.dispatchEvent({ type: 'remoteTourStep', detail: data });
    }
  }

  private _wireNetwork(): void {
    if (!this.networkManager) return;
    this.networkManager.addEventListener('stateDelta', (event: Event) => {
      const customEvt = event as CustomEvent;
      const { topic, data } = customEvt.detail || {};
      if (topic) {
        this.handleRemoteDelta(topic, data);
      }
    });
  }

  private _renderAnnotationMesh(annotation: SpatialAnnotation): void {
    if (this.annotationMeshes.has(annotation.id)) return;

    const group = new THREE.Group();
    group.position.set(...annotation.position);

    const color = annotation.colorHex ?? 0x3388ff;

    // 1. 3D Pin Head Sphere
    const pinGeom = new THREE.SphereGeometry(0.04, 16, 16);
    const pinMat = new THREE.MeshBasicMaterial({ color });
    const pinHead = new THREE.Mesh(pinGeom, pinMat);
    pinHead.position.set(0, 0.1, 0);
    group.add(pinHead);

    // 2. Pin Stem Line
    const stemGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.1, 0),
    ]);
    const stemMat = new THREE.LineBasicMaterial({ color });
    const stem = new THREE.Line(stemGeom, stemMat);
    group.add(stem);

    // 3. Text Label Canvas
    const canvas = this._createAnnotationCanvas(annotation.text, annotation.authorName, color);
    const texture = new THREE.CanvasTexture(canvas);
    const labelGeom = new THREE.PlaneGeometry(0.3, 0.12);
    const labelMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const label = new THREE.Mesh(labelGeom, labelMat);
    label.position.set(0, 0.22, 0);
    group.add(label);

    this.annotationMeshes.set(annotation.id, group);
    this.add(group);
  }

  private _createAnnotationCanvas(text: string, authorName: string, colorHex: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
    ctx.roundRect?.(4, 4, 248, 88, 12);
    ctx.fill();

    ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text.slice(0, 20), 128, 40);

    ctx.fillStyle = '#88bbff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`— ${authorName}`, 128, 70);

    return canvas;
  }

  private _disposeGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  dispose(): void {
    for (const [id, mesh] of this.annotationMeshes) {
      this.remove(mesh);
      this._disposeGroup(mesh);
    }
    this.annotationMeshes.clear();
    this.annotations.clear();
    this.bookmarks.clear();
  }
}
