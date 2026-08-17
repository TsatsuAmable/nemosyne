/**
 * WorldSpatialContext.ts
 *
 * Provides world-aware spatial context, landmark proximity, ergonomic reach-zone
 * classification, and gesture troubleshooting diagnostics for UX telemetry.
 */

import * as THREE from 'three';

export type SpatialZone =
  | 'CENTRAL_PLAZA'
  | 'TECHNOCORE_SECTOR'
  | 'FARCASTER_GATEWAY'
  | 'ICE_VAULT_SECTOR'
  | 'ANALYTICAL_GALLERY'
  | 'OUTER_HORIZON';

export type ReachZone = 'SWEET_SPOT' | 'NEAR_FIELD' | 'EXTENDED' | 'PERIPHERAL';

export type GestureElevation = 'OVERHEAD' | 'EYE_LEVEL' | 'CHEST_LEVEL' | 'WAIST_BELOW';

export type GestureTroubleshootingReason =
  | 'AIM_DRIFT_EXCESSIVE'
  | 'OUT_OF_REACH_ZONE'
  | 'NEAR_FIELD_TRACKING_JITTER'
  | 'PERIPHERAL_CAMERA_BLINDSPOT'
  | 'RAPID_SWIPE_VELOCITY'
  | 'OCCLUSION_BY_PANEL'
  | 'NONE';

export interface LandmarkInfo {
  name: string;
  distance: number;
  bearingDeg: number;
  elevationDeg: number;
  position: [number, number, number];
}

export interface HandErgonomicProfile {
  handedness: string;
  reachZone: ReachZone;
  elevation: GestureElevation;
  distanceToHead: number;
  azimuthDeg: number;
  elevationDeg: number;
  ergonomicScore: number; // 0 - 100
  troubleshootingFlag: GestureTroubleshootingReason;
}

export interface WorldSpatialSnapshot {
  zone: SpatialZone;
  nearestLandmark: LandmarkInfo | null;
  landmarks: LandmarkInfo[];
  ergonomics: Record<string, HandErgonomicProfile>;
}

export interface WorldLandmarkTarget {
  name: string;
  position: THREE.Vector3 | [number, number, number];
  radius?: number;
}

const DEFAULT_LANDMARKS: WorldLandmarkTarget[] = [
  { name: 'TechnoCore', position: [6, 4, -8], radius: 3.5 },
  { name: 'FarcasterPortal', position: [-3, 1.6, -2], radius: 2.5 },
  { name: 'IceVault', position: [0, 1.5, -3], radius: 2.0 },
  { name: 'CentralPlaza', position: [0, 1.5, 0], radius: 3.0 },
];

function round(val: number, dec = 2): number {
  const f = 10 ** dec;
  return Math.round(val * f) / f;
}

export class WorldSpatialContext {
  private _landmarks: WorldLandmarkTarget[];
  private _tempVec = new THREE.Vector3();
  private _tempHeadPos = new THREE.Vector3();
  private _tempHeadDir = new THREE.Vector3();

  constructor(customLandmarks?: WorldLandmarkTarget[]) {
    this._landmarks = customLandmarks ?? DEFAULT_LANDMARKS;
  }

  setLandmarks(landmarks: WorldLandmarkTarget[]): void {
    this._landmarks = landmarks;
  }

  addLandmark(landmark: WorldLandmarkTarget): void {
    this._landmarks.push(landmark);
  }

  /**
   * Determine the spatial palace zone for a given head position.
   */
  classifyZone(headPos: THREE.Vector3): SpatialZone {
    const distToCenter = Math.hypot(headPos.x, headPos.z);
    if (distToCenter > 12) return 'OUTER_HORIZON';

    let closestZone: SpatialZone = 'CENTRAL_PLAZA';
    let minDistance = distToCenter;

    for (const lm of this._landmarks) {
      const lmPos = Array.isArray(lm.position)
        ? this._tempVec.set(lm.position[0], lm.position[1], lm.position[2])
        : lm.position;
      const d = headPos.distanceTo(lmPos);
      if (d < (lm.radius ?? 3.0) && d < minDistance) {
        minDistance = d;
        if (lm.name.includes('TechnoCore')) closestZone = 'TECHNOCORE_SECTOR';
        else if (lm.name.includes('Farcaster')) closestZone = 'FARCASTER_GATEWAY';
        else if (lm.name.includes('IceVault')) closestZone = 'ICE_VAULT_SECTOR';
        else if (lm.name.includes('Chart') || lm.name.includes('Plane')) closestZone = 'ANALYTICAL_GALLERY';
      }
    }

    return closestZone;
  }

  /**
   * Calculate distance, bearing, and elevation from head to a landmark.
   */
  computeLandmarkMetrics(
    headPos: THREE.Vector3,
    headDir: THREE.Vector3,
    landmark: WorldLandmarkTarget
  ): LandmarkInfo {
    const lmPos = Array.isArray(landmark.position)
      ? new THREE.Vector3(landmark.position[0], landmark.position[1], landmark.position[2])
      : landmark.position.clone();

    const toLandmark = lmPos.clone().sub(headPos);
    const distance = round(toLandmark.length());

    // Bearing relative to head look direction in horizontal plane
    const flatLook = new THREE.Vector2(headDir.x, headDir.z).normalize();
    const flatToLm = new THREE.Vector2(toLandmark.x, toLandmark.z).normalize();
    let bearingDeg = 0;
    if (flatLook.lengthSq() > 0 && flatToLm.lengthSq() > 0) {
      const dot = THREE.MathUtils.clamp(flatLook.dot(flatToLm), -1, 1);
      const cross = flatLook.x * flatToLm.y - flatLook.y * flatToLm.x;
      bearingDeg = round((Math.atan2(cross, dot) * 180) / Math.PI, 1);
    }

    // Elevation angle
    const horizDist = Math.hypot(toLandmark.x, toLandmark.z);
    const elevationDeg = round((Math.atan2(toLandmark.y, Math.max(0.01, horizDist)) * 180) / Math.PI, 1);

    return {
      name: landmark.name,
      distance,
      bearingDeg,
      elevationDeg,
      position: [round(lmPos.x), round(lmPos.y), round(lmPos.z)],
    };
  }

