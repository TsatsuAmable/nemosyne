/**
 * Farcaster Dimensionality & Spatial Teleportation Engine.
 *
 * Enables multi-dimensional perspective warping (2D ↔ 3D ↔ TDA ↔ Time) and
 * spatial map-based terrain teleportation across 3D memory palace locations.
 */

import * as THREE from 'three';
import type { FarcasterWarpCallback, Updatable } from '../coordinators/types.ts';

export type DimensionMode = '2D_TABULAR' | '3D_SPATIAL' | 'TDA_MAPPER' | 'TIME_RIBBON';

export interface MapCoordinate {
  x: number;
  y: number;
  z: number;
  label?: string;
  datasetNodeId?: string;
}

export interface DimensionalityWarpResult {
  fromDimension: DimensionMode;
  toDimension: DimensionMode;
  targetPosition: THREE.Vector3;
  targetCameraAngle: THREE.Euler;
  operationApplied: string | null;
  mapCoordinate?: MapCoordinate;
}

export type PortalSemanticTarget =
  | { kind: 'saved-investigation'; archiveId: string }
  | { kind: 'overview' }
  | { kind: 'detail'; nodeId: string }
  | { kind: 'branch'; branchId: string };

export interface PortalPreviewInfo {
  label: string;
  description: string;
}

export interface FarcasterPortalOptions {
  position?: [number, number, number];
  targetZone?: string;
  targetPosition?: [number, number, number];
  targetDimension?: DimensionMode;
  currentDimension?: DimensionMode;
  onWarp?: FarcasterWarpCallback;
  onDimensionWarp?: (result: DimensionalityWarpResult) => void;
  color?: number;
  operation?: string | null;
  semanticTarget?: PortalSemanticTarget;
  onSemanticWarp?: (target: PortalSemanticTarget) => void;
}

export class FarcasterPortal implements Updatable {
  group: THREE.Group;
  targetZone: string;
  targetPosition: [number, number, number];
  targetDimension: DimensionMode;
  currentDimension: DimensionMode;

  onWarp: FarcasterWarpCallback;
  onDimensionWarp: (result: DimensionalityWarpResult) => void;
  onSemanticWarp?: (target: PortalSemanticTarget) => void;
  semanticTarget: PortalSemanticTarget | null = null;
  previewInfo: PortalPreviewInfo | null = null;
  baseColor: THREE.Color;
  operation: string | null;

  _sharedRingMaterial: THREE.MeshBasicMaterial;
  ring: THREE.Mesh;
  _swirl: THREE.Group;
  _swirlMaterials: THREE.MeshBasicMaterial[];
  horizonMat: THREE.MeshBasicMaterial;
  horizon: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
  glow: THREE.Mesh;

  boundingSphere: THREE.Sphere;
  cooldown: boolean;
  worldPos: THREE.Vector3;
  activeMapCoordinate: MapCoordinate | null = null;

  private _dataActivity: number;
  private _pulseTime: number;
  private _previewActive: boolean;

