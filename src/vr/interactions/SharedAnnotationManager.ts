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

function coerceColorHex(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) return value;
  // Legacy clients may send colorHex as a CSS hex string ('#ff0000' / 'ff0000').
  if (typeof value === 'string' && /^#?[0-9a-fA-F]{6}$/.test(value)) {
    return parseInt(value.replace(/^#/, ''), 16);
  }
  return null;
}

/**
 * Validate and normalize a remote annotation payload. Accepts legacy shapes
 * the old unchecked cast permitted (string colorHex, missing authorName)
 * while keeping the security bounds (finite in-range positions, id/text
 * length caps, color range). Returns null for anything malformed.
 */
function coerceAnnotation(value: Record<string, unknown>): SpatialAnnotation | null {
  if (!isSafeId(value.id)) return null;
  if (!isFiniteTuple(value.position, 3)) return null;
  if (typeof value.text !== 'string' || value.text.length > MAX_REMOTE_TEXT_LENGTH) return null;
  if (!isSafeId(value.authorId)) return null;
  const authorName =
    typeof value.authorName === 'string' && value.authorName.length <= MAX_REMOTE_TITLE_LENGTH
      ? value.authorName
      : '';
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return null;
  const colorHex = coerceColorHex(value.colorHex);
  if (colorHex === null) return null;
  const annotation: SpatialAnnotation = {
    id: value.id,
    position: value.position as [number, number, number],
    text: value.text,
    authorId: value.authorId,
    authorName,
    timestamp: value.timestamp,
  };
  if (colorHex !== undefined) annotation.colorHex = colorHex;
  return annotation;
}

/**
 * Validate and normalize a remote bookmark payload. Accepts a missing
 * cameraRotation (legacy) by defaulting to the identity quaternion; a
 * present-but-malformed rotation (wrong arity / non-finite / out of range)
 * is still rejected. Keeps the security bounds on ids, titles, and positions.
 */
function coerceBookmark(value: Record<string, unknown>): SpatialBookmark | null {
  if (!isSafeId(value.id)) return null;
  if (typeof value.title !== 'string' || value.title.length > MAX_REMOTE_TITLE_LENGTH) return null;
  if (!isFiniteTuple(value.cameraPosition, 3)) return null;
  let cameraRotation: [number, number, number, number];
  if (isFiniteTuple(value.cameraRotation, 4)) {
    cameraRotation = value.cameraRotation as [number, number, number, number];
  } else if (value.cameraRotation === undefined) {
    cameraRotation = [0, 0, 0, 1];
  } else {
    return null;
  }
  if (typeof value.authorId !== 'string' || value.authorId.length > MAX_REMOTE_ID_LENGTH) return null;
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return null;
  return {
    id: value.id,
    title: value.title,
    cameraPosition: value.cameraPosition as [number, number, number],
    cameraRotation,
    authorId: value.authorId,
    timestamp: value.timestamp,
  };
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

    // Validate + apply. A rate-limit slot is consumed only when the delta is
    // well-formed and actually applied, so a flood of malformed-but-sized
    // payloads cannot starve legitimate deltas (the slot was previously
    // pushed before validation).
    let applied = false;
    if (topic === 'annotations_add' && data) {
      const annotation = coerceAnnotation(data);
      if (annotation && (this.annotations.has(annotation.id) || this.annotations.size < MAX_REMOTE_ANNOTATIONS)) {
        this.annotations.set(annotation.id, annotation);
        this._renderAnnotationMesh(annotation);
        applied = true;
      }
    } else if (topic === 'annotations_remove' && isSafeId(data?.id)) {
      const id = data.id as string;
      this.annotations.delete(id);
      const mesh = this.annotationMeshes.get(id);
      if (mesh) {
        this.remove(mesh);
        this._disposeGroup(mesh);
        this.annotationMeshes.delete(id);
      }
      applied = true;
    } else if (topic === 'bookmarks_add' && data) {
      const bookmark = coerceBookmark(data);
      if (bookmark && (this.bookmarks.has(bookmark.id) || this.bookmarks.size < MAX_REMOTE_BOOKMARKS)) {
        this.bookmarks.set(bookmark.id, bookmark);
        applied = true;
      }
    } else if (topic === 'bookmarks_remove' && isSafeId(data?.id)) {
      this.bookmarks.delete(data.id);
      applied = true;
    } else if (
      topic === 'tour_step' &&
      typeof data?.stepIndex === 'number' &&
      Number.isInteger(data.stepIndex) &&
      data.stepIndex >= 0 &&
      // tourId is optional for backward compatibility with older/external
      // clients that broadcast { stepIndex } without a tourId; when present
      // it must still be a safe id (an empty/oversized id is rejected).
      (data?.tourId === undefined || isSafeId(data?.tourId))
    ) {
      this.currentTourStep = data.stepIndex;
      this.dispatchEvent({ type: 'remoteTourStep', detail: data });
      applied = true;
    }

    if (applied) this._remoteDeltaTimes.push(now);
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
