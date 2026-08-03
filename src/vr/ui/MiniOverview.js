import * as THREE from 'three';

/**
 * A small analyst-anchored "mini-map" that shows a top-down overview of the
 * data palace and the user's current view frustum. It helps users stay
 * oriented inside large or occluded 3D visualizations.
 *
 * The panel is rendered to a canvas texture and updated each frame. Data nodes
 * are drawn as dots in the X/Z plane, and the camera is drawn as a position
 * marker plus a forward cone that represents the horizontal field of view.
 */
export class MiniOverview {
  constructor(cameraGroup, options = {}) {
    this.title = options.title ?? 'Overview';
    this.cameraGroup = cameraGroup;
    this.getNodeMeshes = options.getNodeMeshes ?? (() => []);
    this.getCamera = options.getCamera ?? (() => null);
    this.size = options.size ?? 0.55;
    this.resolution = options.resolution ?? 512;
    this.position = new THREE.Vector3(...(options.position ?? [0.85, 1.35, -0.7]));
    this.followAnchor = options.followAnchor ?? cameraGroup;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.resolution;
    this.canvas.height = this.resolution;
    this.ctx = this.canvas.getContext('2d') || this._createMockContext();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const geom = new THREE.PlaneGeometry(this.size, this.size);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.x = -(options.tilt ?? 0.25);
    if (this.followAnchor) this.followAnchor.add(this.mesh);

    this._nodePos = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._bounds = new THREE.Box2();
    this._tempV2 = new THREE.Vector2();
  }

  setEnabled(enabled) {
    this.mesh.visible = enabled;
  }

  update() {
    if (!this.mesh.visible) return;
    const nodeMeshes = this.getNodeMeshes();
    const camera = this.getCamera();
    if (!camera) return;

    this._recomputeBounds(nodeMeshes, camera);
    this._draw(nodeMeshes, camera);
    this.texture.needsUpdate = true;
  }

  _recomputeBounds(nodeMeshes, camera) {
    this._bounds.makeEmpty();
    for (const mesh of nodeMeshes) {
      if (!mesh) continue;
      mesh.getWorldPosition(this._nodePos);
      this._bounds.expandByPoint(new THREE.Vector2(this._nodePos.x, this._nodePos.z));
    }
    // Include the camera so the user marker is always on screen.
    camera.getWorldPosition(this._camPos);
    this._bounds.expandByPoint(new THREE.Vector2(this._camPos.x, this._camPos.z));

    // Add padding and a minimum world size so a single node or empty scene
    // does not collapse to a point.
    const minSize = 6;
    const center = this._bounds.getCenter(this._tempV2);
    const size = Math.max(
      this._bounds.max.x - this._bounds.min.x,
      this._bounds.max.y - this._bounds.min.y,
      minSize
    );
    const half = size / 2 + 1;
    this._bounds.min.set(center.x - half, center.y - half);
    this._bounds.max.set(center.x + half, center.y + half);
  }

  _worldToCanvas(x, z) {
    const width = this._bounds.max.x - this._bounds.min.x;
    const height = this._bounds.max.y - this._bounds.min.y;
    const u = (x - this._bounds.min.x) / width;
    const v = (z - this._bounds.min.y) / height;
    return {
      x: u * this.resolution,
      y: (1 - v) * this.resolution,
    };
  }

  _draw(nodeMeshes, camera) {
    const ctx = this.ctx;
    const r = this.resolution;

    // Background.
    ctx.fillStyle = 'rgba(4, 12, 24, 0.92)';
    ctx.fillRect(0, 0, r, r);

    // Border.
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, r - 4, r - 4);

    // Title.
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(r * 0.06)}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('OVERVIEW', r * 0.05, r * 0.04);

    // Compass labels.
    ctx.font = `${Math.floor(r * 0.05)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#88ffcc';
    ctx.fillText('N', r / 2, r * 0.08);
    ctx.fillText('S', r / 2, r * 0.92);
    ctx.fillText('E', r * 0.92, r / 2);
    ctx.fillText('W', r * 0.08, r / 2);

    // Draw data nodes as dots.
    for (const mesh of nodeMeshes) {
      if (!mesh) continue;
      mesh.getWorldPosition(this._nodePos);
      const p = this._worldToCanvas(this._nodePos.x, this._nodePos.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, r * 0.01), 0, Math.PI * 2);
      ctx.fillStyle = '#00ccff';
      ctx.fill();
    }

    // Draw camera position and frustum cone.
    camera.getWorldPosition(this._camPos);
    camera.getWorldDirection(this._camDir);
    const cp = this._worldToCanvas(this._camPos.x, this._camPos.z);

    // Forward cone: approximate horizontal FOV of 60°.
    const fovHalf = Math.PI / 6;
    const coneLen = Math.max(r * 0.12, 20);
    const forwardAngle = Math.atan2(this._camDir.z, this._camDir.x);
    const leftAngle = forwardAngle - fovHalf;
    const rightAngle = forwardAngle + fovHalf;

    ctx.beginPath();
    ctx.moveTo(cp.x, cp.y);
    ctx.lineTo(cp.x + Math.cos(leftAngle) * coneLen, cp.y - Math.sin(leftAngle) * coneLen);
    ctx.arc(cp.x, cp.y, coneLen, -leftAngle, -rightAngle, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 204, 0, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Camera marker.
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, r * 0.02, 0, Math.PI * 2);
    ctx.fillStyle = '#ffcc00';
    ctx.fill();
  }

  _createMockContext() {
    const noOp = () => {};
    return {
      fillRect: noOp,
      strokeRect: noOp,
      fillText: noOp,
      arc: noOp,
      moveTo: noOp,
      lineTo: noOp,
      closePath: noOp,
      beginPath: noOp,
      stroke: noOp,
      fill: noOp,
      measureText: () => ({ width: 0 }),
      set fillStyle(_) {},
      set strokeStyle(_) {},
      set lineWidth(_) {},
      set font(_) {},
      set textAlign(_) {},
      set textBaseline(_) {},
    };
  }
}
