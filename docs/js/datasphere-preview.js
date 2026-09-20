import * as THREE from './vendor/three.module.min.js';

const canvas = document.querySelector('#datasphere-preview-canvas');
if (!canvas) throw new Error('Datasphere preview canvas not found');

const COLORS = {
  void: 0x05070b,
  surfaceBorder: 0x263544,
  textSecondary: 0xa9b8c6,
  focus: 0x59d6ff,
  commit: 0x8ce6c1,
  uncertain: 0xffc46b,
  contradiction: 0xff7aae,
  verified: 0x71d99b,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.void);
scene.fog = new THREE.FogExp2(COLORS.void, 0.035);

const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);
camera.position.set(0, 3.2, 13.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

scene.add(new THREE.AmbientLight(0x0a192f, 1.2));
const keyLight = new THREE.PointLight(COLORS.focus, 2.5, 40);
keyLight.position.set(0, 6, 2);
scene.add(keyLight);

const world = new THREE.Group();
scene.add(world);

const grid = new THREE.GridHelper(36, 36, COLORS.surfaceBorder, COLORS.void);
grid.position.y = -4.2;
grid.material.transparent = true;
grid.material.opacity = 0.28;
world.add(grid);

const core = new THREE.Group();
core.position.set(0, 0, -1.5);
world.add(core);

const coreGlow = new THREE.Mesh(
  new THREE.SphereGeometry(1.05, 28, 28),
  new THREE.MeshBasicMaterial({
    color: COLORS.focus,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
core.add(coreGlow);

const coreShell = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 24, 24),
  new THREE.MeshBasicMaterial({
    color: COLORS.focus,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
core.add(coreShell);

const ringGeometry = new THREE.TorusGeometry(2.2, 0.04, 16, 100);
const makeRing = () => new THREE.Mesh(
  ringGeometry,
  new THREE.MeshBasicMaterial({
    color: COLORS.commit,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
const ring1 = makeRing();
ring1.rotation.x = Math.PI / 2;
const ring2 = makeRing();
ring2.rotation.set(Math.PI / 3, Math.PI / 4, 0);
core.add(ring1, ring2);

const artefactSpecs = [
  { position: [5, 2, -5], scale: 1.15, color: COLORS.commit },
  { position: [-4, 3, -3], scale: 1.0, color: COLORS.focus },
  { position: [3, -2, -6], scale: 0.9, color: COLORS.contradiction },
  { position: [-5, -1, -4], scale: 1.05, color: COLORS.verified },
  { position: [0, 4, -8], scale: 1.35, color: COLORS.uncertain },
];

const artefacts = [];
const raycastTargets = [];

function makeArtefact({ position, scale, color }, index) {
  const group = new THREE.Group();
  group.position.set(...position);

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.72 * scale, 1),
    new THREE.MeshStandardMaterial({
      color,
      wireframe: true,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.88,
    })
  );
  shell.userData = { baseEmissive: 0.3, index, role: 'datasphere-artefact' };

  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(0.26 * scale, 16, 16),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  const markerGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  for (let i = 0; i < 2; i += 1) {
    const marker = new THREE.Mesh(
      markerGeometry,
      new THREE.MeshBasicMaterial({ color: COLORS.textSecondary })
    );
    marker.position.set((1.15 + i * 0.32) * scale, 0, 0);
    const orbit = new THREE.Group();
    orbit.rotation.set(i * 1.3, i * 0.8, i * 0.4);
    orbit.add(marker);
    group.add(orbit);
    group.userData.orbits ??= [];
    group.userData.orbits.push(orbit);
  }

  group.add(shell, inner);
  world.add(group);
  artefacts.push({ group, shell, inner, phase: index * 0.9 });
  raycastTargets.push(shell);
}

artefactSpecs.forEach(makeArtefact);

const links = [
  [core.position, artefacts[0].group.position],
  [core.position, artefacts[1].group.position],
  [core.position, artefacts[2].group.position],
  [artefacts[0].group.position, artefacts[4].group.position],
  [artefacts[1].group.position, artefacts[3].group.position],
];

const packets = [];
for (const [start, end] of links) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
  const material = new THREE.LineBasicMaterial({
    color: COLORS.focus,
    transparent: true,
    opacity: 0.28,
  });
  world.add(new THREE.Line(geometry, material));

  for (let i = 0; i < 2; i += 1) {
    const packet = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 10),
      new THREE.MeshBasicMaterial({
        color: COLORS.textSecondary,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.9,
      })
    );
    packet.userData = {
      start: start.clone(),
      end: end.clone(),
      offset: i * 0.5,
    };
    world.add(packet);
    packets.push(packet);
  }
}

const ambientMarkers = [];
for (let i = 0; i < 8; i += 1) {
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.55, 8),
    new THREE.MeshBasicMaterial({
      color: COLORS.focus,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
    })
  );
  const angle = (i / 8) * Math.PI * 2;
  marker.position.set(Math.cos(angle) * (7 + (i % 2)), ((i % 4) - 1.5) * 1.7, -5 - (i % 3) * 1.8);
  marker.rotation.z = angle;
  world.add(marker);
  ambientMarkers.push(marker);
}

const pointer = new THREE.Vector2(2, 2);
const raycaster = new THREE.Raycaster();
let hovered = null;
let dragging = false;
let lastX = 0;
let lastY = 0;
let yaw = 0;
let pitch = 0;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  setPointer(event);
  if (!dragging) return;
  yaw += (event.clientX - lastX) * 0.005;
  pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastY) * 0.003, -0.32, 0.32);
  lastX = event.clientX;
  lastY = event.clientY;
});

