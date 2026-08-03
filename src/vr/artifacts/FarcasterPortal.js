import * as THREE from 'three';

/**
 * A functional data-transformation gate.
 *
 * Each Farcaster portal is not just a teleporter but a data-operation gate.
 * Passing through it applies a registered analysis operation (e.g., anomaly
 * detection, reset) to the dataset and warps the user to a themed zone. A
 * preview state lets the portal bright-flash while the user hovers near it,
 * signalling that it is active.
 */
export class FarcasterPortal {
  constructor({
    position = [-3, 1.6, -2],
    targetZone = 'DEEP_NET',
    targetPosition = [0, 1.6, -15],
    onWarp = () => {},
    color = 0xff00ff,
    operation = null,
  } = {}) {
    this.group = new THREE.Group();
    this.group.position.set(...position);
    this.targetZone = targetZone;
    this.targetPosition = targetPosition;
    this.onWarp = onWarp;
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

    // Inner vortex swirl built from a slightly smaller ring stack.
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

    // Outer glow halo behind the ring for stronger additive bloom.
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
  }

  setColor(hex) {
    this.baseColor.setHex(hex);
    this._sharedRingMaterial.color.copy(this.baseColor);
    this.horizonMat.color.copy(this.baseColor);
    this.glowMat.color.copy(this.baseColor);
    for (const mat of this._swirlMaterials) {
      mat.color.copy(this.baseColor).lerp(new THREE.Color(0x00ffff), 0.25);
    }
  }

  setDataActivity(value) {
    this._dataActivity = Math.max(0, Math.min(1, value));
  }

  setOperation(operation) {
    this.operation = operation;
  }

  preview(active) {
    this._previewActive = active;
  }

  checkTrigger(headWorldPosition) {
    if (this.cooldown) return;
    this.group.getWorldPosition(this.worldPos);
    this.boundingSphere.set(this.worldPos, 1.0);
    if (this.boundingSphere.containsPoint(headWorldPosition)) {
      this.cooldown = true;
      this.onWarp(this.targetZone, this.targetPosition, this.operation);
      setTimeout(() => (this.cooldown = false), 3000);
    }
  }

  update(delta, time) {
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

    // Rotate vortex swirl rings alternately for depth illusion.
    this._swirl.children.forEach((ring, i) => {
      ring.rotation.z += delta * (i % 2 === 0 ? 1.2 : -1.0) * (1 + this._dataActivity * 2);
      ring.material.opacity = 0.25 + activityBoost + Math.sin(this._pulseTime * 5 + i) * 0.08;
    });
  }
}