  /**
   * Analyze biomechanical ergonomics of hand position relative to the user's head.
   */
  evaluateHandErgonomics(
    headPos: THREE.Vector3,
    headDir: THREE.Vector3,
    handPos: THREE.Vector3,
    handedness = 'unknown',
    aimDriftDeg: number | null = null
  ): HandErgonomicProfile {
    const relPos = handPos.clone().sub(headPos);
    const distance = round(relPos.length(), 3);
    const deltaY = round(relPos.y, 3);

    // Azimuth angle relative to head look direction
    const flatLook = new THREE.Vector2(headDir.x, headDir.z).normalize();
    const flatHand = new THREE.Vector2(relPos.x, relPos.z).normalize();
    let azimuthDeg = 0;
    if (flatLook.lengthSq() > 0 && flatHand.lengthSq() > 0) {
      const dot = THREE.MathUtils.clamp(flatLook.dot(flatHand), -1, 1);
      const cross = flatLook.x * flatHand.y - flatLook.y * flatHand.x;
      azimuthDeg = round((Math.atan2(cross, dot) * 180) / Math.PI, 1);
    }

    // Elevation angle
    const horizDist = Math.hypot(relPos.x, relPos.z);
    const elevationDeg = round((Math.atan2(deltaY, Math.max(0.01, horizDist)) * 180) / Math.PI, 1);

    // Elevation classification
    let elevation: GestureElevation = 'CHEST_LEVEL';
    if (deltaY > 0.2) elevation = 'OVERHEAD';
    else if (deltaY >= -0.15) elevation = 'EYE_LEVEL';
    else if (deltaY >= -0.45) elevation = 'CHEST_LEVEL';
    else elevation = 'WAIST_BELOW';

    // Reach Zone classification
    const absAzimuth = Math.abs(azimuthDeg);
    let reachZone: ReachZone = 'SWEET_SPOT';
    if (distance < 0.22) {
      reachZone = 'NEAR_FIELD';
    } else if (distance > 0.95 || absAzimuth > 65) {
      reachZone = 'PERIPHERAL';
    } else if (distance > 0.65 || absAzimuth > 45) {
      reachZone = 'EXTENDED';
    } else {
      reachZone = 'SWEET_SPOT';
    }

    // Calculate Ergonomic Health Score (0 - 100)
    let score = 100;
    // Distance penalty (optimal is 0.35m - 0.55m)
    if (distance < 0.25) score -= (0.25 - distance) * 200;
    else if (distance > 0.55) score -= Math.min(50, (distance - 0.55) * 120);

    // Azimuth penalty (optimal is forward +-25 deg)
    if (absAzimuth > 25) score -= Math.min(35, (absAzimuth - 25) * 0.8);

    // Elevation penalty (overhead or waist below increases strain)
    if (elevation === 'OVERHEAD') score -= 30;
    else if (elevation === 'WAIST_BELOW') score -= 20;

    const ergonomicScore = Math.max(0, Math.min(100, Math.round(score)));

    // Troubleshooting diagnostic reason
    let troubleshootingFlag: GestureTroubleshootingReason = 'NONE';
    if (reachZone === 'NEAR_FIELD') {
      troubleshootingFlag = 'NEAR_FIELD_TRACKING_JITTER';
    } else if (reachZone === 'PERIPHERAL') {
      troubleshootingFlag = 'PERIPHERAL_CAMERA_BLINDSPOT';
    } else if (aimDriftDeg !== null && aimDriftDeg > 28) {
      troubleshootingFlag = 'AIM_DRIFT_EXCESSIVE';
    } else if (reachZone === 'EXTENDED') {
      troubleshootingFlag = 'OUT_OF_REACH_ZONE';
    }

    return {
      handedness,
      reachZone,
      elevation,
      distanceToHead: distance,
      azimuthDeg,
      elevationDeg,
      ergonomicScore,
      troubleshootingFlag,
    };
  }

  /**
   * Build a complete world spatial telemetry snapshot.
   */
  buildSnapshot(
    camera?: THREE.Camera,
    headPosOverride?: THREE.Vector3,
    handPositions?: Array<{ pos: THREE.Vector3; handedness: string }>,
    aimDriftDeg: number | null = null
  ): WorldSpatialSnapshot {
    const headPos = headPosOverride ?? (camera ? camera.getWorldPosition(this._tempHeadPos) : new THREE.Vector3(0, 1.6, 0));
    const headDir = camera ? camera.getWorldDirection(this._tempHeadDir) : new THREE.Vector3(0, 0, -1);

    const zone = this.classifyZone(headPos);

    const landmarkList: LandmarkInfo[] = this._landmarks.map((lm) =>
      this.computeLandmarkMetrics(headPos, headDir, lm)
    );

    landmarkList.sort((a, b) => a.distance - b.distance);
    const nearestLandmark = landmarkList.length > 0 ? landmarkList[0] : null;

    const ergonomics: Record<string, HandErgonomicProfile> = {};
    if (handPositions) {
      for (const h of handPositions) {
        ergonomics[h.handedness] = this.evaluateHandErgonomics(
          headPos,
          headDir,
          h.pos,
          h.handedness,
          aimDriftDeg
        );
      }
    }

    return {
      zone,
      nearestLandmark,
      landmarks: landmarkList,
      ergonomics,
    };
  }
}