canvas.addEventListener('pointerup', (event) => {
  dragging = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointerleave', () => {
  dragging = false;
  pointer.set(2, 2);
});

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(canvas.parentElement);
resize();

const clock = new THREE.Clock();

function animate() {
  const elapsed = clock.getElapsedTime();
  const reduced = prefersReducedMotion.matches;

  world.rotation.y += (yaw - world.rotation.y) * 0.08;
  world.rotation.x += (pitch - world.rotation.x) * 0.08;

  if (!reduced && !dragging) {
    yaw += 0.0008;
    coreShell.rotation.y += 0.0025;
    ring1.rotation.z += 0.004;
    ring2.rotation.x += 0.003;
  }

  artefacts.forEach(({ group, shell, inner, phase }, index) => {
    if (!reduced) {
      shell.rotation.x += 0.002 + index * 0.00015;
      shell.rotation.y += 0.003 + index * 0.00012;
      const pulse = 1 + Math.sin(elapsed * 1.6 + phase) * 0.055;
      shell.scale.setScalar(pulse);
      inner.scale.setScalar(1 + Math.sin(elapsed * 2.2 + phase) * 0.08);
      group.userData.orbits?.forEach((orbit, orbitIndex) => {
        orbit.rotation.y += 0.008 + orbitIndex * 0.004;
      });
    }
  });

  packets.forEach((packet, index) => {
    const t = reduced
      ? packet.userData.offset
      : (elapsed * (0.14 + (index % 2) * 0.025) + packet.userData.offset) % 1;
    packet.position.lerpVectors(packet.userData.start, packet.userData.end, t);
  });

  ambientMarkers.forEach((marker, index) => {
    if (!reduced) marker.rotation.y += 0.0015 + index * 0.0002;
  });

  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(raycastTargets, false)[0]?.object ?? null;
  if (hit !== hovered) {
    if (hovered) hovered.material.emissiveIntensity = hovered.userData.baseEmissive;
    hovered = hit;
    if (hovered) hovered.material.emissiveIntensity = 1.8;
    canvas.classList.toggle('is-hovering', Boolean(hovered));
  }

  camera.lookAt(0, 0, -2.6);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
