/**
 * Just-In-Time (JIT) Diegetic Gesture Hint Manager.
 *
 * Spawns context-sensitive 3D ghost hand hints and floating labels when an analyst
 * hovers near interactive data clusters, dataset boundaries, or Farcaster portals.
 */

import * as THREE from 'three';

export interface JITHintOptions {
  enabled?: boolean;
  hintDurationMs?: number;
}

export class JITGestureHintManager {
  enabled: boolean;
  hintDurationMs: number;
  activeHintGroup: THREE.Group | null;
  scene: THREE.Scene | null;

  private _lastHintTime: Map<string, number>;

  constructor({ enabled = true, hintDurationMs = 4000 }: JITHintOptions = {}) {
    this.enabled = enabled;
    this.hintDurationMs = hintDurationMs;
    this.activeHintGroup = null;
    this.scene = null;
    this._lastHintTime = new Map();
  }

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /**
   * Display a context-sensitive 3D ghost hand gesture hint.
   */
  showHint(gestureName: string, targetPosition: THREE.Vector3, labelText: string): void {
    if (!this.enabled || !this.scene) return;

    const now = performance.now();
    if (this._lastHintTime.has(gestureName)) {
      const last = this._lastHintTime.get(gestureName)!;
      if (now - last < this.hintDurationMs) return; // Prevent spamming same hint
    }
    this._lastHintTime.set(gestureName, now);

    this.clearHint();

    const group = new THREE.Group();
    group.position.copy(targetPosition).add(new THREE.Vector3(0, 0.25, 0));

    // Ghost Hand Wireframe Mesh
    const ghostGeom = new THREE.SphereGeometry(0.04, 12, 12);
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const ghostMesh = new THREE.Mesh(ghostGeom, ghostMat);
    group.add(ghostMesh);

    // Floating Diegetic Label Sprite
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext ? canvas.getContext('2d') : null;
      if (ctx) {
        ctx.fillStyle = 'rgba(10, 20, 30, 0.85)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 252, 60);
        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.9 });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.35, 0.09, 1.0);
        sprite.position.set(0, 0.08, 0);
        group.add(sprite);
      }
    }

    this.scene.add(group);
    this.activeHintGroup = group;

    // Animate subtle bobbing pulse
    const startTime = performance.now();
    const animate = () => {
      if (!this.activeHintGroup || this.activeHintGroup !== group) return;
      const elapsed = performance.now() - startTime;
      if (elapsed > this.hintDurationMs) {
        this.clearHint();
        return;
      }
      const t = elapsed / 1000.0;
      ghostMesh.position.y = Math.sin(t * 4.0) * 0.02;
      ghostMesh.rotation.y += 0.02;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  clearHint(): void {
    if (this.activeHintGroup && this.scene) {
      this.scene.remove(this.activeHintGroup);
      this.activeHintGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        } else if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });
      this.activeHintGroup = null;
    }
  }

  dispose(): void {
    this.clearHint();
    this._lastHintTime.clear();
  }
}
