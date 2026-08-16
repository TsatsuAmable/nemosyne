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

const MAX_REMOTE_ANNOTATIONS = 1000;
const MAX_REMOTE_BOOKMARKS = 500;
const MAX_REMOTE_TEXT_LENGTH = 500;
const MAX_REMOTE_ID_LENGTH = 128;
const MAX_REMOTE_TITLE_LENGTH = 200;
const MAX_REMOTE_COORDINATE = 10000;
const MAX_REMOTE_PAYLOAD_BYTES = 16_384;
const REMOTE_DELTA_WINDOW_MS = 10_000;
const MAX_REMOTE_DELTAS_PER_WINDOW = 100;

function isFiniteTuple(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= MAX_REMOTE_COORDINATE)
  );
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_REMOTE_ID_LENGTH;
}

function isAnnotation(value: Record<string, unknown>): value is Record<string, unknown> & SpatialAnnotation {
  return (
    isSafeId(value.id) &&
    isFiniteTuple(value.position, 3) &&
    typeof value.text === 'string' &&
    value.text.length <= MAX_REMOTE_TEXT_LENGTH &&
    isSafeId(value.authorId) &&
    typeof value.authorName === 'string' &&
    value.authorName.length <= MAX_REMOTE_TITLE_LENGTH &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp) &&
    (value.colorHex === undefined || (typeof value.colorHex === 'number' && Number.isInteger(value.colorHex) && value.colorHex >= 0 && value.colorHex <= 0xffffff))
  );
}

function isBookmark(value: Record<string, unknown>): value is Record<string, unknown> & SpatialBookmark {
  return (
    isSafeId(value.id) &&
    typeof value.title === 'string' &&
    value.title.length <= MAX_REMOTE_TITLE_LENGTH &&
    isFiniteTuple(value.cameraPosition, 3) &&
    isFiniteTuple(value.cameraRotation, 4) &&
    typeof value.authorId === 'string' &&
    value.authorId.length <= MAX_REMOTE_ID_LENGTH &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp)
  );
}

export interface AnnotationManagerEventMap extends THREE.Object3DEventMap {
  remoteTourStep: { detail: Record<string, unknown> };
}

export class SharedAnnotationManager extends THREE.Group<AnnotationManagerEventMap> {
  annotations: Map<string, SpatialAnnotation> = new Map();
  bookmarks: Map<string, SpatialBookmark> = new Map();
  annotationMeshes: Map<string, THREE.Group> = new Map();

  networkManager: NetworkManager | null = null;
  currentTourStep: number = 0;
  private _remoteDeltaTimes: number[] = [];

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
  ): SpatialAnnotation | null {
    if (!this._canMutateSharedState()) return null;
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
    if (!this._canMutateSharedState()) return false;
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
  ): SpatialBookmark | null {
    if (!this._canMutateSharedState()) return null;
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
    if (!this._canMutateSharedState()) return false;
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
    if (!this._canMutateSharedState()) return;
    this.currentTourStep = stepIndex;
    if (this.networkManager) {
      this.networkManager.broadcastStateDelta('tour_step', { stepIndex, tourId });
    }
  }

  private _canMutateSharedState(): boolean {
    return !this.networkManager || this.networkManager.room.canMutateSharedState(this.networkManager.role);
  }

  /**
   * Handles incoming remote state deltas for annotations, bookmarks, and tour steps.
   */
  handleRemoteDelta(topic: string, data: Record<string, unknown>): void {
    const now = Date.now();
    this._remoteDeltaTimes = this._remoteDeltaTimes.filter((time) => now - time < REMOTE_DELTA_WINDOW_MS);
    if (this._remoteDeltaTimes.length >= MAX_REMOTE_DELTAS_PER_WINDOW) return;
    let payloadSize = 0;
    try {
      payloadSize = JSON.stringify(data)?.length ?? 0;
    } catch {
      return;
    }
    if (payloadSize > MAX_REMOTE_PAYLOAD_BYTES) return;
    this._remoteDeltaTimes.push(now);

    if (topic === 'annotations_add' && data && isAnnotation(data) && (this.annotations.has(data.id) || this.annotations.size < MAX_REMOTE_ANNOTATIONS)) {
      const annotation = data;
      this.annotations.set(annotation.id, annotation);
      this._renderAnnotationMesh(annotation);
    } else if (topic === 'annotations_remove' && isSafeId(data?.id)) {
      const id = data.id as string;
      this.annotations.delete(id);
      const mesh = this.annotationMeshes.get(id);
      if (mesh) {
        this.remove(mesh);
        this._disposeGroup(mesh);
        this.annotationMeshes.delete(id);
      }
    } else if (topic === 'bookmarks_add' && data && isBookmark(data) && (this.bookmarks.has(data.id) || this.bookmarks.size < MAX_REMOTE_BOOKMARKS)) {
      const bookmark = data;
      this.bookmarks.set(bookmark.id, bookmark);
    } else if (topic === 'bookmarks_remove' && isSafeId(data?.id)) {
      this.bookmarks.delete(data.id);
    } else if (
      topic === 'tour_step' &&
      typeof data?.stepIndex === 'number' &&
      Number.isInteger(data.stepIndex) &&
      data.stepIndex >= 0 &&
      isSafeId(data.tourId)
    ) {
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
