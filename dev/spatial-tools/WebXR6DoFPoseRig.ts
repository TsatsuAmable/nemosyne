/**
 * WebXR 6DoF Synthetic Posing & Headset Rig (Dev Tooling).
 *
 * Generates deterministic 6DoF head and hand tracking poses for testing VR layouts,
 * raycasting hit-testing, and spatial interaction logic without a physical headset.
 */

import * as THREE from 'three';

export interface HeadPose6DoF {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  forward: THREE.Vector3;
}

export interface HandPose6DoF {
  side: 'left' | 'right';
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  isPinching: boolean;
  pinchConfidence: number;
}

export class WebXR6DoFPoseRig {
  /**
   * Generates a 6DoF headset pose from coordinates and Euler angles (in degrees).
   */
  static createHeadPose(
    x = 0,
    y = 1.6, // Standard average standing eye height in meters
    z = 0,
    pitchDeg = 0,
    yawDeg = 0,
    rollDeg = 0
  ): HeadPose6DoF {
    const position = new THREE.Vector3(x, y, z);
    const euler = new THREE.Euler(
      (pitchDeg * Math.PI) / 180,
      (yawDeg * Math.PI) / 180,
      (rollDeg * Math.PI) / 180,
      'YXZ'
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);

    return { position, quaternion, forward };
  }

  /**
   * Generates a 6DoF hand pose with pinch state.
   */
  static createHandPose(
    side: 'left' | 'right',
    x: number,
    y: number,
    z: number,
    isPinching = false,
    pinchConfidence = 1.0
  ): HandPose6DoF {
    const position = new THREE.Vector3(x, y, z);
    const quaternion = new THREE.Quaternion(); // Identity or facing forward
    return { side, position, quaternion, isPinching, pinchConfidence };
  }

  // Pre-configured ergonomic testing presets
  static readonly PRESETS = {
    STANDING_NATURAL: () => ({
      head: WebXR6DoFPoseRig.createHeadPose(0, 1.6, 0, 0, 0, 0),
      rightHand: WebXR6DoFPoseRig.createHandPose('right', 0.25, 1.2, -0.6, false),
      leftHand: WebXR6DoFPoseRig.createHandPose('left', -0.25, 1.2, -0.6, false),
    }),
    SEATED_DESK: () => ({
      head: WebXR6DoFPoseRig.createHeadPose(0, 1.2, 0, -10, 0, 0),
      rightHand: WebXR6DoFPoseRig.createHandPose('right', 0.2, 0.9, -0.5, false),
      leftHand: WebXR6DoFPoseRig.createHandPose('left', -0.2, 0.9, -0.5, false),
    }),
    PINCH_INTERACTION: () => ({
      head: WebXR6DoFPoseRig.createHeadPose(0, 1.6, 0, 0, 0, 0),
      rightHand: WebXR6DoFPoseRig.createHandPose('right', 0.15, 1.3, -0.85, true, 0.98),
      leftHand: WebXR6DoFPoseRig.createHandPose('left', -0.3, 1.0, -0.4, false),
    }),
  };
}
