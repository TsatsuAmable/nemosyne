/**
 * Spatial Ergonomics & Legibility Linter (Dev Tooling).
 *
 * Evaluates 3D UI layouts and objects against physiological WebXR and Meta Quest 3 constraints:
 * 1. Depth Comfort Zone: 0.75m to 1.6m (vergence-accommodation conflict mitigation).
 * 2. Visual Angle & Field-of-View (FOV): Primary UI within ±15° vertical, ±30° horizontal gaze cone.
 * 3. Legibility & PPD (Pixels Per Degree): Text height must subtend >= 1.2° visual angle (~25 PPD on Quest 3).
 * 4. 3D Fitts' Law Target Sizing: Interactive hit targets must subtend >= 2.5° visual angle (~4.5cm at 1m).
 */

import * as THREE from 'three';

export interface SpatialErgoViolation {
  objectId?: string;
  name: string;
  category: 'depth' | 'fov' | 'legibility' | 'target_size';
  severity: 'warning' | 'error';
  message: string;
  actualValue: number;
  recommendedRange: [number, number];
}

export interface SpatialErgoReport {
  timestamp: number;
  totalObjectsChecked: number;
  passed: boolean;
  score: number; // 0 to 100
  violations: SpatialErgoViolation[];
}

export class SpatialErgonomicsLinter {
  // Quest 3 optical and physiological constants
  static readonly COMFORT_DEPTH_MIN_METERS = 0.75;
  static readonly COMFORT_DEPTH_MAX_METERS = 1.6;
  static readonly COMFORT_FOV_HORIZ_DEG = 30;
  static readonly COMFORT_FOV_VERT_DEG = 15;
  static readonly MIN_TEXT_VISUAL_ANGLE_DEG = 1.2;
  static readonly MIN_TARGET_VISUAL_ANGLE_DEG = 2.5;

  /**
   * Computes the visual angle (in degrees) subtended by an object of given size at a given distance.
   */
  static computeVisualAngleDeg(sizeMeters: number, distanceMeters: number): number {
    if (distanceMeters <= 0) return 180;
    return (2 * Math.atan(sizeMeters / (2 * distanceMeters)) * 180) / Math.PI;
  }

  /**
   * Evaluates a single 3D object from the perspective of the user's headset (camera).
   */
  static lintObject(
    headPosition: THREE.Vector3,
    headForward: THREE.Vector3,
    object: THREE.Object3D,
    options: { isText?: boolean; isInteractive?: boolean; targetSizeMeters?: number } = {}
  ): SpatialErgoViolation[] {
    const violations: SpatialErgoViolation[] = [];

    const objWorldPos = new THREE.Vector3();
    object.getWorldPosition(objWorldPos);

    const toObj = new THREE.Vector3().subVectors(objWorldPos, headPosition);
    const distance = toObj.length();

    // 1. Depth Comfort Zone
    if (distance < this.COMFORT_DEPTH_MIN_METERS) {
      violations.push({
        objectId: object.uuid,
        name: object.name || 'Unnamed Object',
        category: 'depth',
        severity: 'error',
        message: `Object is too close (${distance.toFixed(2)}m < ${this.COMFORT_DEPTH_MIN_METERS}m). Causes vergence-accommodation eye strain.`,
        actualValue: distance,
        recommendedRange: [this.COMFORT_DEPTH_MIN_METERS, this.COMFORT_DEPTH_MAX_METERS],
      });
    } else if (distance > this.COMFORT_DEPTH_MAX_METERS) {
      violations.push({
        objectId: object.uuid,
        name: object.name || 'Unnamed Object',
        category: 'depth',
        severity: 'warning',
        message: `Object is beyond comfort reach zone (${distance.toFixed(2)}m > ${this.COMFORT_DEPTH_MAX_METERS}m). May cause arm fatigue during direct interaction.`,
        actualValue: distance,
        recommendedRange: [this.COMFORT_DEPTH_MIN_METERS, this.COMFORT_DEPTH_MAX_METERS],
      });
    }

    // 2. Field-of-View Gaze Angle
    if (distance > 0.001) {
      const dirToObj = toObj.clone().normalize();
      const dot = headForward.dot(dirToObj);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
      const angleDeg = (angleRad * 180) / Math.PI;

      if (angleDeg > this.COMFORT_FOV_HORIZ_DEG) {
        violations.push({
          objectId: object.uuid,
          name: object.name || 'Unnamed Object',
          category: 'fov',
          severity: 'warning',
          message: `Object requires neck strain to view (${angleDeg.toFixed(1)}° from center gaze > ${this.COMFORT_FOV_HORIZ_DEG}° limit).`,
          actualValue: angleDeg,
          recommendedRange: [0, this.COMFORT_FOV_HORIZ_DEG],
        });
      }
    }

    // 3. Text Legibility & Visual Angle
    if (options.isText && options.targetSizeMeters) {
      const visualAngle = this.computeVisualAngleDeg(options.targetSizeMeters, distance);
      if (visualAngle < this.MIN_TEXT_VISUAL_ANGLE_DEG) {
        violations.push({
          objectId: object.uuid,
          name: object.name || 'Text Element',
          category: 'legibility',
          severity: 'error',
          message: `Text is illegible on Meta Quest 3 (${visualAngle.toFixed(2)}° visual angle < ${this.MIN_TEXT_VISUAL_ANGLE_DEG}° min). Increase font size or bring closer.`,
          actualValue: visualAngle,
          recommendedRange: [this.MIN_TEXT_VISUAL_ANGLE_DEG, 10],
        });
      }
    }

    // 4. Interactive Target Sizing (Fitts' Law)
    if (options.isInteractive && options.targetSizeMeters) {
      const visualAngle = this.computeVisualAngleDeg(options.targetSizeMeters, distance);
      if (visualAngle < this.MIN_TARGET_VISUAL_ANGLE_DEG) {
        violations.push({
          objectId: object.uuid,
          name: object.name || 'Button/Target',
          category: 'target_size',
          severity: 'warning',
          message: `Interactive target is too small for accurate raycast/finger pinch (${visualAngle.toFixed(2)}° < ${this.MIN_TARGET_VISUAL_ANGLE_DEG}° min).`,
          actualValue: visualAngle,
          recommendedRange: [this.MIN_TARGET_VISUAL_ANGLE_DEG, 20],
        });
      }
    }

    return violations;
  }

  /**
   * Performs an ergonomic audit of an entire VR UI scene graph.
   */
  static lintScene(
    camera: THREE.Camera,
    targets: Array<{ object: THREE.Object3D; isText?: boolean; isInteractive?: boolean; sizeMeters?: number }>
  ): SpatialErgoReport {
    const headPos = new THREE.Vector3();
    camera.getWorldPosition(headPos);

    const headForward = new THREE.Vector3();
    camera.getWorldDirection(headForward);

    const allViolations: SpatialErgoViolation[] = [];

    for (const item of targets) {
      const v = this.lintObject(headPos, headForward, item.object, {
        isText: item.isText,
        isInteractive: item.isInteractive,
        targetSizeMeters: item.sizeMeters,
      });
      allViolations.push(...v);
    }

    const errorCount = allViolations.filter((v) => v.severity === 'error').length;
    const warningCount = allViolations.filter((v) => v.severity === 'warning').length;
    const penalty = errorCount * 25 + warningCount * 10;
    const score = Math.max(0, 100 - penalty);

    return {
      timestamp: Date.now(),
      totalObjectsChecked: targets.length,
      passed: errorCount === 0,
      score,
      violations: allViolations,
    };
  }
}
