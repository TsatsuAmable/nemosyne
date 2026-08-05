/**
 * Phase 7 interaction metaphors for VR data artefacts.
 *
 * Each function is a transient, spatial effect tied to a selected data item.
 * They are intentionally lightweight: they add ephemeral meshes to the artefact
 * group, animate them for a short duration, then dispose. This keeps the
 * interaction vocabulary symbolic while still giving the user strong feedback.
 */

import * as THREE from 'three';

interface FadableMaterial {
  opacity: number;
}

interface ResonancePulseOptions {
  color?: THREE.ColorRepresentation;
  speed?: number;
  duration?: number;
}

interface ForkPlaneOptions {
  color?: THREE.ColorRepresentation;
  size?: number;
  duration?: number;
}

interface ChronoDialOptions {
  color?: THREE.ColorRepresentation;
  radius?: number;
  duration?: number;
}

interface ConstellationOptions {
  color?: THREE.ColorRepresentation;
  duration?: number;
}

interface BeaconOptions {
  color?: THREE.ColorRepresentation;
  height?: number;
  duration?: number;
}

interface AlephOptions {
  color?: THREE.ColorRepresentation;
  duration?: number;
}

const DEFAULT_DURATION = 900;

function _animateOpacity(
  material: FadableMaterial,
  duration = DEFAULT_DURATION,
  onDone: (() => void) | null = null
) {
  const start = performance.now();
  const tick = () => {
    const t = Math.min(1, (performance.now() - start) / duration);
    material.opacity = 0.9 * (1 - t);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else if (onDone) {
      onDone();
    }
  };
  requestAnimationFrame(tick);
}

/**
 * RESONANCE_PULSE: an expanding ring that travels from the selected node to
 * its connected neighbors, making graph relationships audible/visible.
 */
export function applyResonancePulse(
  group: THREE.Group,
  mesh: THREE.Object3D,
  neighbors: THREE.Object3D[] = [],
  { color = 0x00ffcc, speed = 3.5, duration = DEFAULT_DURATION }: ResonancePulseOptions = {}
) {
  void speed;
  const origin = mesh.position.clone();
  const targets = neighbors.length > 0 ? neighbors : [];

  for (const target of targets) {
    const dir = new THREE.Vector3().subVectors(target.position, origin);
    const dist = dir.length();
    if (dist <= 0.01) continue;
    dir.normalize();

    const ringGeo = new THREE.RingGeometry(0.02, 0.04, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(origin);
    ring.lookAt(target.position);
    group.add(ring);

    const start = performance.now();
    const animate = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      ring.position.copy(origin).add(dir.clone().multiplyScalar(t * dist));
      ring.scale.setScalar(1 + t * 2);
      ringMat.opacity = 0.9 * (1 - t);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        group.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    requestAnimationFrame(animate);
  }
}

/**
 * FORK_PLANE: a translucent vertical or horizontal plane that bisects the
 * artefact, highlighting the half-space containing the selected item.
 */
export function applyForkPlane(
  group: THREE.Group,
  mesh: THREE.Object3D,
  { color = 0xff00cc, size = 2.5, duration = DEFAULT_DURATION }: ForkPlaneOptions = {}
) {
  const planeGeo = new THREE.PlaneGeometry(size, size);
  const planeMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.position.copy(mesh.position);
  // Face the viewer: the plane normal points toward the user.
  plane.lookAt(plane.position.clone().add(new THREE.Vector3(0, 0, 1)));
  group.add(plane);

  _animateOpacity(planeMat, duration, () => {
    group.remove(plane);
    planeGeo.dispose();
    planeMat.dispose();
  });
}

/**
 * CHRONO_DIAL: a circular dial around the selected time-series point that
 * opens like a clock face, emphasising the temporal neighbourhood.
 */
export function applyChronoDial(
  group: THREE.Group,
  mesh: THREE.Object3D,
  { color = 0x00ccff, radius = 0.5, duration = DEFAULT_DURATION }: ChronoDialOptions = {}
) {
  const ringGeo = new THREE.RingGeometry(radius * 0.6, radius, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(mesh.position);
  ring.lookAt(ring.position.clone().add(new THREE.Vector3(0, 1, 0)));
  group.add(ring);

  const start = performance.now();
  const animate = () => {
    const t = Math.min(1, (performance.now() - start) / duration);
    ring.rotation.z += 0.05;
    ring.scale.setScalar(1 + t * 0.5);
    ringMat.opacity = 0.7 * (1 - t);
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      group.remove(ring);
      ringGeo.dispose();
      ringMat.dispose();
    }
  };
  requestAnimationFrame(animate);
}

/**
 * CONSTELLATION: draws ephemeral lines from the selected node to a set of
 * related nodes, making similarity or adjacency visible for a moment.
 */
export function applyConstellation(
  group: THREE.Group,
  mesh: THREE.Object3D,
  related: THREE.Object3D[] = [],
  { color = 0xffcc00, duration = DEFAULT_DURATION }: ConstellationOptions = {}
) {
  if (related.length === 0) return;

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const lines: { line: THREE.Line; geo: THREE.BufferGeometry }[] = [];

  for (const other of related) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      mesh.position.clone(),
      other.position.clone(),
    ]);
    const line = new THREE.Line(geo, material);
    group.add(line);
    lines.push({ line, geo });
  }

  _animateOpacity(material, duration, () => {
    for (const { line, geo } of lines) {
      group.remove(line);
      geo.dispose();
    }
    material.dispose();
  });
}

/**
 * BEACON: a vertical column of light rising from the selected point, useful
 * for locating items in dense geo or tabular spaces.
 */
export function applyBeacon(
  group: THREE.Group,
  mesh: THREE.Object3D,
  { color = 0x00ffcc, height = 2.5, duration = DEFAULT_DURATION }: BeaconOptions = {}
) {
  const geo = new THREE.CylinderGeometry(0.02, 0.08, height, 16, 1, true);
  geo.translate(0, height / 2, 0);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.position.copy(mesh.position);
  group.add(beam);

  _animateOpacity(mat, duration, () => {
    group.remove(beam);
    geo.dispose();
    mat.dispose();
  });
}

/**
 * ALEPH: a brief "all-connections" flash from the selected node to every other
 * visible node, giving a sense of the local neighbourhood at a glance.
 */
export function applyAleph(
  group: THREE.Group,
  mesh: THREE.Object3D,
  others: THREE.Object3D[] = [],
  { color = 0xffffff, duration = DEFAULT_DURATION }: AlephOptions = {}
) {
  if (others.length === 0) return;

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const lines: { line: THREE.Line; geo: THREE.BufferGeometry }[] = [];

  for (const other of others) {
    if (other === mesh) continue;
    const geo = new THREE.BufferGeometry().setFromPoints([
      mesh.position.clone(),
      other.position.clone(),
    ]);
    const line = new THREE.Line(geo, material);
    group.add(line);
    lines.push({ line, geo });
  }

  _animateOpacity(material, duration, () => {
    for (const { line, geo } of lines) {
      group.remove(line);
      geo.dispose();
    }
    material.dispose();
  });
}
