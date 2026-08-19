/**
 * MarkMomentAction — spatial evidence capture workflow in VR.
 *
 * Captures observer perspective, dataset state, highlighted nodes, and analytical
 * context into a first-class Observation on the authoritative EvidenceLedger.
 */

import * as THREE from 'three';
import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { Observation } from '../../atlas/types.ts';
import type { WorldFeedbackLike } from '../coordinators/types.ts';

export interface MarkMomentContext {
  atlas: AtlasCore;
  camera: THREE.Camera;
  scene: THREE.Scene;
  feedback?: WorldFeedbackLike | null;
  targetIds?: string[];
  rowIndices?: number[];
  notes?: string;
  tags?: string[];
  onLogged?: (message: string) => void;
}

export class MarkMomentAction {
  /**
   * Execute a Mark Moment evidence capture.
   */
  static execute(context: MarkMomentContext): Observation {
    const { atlas, camera, scene, feedback, targetIds, rowIndices, notes, tags, onLogged } = context;

    const pos = camera.position;
    const quat = camera.quaternion;

    const observation = atlas.recordObservation({
      notes: notes ?? `Marked moment at ${new Date().toLocaleTimeString()}`,
      spatialContext: {
        position: [pos.x, pos.y, pos.z],
        rotation: [quat.x, quat.y, quat.z, quat.w],
      },
      targetIds: targetIds ?? [],
      rowIndices: rowIndices ?? [],
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      datasetVersion: atlas.datasetVersion ?? 0,
      tags: tags ?? ['vr-mark-moment'],
    });

    // Provide immediate multi-modal feedback
    feedback?.playHaptic?.(0.7, 80);

    // Spawn ephemeral spatial beacon at observation viewpoint
    MarkMomentAction._spawnVisualBeacon(scene, pos, quat);

    const logMsg = `[Mark Moment] Recorded observation ${observation.id} (v${observation.datasetVersion})`;
    onLogged?.(logMsg);

    return observation;
  }

  private static _spawnVisualBeacon(scene: THREE.Scene, position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    const group = new THREE.Group();
    group.position.copy(position);
    group.quaternion.copy(quaternion);

    // Ring reticle in front of camera
    const ringGeo = new THREE.RingGeometry(0.08, 0.09, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, 0, -0.6);
    group.add(ringMesh);

    scene.add(group);

    // Animate expand and fade over 900ms
    const startTime = performance.now();
    const duration = 900;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      ringMesh.scale.setScalar(1 + progress * 0.8);
      ringMat.opacity = 0.85 * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        scene.remove(group);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };

    requestAnimationFrame(animate);
  }
}
