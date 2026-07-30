import * as THREE from 'three';
import { LODManager } from '../scalability/LODManager.js';

/**
 * Pooled, world-space gaze tooltips and pointer-hit labels for VR elements.
 *
 * Shows a compact label when the user looks at a registered element for more
 * than a short dwell time, or immediately when a pointer ray intersects it.
 * Tooltips are anchored near the target, billboard toward the camera, and
 * fade in/out to reduce visual clutter.
 */
export class TooltipManager {
  constructor(camera, options = {}) {
    this.camera = camera;
    this.lod = new LODManager(camera);

    this.poolSize = options.poolSize ?? 8;
    this.dwellMs = options.dwellMs ?? 400;
    this.maxDistance = options.maxDistance ?? 6;
    this.gazeConeDegrees = options.gazeConeDegrees ?? 12;
    this.offsetY = options.offsetY ?? 0.35;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = this.maxDistance;
    this.pool = [];
    this.targets = [];
    this._buildPool();

    this._headPos = new THREE.Vector3();
    this._gazeDir = new THREE.Vector3();
    this._tmpPos = new THREE.Vector3();
    this._pointerHitPos = new THREE.Vector3();

    // Optional external raycaster used to show an immediate label at the
    // current pointer intersection (controller or hand laser).
    this.pointerRaycaster = null;
    this._lastPointerHit = null;
    this._pointerHitTooltip = {
      ...this._createTooltip(),
      active: false,
      fade: 0,
    };
    this._pointerHitTooltip.mesh.name = 'pointer-hit-tooltip';
  }

  _buildPool() {
    for (let i = 0; i < this.poolSize; i++) {
      const tooltip = this._createTooltip();
      this.pool.push({
        ...tooltip,
        active: false,
        targetMesh: null,
        dwell: 0,
        fade: 0,
      });
    }
  }