  constructor({
    position = [-3, 1.6, -2],
    targetZone = 'DEEP_NET',
    targetPosition = [0, 1.6, -15],
    targetDimension = '3D_SPATIAL',
    currentDimension = '2D_TABULAR',
    onWarp = () => {},
    onDimensionWarp = () => {},
    color = 0xff00ff,
    operation = null,
    semanticTarget,
    onSemanticWarp,
  }: FarcasterPortalOptions = {}) {
    this.group = new THREE.Group();
    this.group.position.set(...position);
    this.targetZone = targetZone;
    this.targetPosition = targetPosition;
    this.targetDimension = targetDimension;
    this.currentDimension = currentDimension;
    this.onWarp = onWarp;
    this.onDimensionWarp = onDimensionWarp;
    this.onSemanticWarp = onSemanticWarp;
    this.semanticTarget = semanticTarget ?? null;
    this.baseColor = new THREE.Color(color);
    this.operation = operation;

    this._sharedRingMaterial = new THREE.MeshBasicMaterial({
      color: this.baseColor,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const ringGeo = new THREE.TorusGeometry(1.2, 0.12, 16, 64);
    this.ring = new THREE.Mesh(ringGeo, this._sharedRingMaterial);
    this.group.add(this.ring);

    this._swirl = new THREE.Group();
    this._swirlMaterials = [];
    for (let i = 0; i < 4; i++) {
      const swirlColor = this.baseColor.clone().lerp(new THREE.Color(0x00ffff), 0.25);
      const mat = new THREE.MeshBasicMaterial({
        color: swirlColor,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this._swirlMaterials.push(mat);
      const swirlRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.95 - i * 0.18, 0.025, 12, 48),
        mat
      );
      swirlRing.rotation.x = Math.PI / 2;
      this._swirl.add(swirlRing);
    }
    this.group.add(this._swirl);

    const horizonGeo = new THREE.CircleGeometry(1.1, 32);
    this.horizonMat = new THREE.MeshBasicMaterial({
      color: this.baseColor,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.horizon = new THREE.Mesh(horizonGeo, this.horizonMat);
    this.group.add(this.horizon);

    const glowGeo = new THREE.RingGeometry(1.35, 1.9, 64);
    this.glowMat = new THREE.MeshBasicMaterial({
      color: this.baseColor,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glow = new THREE.Mesh(glowGeo, this.glowMat);
    this.glow.position.z = -0.05;
    this.group.add(this.glow);

    this.boundingSphere = new THREE.Sphere();
    this.cooldown = false;
    this.worldPos = new THREE.Vector3();
    this._dataActivity = 0;
    this._pulseTime = 0;
    this._previewActive = false;
  }

  setColor(hex: number): void {
    this.baseColor.setHex(hex);
    this._sharedRingMaterial.color.copy(this.baseColor);
    this.horizonMat.color.copy(this.baseColor);
    this.glowMat.color.copy(this.baseColor);
    for (const mat of this._swirlMaterials) {
      mat.color.copy(this.baseColor).lerp(new THREE.Color(0x00ffff), 0.25);
    }
  }

  setDataActivity(value: number): void {
    this._dataActivity = Math.max(0, Math.min(1, value));
  }

  setOperation(operation: string | null): void {
    this.operation = operation;
  }

  setPreviewInfo(info: PortalPreviewInfo | null): void {
    this.previewInfo = info;
  }

  preview(active: boolean): void {
    this._previewActive = active;
  }

  /**
   * Set target spatial map coordinate for terrain travel.
   */
  setMapTarget(mapCoord: MapCoordinate): void {
    this.activeMapCoordinate = mapCoord;
    this.targetPosition = [mapCoord.x, mapCoord.y, mapCoord.z];
  }

  /**
   * Initiate Farcaster spatial terrain travel to selected map location.
   */
  initiateFarcasterTravel(mapCoord?: MapCoordinate): DimensionalityWarpResult {
    if (mapCoord) {
      this.setMapTarget(mapCoord);
    }

    const fromDimension = this.currentDimension;
    this.currentDimension = this.targetDimension;

    const targetPos = this.activeMapCoordinate
      ? new THREE.Vector3(this.activeMapCoordinate.x, this.activeMapCoordinate.y, this.activeMapCoordinate.z)
      : new THREE.Vector3(...this.targetPosition);

    const result: DimensionalityWarpResult = {
      fromDimension,
      toDimension: this.targetDimension,
      targetPosition: targetPos,
      targetCameraAngle: new THREE.Euler(0, 0, 0),
      operationApplied: this.operation,
      mapCoordinate: this.activeMapCoordinate || undefined,
    };

    // Trigger visual swirl burst effect
    this._dataActivity = 1.0;

    if (this.semanticTarget && this.onSemanticWarp) {
      this.onSemanticWarp(this.semanticTarget);
    } else {
      this.onDimensionWarp(result);
      this.onWarp(this.targetZone, [targetPos.x, targetPos.y, targetPos.z], this.operation);
    }
    return result;
  }

  /**
   * Warp analyst perspective between representation dimensions (2D ↔ 3D ↔ TDA).
   */
  warpDimension(toDimension: DimensionMode): DimensionalityWarpResult {
    const fromDimension = this.currentDimension;
    this.currentDimension = toDimension;

    const result: DimensionalityWarpResult = {
      fromDimension,
      toDimension,
      targetPosition: new THREE.Vector3(...this.targetPosition),
      targetCameraAngle: new THREE.Euler(0, 0, 0),
      operationApplied: this.operation,
      mapCoordinate: this.activeMapCoordinate || undefined,
    };

    this.onDimensionWarp(result);
    return result;
  }

  checkTrigger(headWorldPosition: THREE.Vector3): void {
    if (this.cooldown) return;
    this.group.getWorldPosition(this.worldPos);
    this.boundingSphere.set(this.worldPos, 1.0);
    if (this.boundingSphere.containsPoint(headWorldPosition)) {
      this.cooldown = true;
      this.initiateFarcasterTravel();
      setTimeout(() => (this.cooldown = false), 3000);
    }
  }

  update(delta: number, _time: number): void {
    this._pulseTime += delta * (1 + this._dataActivity * 2);
    this.ring.rotation.z += delta * (1.5 + this._dataActivity * 3);
    this.horizon.rotation.z -= delta * 0.4;

    const pulse = Math.sin(this._pulseTime * 6) * 0.5 + 0.5;
    const activityBoost = this._dataActivity * 0.35;
    const previewBoost = this._previewActive ? 0.35 : 0;

    this.horizonMat.opacity = 0.4 + pulse * 0.2 + activityBoost + previewBoost;
    this._sharedRingMaterial.opacity = Math.min(
      1,
      0.55 + pulse * 0.2 + activityBoost + previewBoost
    );
    this.glowMat.opacity = Math.min(
      0.9,
      0.15 + pulse * 0.15 + activityBoost * 0.5 + previewBoost * 0.8
    );

    const scale = 1 + pulse * 0.04 + this._dataActivity * 0.06;
    this.horizon.scale.setScalar(scale);
    this.glow.scale.setScalar(scale);

    this._swirl.children.forEach((ring, i) => {
      const mesh = ring as THREE.Mesh;
      mesh.rotation.z += delta * (i % 2 === 0 ? 1.2 : -1.0) * (1 + this._dataActivity * 2);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.25 + activityBoost + Math.sin(this._pulseTime * 5 + i) * 0.08;
    });

    // Decay swirl burst back to steady state
    if (this._dataActivity > 0) {
      this._dataActivity = Math.max(0, this._dataActivity - delta * 0.5);
    }
  }
}
