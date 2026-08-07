/**
 * Visual spatial feedback effects for WebXR hand and controller gestures.
 *
 * Emits transient glowing rings, emissive halos, and wave planes in world-space
 * when gestures (pinch, scoop, slice, push) trigger dataset operations.
 */

import * as THREE from 'three';

export interface GestureFeedbackOptions {
  color?: THREE.ColorRepresentation;
  duration?: number;
  scale?: number;
}

const DEFAULT_DURATION = 750;

/**
 * Animate opacity fade and scale expansion for transient spatial meshes.
 */
function animateGestureMesh(
  mesh: THREE.Mesh,
  material: THREE.Material & { opacity: number },
  scene: THREE.Scene | THREE.Group,
  duration = DEFAULT_DURATION,
  onComplete?: () => void
): void {
  const start = performance.now();
  const initialScale = mesh.scale.x;

  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(1, elapsed / duration);
    const easeOut = 1 - Math.pow(1 - t, 3);

    const s = initialScale + easeOut * 1.5;
    mesh.scale.set(s, s, s);
    material.opacity = Math.max(0, 0.9 * (1 - easeOut));

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      scene.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
      if (onComplete) onComplete();
    }
  };

  requestAnimationFrame(tick);
}

/**
 * PINCH FILTER HALO: Expanding cyan ring around the hand/pointer position.
 */
export function spawnPinchFilterHalo(
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3,
  options: GestureFeedbackOptions = {}
): THREE.Mesh {
  const { color = 0x00d4aa, duration = 650, scale = 0.3 } = options;

  const geo = new THREE.RingGeometry(0.08, 0.12, 32);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.scale.set(scale, scale, scale);
  mesh.rotation.x = Math.PI / 2;

  scene.add(mesh);
  animateGestureMesh(mesh, mat, scene, duration);
  return mesh;
}

/**
 * SCOOP LENS RING: Gold emissive halo emitted when opening the statistical lens.
 */
export function spawnScoopLensHalo(
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3,
  options: GestureFeedbackOptions = {}
): THREE.Mesh {
  const { color = 0xd4af37, duration = 900, scale = 0.4 } = options;

  const geo = new THREE.RingGeometry(0.1, 0.18, 36);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.scale.set(scale, scale, scale);

  scene.add(mesh);
  animateGestureMesh(mesh, mat, scene, duration);
  return mesh;
}

/**
 * SLICE WAVE TRAIL: Translucent vertical plane sweep during time-slice or sort.
 */
export function spawnSliceWavePlane(
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3,
  direction: 'down' | 'up' = 'down',
  options: GestureFeedbackOptions = {}
): THREE.Mesh {
  const { color = 0x00aaff, duration = 700, scale = 1.0 } = options;

  const geo = new THREE.PlaneGeometry(1.2, 0.05);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.scale.set(scale, scale, scale);

  scene.add(mesh);

  const start = performance.now();
  const startY = position.y;
  const dy = direction === 'down' ? -0.6 : 0.6;

  const tick = () => {
    const elapsed = performance.now() - start;
    const t = Math.min(1, elapsed / duration);
    mesh.position.y = startY + t * dy;
    mat.opacity = Math.max(0, 0.85 * (1 - t));

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    }
  };

  requestAnimationFrame(tick);
  return mesh;
}

/**
 * RESET PULSE WAVE: Outward blue-white spherical pulse when resetting data operations.
 */
export function spawnResetPulseSphere(
  scene: THREE.Scene | THREE.Group,
  position: THREE.Vector3,
  options: GestureFeedbackOptions = {}
): THREE.Mesh {
  const { color = 0x88ccff, duration = 800 } = options;

  const geo = new THREE.SphereGeometry(0.15, 16, 16);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    wireframe: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  scene.add(mesh);

  animateGestureMesh(mesh, mat, scene, duration);
  return mesh;
}