  _createTooltip() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d') || this._createMockContext();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.175), material);
    mesh.visible = false;
    mesh.name = 'gaze-tooltip';
    return { mesh, ctx, canvas, texture };
  }

  /**
   * Register any mesh (or group) as a tooltip target. The `meta` object can
   * contain { title, body, priority }. If omitted, `userData` on the mesh is
   * used as a fallback.
   * @param {THREE.Object3D} mesh
   * @param {{ title?: string, body?: string, priority?: number }} meta
   */
  registerTarget(mesh, meta = null) {
    if (!mesh) return;
    if (mesh.userData.tooltipMeta === undefined) {
      mesh.userData.tooltipMeta = meta || this._inferMetaFromUserData(mesh.userData);
    } else if (meta) {
      Object.assign(mesh.userData.tooltipMeta, meta);
    }
    if (!this.targets.includes(mesh)) {
      this.targets.push(mesh);
    }
    if (mesh.userData._tooltipDwell === undefined) {
      mesh.userData._tooltipDwell = 0;
    }
  }

  /**
   * Bulk register targets, replacing the previous list. This preserves the
   * legacy `setTargets` API while supporting the new metadata registration.
   * @param {THREE.Object3D[]} meshes
   */
  setTargets(meshes = []) {
    // Reset dwell on any previously tracked meshes.
    for (const entry of this.pool) {
      if (entry.targetMesh) {
        entry.targetMesh.userData._tooltipDwell = 0;
      }
    }
    this.targets = [];
    for (const mesh of meshes) {
      this.registerTarget(mesh);
    }
  }

  /**
   * Mount the tooltip meshes into the scene so they render in world space.
   */
  mount(scene) {
    for (const { mesh } of this.pool) {
      scene.add(mesh);
    }
    if (this._pointerHitTooltip) scene.add(this._pointerHitTooltip.mesh);
  }

  /**
   * Provide a raycaster that is updated each frame by the input system. When
   * its ray intersects a registered target, an immediate one-line label is shown
   * at the hit point.
   */
  setPointerRaycaster(raycaster) {
    this.pointerRaycaster = raycaster;
  }

  /**
   * Update gaze detection, dwell timers, tooltip fade states, and the
   * immediate pointer-hit label.
   */
  update(delta) {
    if (!this.camera) {
      for (const entry of this.pool) this._fadeOut(entry, delta);
      this._fadePointerHit(delta, false);
      return;
    }

    this.lod.update();
    this.camera.getWorldPosition(this._headPos);
    this.camera.getWorldDirection(this._gazeDir);

    // Pointer-hit label is shown immediately when the active pointer ray hits a
    // registered target, even without gaze dwell.
    this._updatePointerHit(delta);

    if (this.targets.length === 0) {
      for (const entry of this.pool) this._fadeOut(entry, delta);
      return;
    }

    // Find the single best gaze target using a narrow cone + raycast fallback.
    const gazed = this._findGazedTarget();

    // Tick dwell on the gazed target; decay dwell on all others.
    for (const mesh of this.targets) {
      if (mesh === gazed) {
        mesh.userData._tooltipDwell += delta * 1000;
      } else {
        mesh.userData._tooltipDwell = Math.max(0, mesh.userData._tooltipDwell - delta * 1000);
      }
    }

    // Release tooltips whose target is no longer gazed or no longer close.
    for (const entry of this.pool) {
      if (!entry.active) continue;
      const stillValid =
        entry.targetMesh &&
        entry.targetMesh.visible &&
        (entry.targetMesh.userData._tooltipDwell > 0 || this.lod.shouldShowLabel(this._worldPos(entry.targetMesh)));
      if (!stillValid) {
        this._release(entry);
      }
    }

    // Claim tooltips for targets that have dwelled enough or are close enough.
    if (gazed) {
      const worldPos = this._worldPos(gazed);
      const closeEnough = this.lod.shouldShowLabel(worldPos);
      const dwelled = gazed.userData._tooltipDwell >= this.dwellMs;
      if (closeEnough || dwelled) {
        const existing = this.pool.find((e) => e.targetMesh === gazed);
        if (!existing) {
          const free = this.pool.find((e) => !e.active);
          if (free) this._claim(free, gazed);
        }
      }
    }

    // Animate positions and fades.
    for (const entry of this.pool) {
      if (entry.active) {
        const pos = this._worldPos(entry.targetMesh);
        pos.y += this.offsetY;
        entry.mesh.position.lerp(pos, Math.min(1, 12 * delta));
        entry.mesh.lookAt(this._headPos);
        this._fadeIn(entry, delta);
      } else {
        this._fadeOut(entry, delta);
      }
    }
  }

  _updatePointerHit(delta) {
    const hit = this._findPointerHit();
    if (hit && hit.object) {
      this._lastPointerHit = hit;
      const meta = hit.object.userData.tooltipMeta || this._inferMetaFromUserData(hit.object.userData);
      if (meta && (meta.title || meta.body)) {
        this._pointerHitTooltip.mesh.visible = true;
        this._pointerHitPos.copy(hit.point);
        this._pointerHitTooltip.mesh.position.lerp(this._pointerHitPos, Math.min(1, 16 * delta));
        this._pointerHitTooltip.mesh.lookAt(this._headPos);
        this._renderPointerHitTooltip(meta);
        this._fadePointerHit(delta, true);
        return;
      }
    }
    this._fadePointerHit(delta, false);
  }

  _findPointerHit() {
    if (!this.pointerRaycaster) return null;
    const hits = this.pointerRaycaster.intersectObjects(this.targets, false);
    if (hits.length > 0) return hits[0];
    return null;
  }

  _renderPointerHitTooltip(meta) {
    const ctx = this._pointerHitTooltip.ctx;
    const canvas = this._pointerHitTooltip.canvas;
    const texture = this._pointerHitTooltip.texture;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(4, 12, 24, 0.88)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    const title = String(meta.title ?? '').slice(0, 24);
    const body = String(meta.body ?? '').slice(0, 40);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.textAlign = 'left';
    ctx.fillText(title, 16, 38);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(body, 16, 68);

    texture.needsUpdate = true;
  }

  _fadePointerHit(delta, active) {
    const entry = this._pointerHitTooltip;
    if (active) {
      entry.fade = Math.min(1, entry.fade + delta * 10);
      entry.mesh.material.opacity = entry.fade * 0.92;
    } else {
      entry.fade = Math.max(0, entry.fade - delta * 12);
      entry.mesh.material.opacity = entry.fade * 0.92;
      if (entry.fade <= 0.001) entry.mesh.visible = false;
    }
  }

  _findGazedTarget() {
    // Narrow cone test first: cheap and robust for gaze selection.
    let best = null;
    let bestDot = Math.cos((this.gazeConeDegrees * Math.PI) / 180);
    for (const mesh of this.targets) {
      if (!mesh.visible) continue;
      const pos = this._worldPos(mesh);
      const toTarget = this._tmpPos.subVectors(pos, this._headPos).normalize();
      const dot = toTarget.dot(this._gazeDir);
      if (dot > bestDot) {
        bestDot = dot;
        best = mesh;
      }
    }

    if (best) return best;

    // Fallback raycast when cone misses but a node is directly in front.
    this.raycaster.set(this._headPos, this._gazeDir);
    const hits = this.raycaster.intersectObjects(this.targets, false);
    return hits.length > 0 ? hits[0].object : null;
  }

  _worldPos(mesh) {
    return mesh.getWorldPosition(this._tmpPos);
  }

  _claim(entry, mesh) {
    entry.active = true;
    entry.targetMesh = mesh;
    entry.dwell = mesh.userData._tooltipDwell;
    entry.fade = 0;
    entry.mesh.visible = true;
    this._renderTooltip(entry, mesh);
  }

  _release(entry) {
    entry.active = false;
    entry.targetMesh = null;
    entry.dwell = 0;
  }

  _renderTooltip(entry, mesh) {
    const meta = mesh.userData.tooltipMeta || this._inferMetaFromUserData(mesh.userData);
    const ctx = entry.ctx;
    const canvas = entry.canvas;
    const texture = entry.texture;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(4, 12, 24, 0.88)';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    const title = String(meta.title ?? mesh.name ?? 'NODE').slice(0, 22);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.textAlign = 'left';
    ctx.fillText(`// ${title}`, 16, 36);

    ctx.font = '18px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(meta.body ?? '').slice(0, 40), 16, 68);

    // Footer hint.
    ctx.fillStyle = 'rgba(0, 255, 204, 0.6)';
    ctx.font = '12px monospace';
    ctx.fillText('look/pinch to inspect', 16, 100);

    texture.needsUpdate = true;
  }

  _inferMetaFromUserData(userData) {
    const row = userData?.row ?? {};
    const title = row.category ?? row.type ?? userData?.label ?? userData?.name ?? null;
    const numericKeys = Object.keys(row).filter((k) => typeof row[k] === 'number' && !k.startsWith('_'));
    const valueKey = numericKeys[0] ?? Object.keys(row).find((k) => k !== 'category' && k !== 'type');
    const value = valueKey !== undefined ? row[valueKey] : undefined;
    let body = '';
    if (value !== undefined) {
      body = `${valueKey}: ${Number(value).toFixed ? Number(value).toFixed(2) : value}`;
    } else if (userData?.description) {
      body = String(userData.description);
    }
    return { title, body };
  }

  _fadeIn(entry, delta) {
    entry.fade = Math.min(1, entry.fade + delta * 6);
    entry.mesh.material.opacity = entry.fade * 0.92;
  }

  _fadeOut(entry, delta) {
    entry.fade = Math.max(0, entry.fade - delta * 8);
    entry.mesh.material.opacity = entry.fade * 0.92;
    if (entry.fade <= 0.001) {
      entry.mesh.visible = false;
    }
  }

  /**
   * Clear all registered targets and hide every tooltip.
   */
  clear() {
    for (const entry of this.pool) this._release(entry);
    this.targets = [];
    this._lastPointerHit = null;
    if (this._pointerHitTooltip) {
      this._pointerHitTooltip.fade = 0;
      this._pointerHitTooltip.mesh.visible = false;
    }
  }

  dispose() {
    this.clear();
    for (const entry of this.pool) {
      entry.mesh.geometry.dispose();
      entry.mesh.material.map?.dispose();
      entry.mesh.material.dispose();
    }
    if (this._pointerHitTooltip) {
      this._pointerHitTooltip.mesh.geometry.dispose();
      this._pointerHitTooltip.mesh.material.map?.dispose();
      this._pointerHitTooltip.mesh.material.dispose();
    }
  }

  _createMockContext() {
    const noOp = () => {};
    return {
      clearRect: noOp,
      fillRect: noOp,
      strokeRect: noOp,
      fillText: noOp,
      measureText: () => ({ width: 0 }),
      set fillStyle(_) {},
      set strokeStyle(_) {},
      set lineWidth(_) {},
      set font(_) {},
      set textAlign(_) {},
    };
  }
}
