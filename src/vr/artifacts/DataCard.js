import * as THREE from 'three';

/**
 * A world-space canvas panel that displays the actual field values of a data record.
 */
export class DataCard {
  constructor(camera) {
    this.camera = camera;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 384;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const geometry = new THREE.PlaneGeometry(1.2, 0.9);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.visible = false;

    this.target = new THREE.Vector3();
    this.offset = new THREE.Vector3(0, 0.8, 0);
    this.active = false;
    this.cameraPos = new THREE.Vector3();
  }

  mount(scene) {
    scene.add(this.mesh);
  }

  show(position, data, title = 'DATA NODE') {
    this.target.copy(position).add(this.offset);
    this.mesh.position.copy(this.target);
    this.mesh.visible = true;
    this.active = true;
    this.render(data, title);
  }

  hide() {
    this.mesh.visible = false;
    this.active = false;
  }

  update(delta, time) {
    if (!this.active || !this.camera) return;
    this.camera.getWorldPosition(this.cameraPos);
    this.mesh.lookAt(this.cameraPos);
  }

  render(data, title) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(4, 10, 20, 0.92)';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 8;
    ctx.fillText(`// ${title}`, 30, 55);
    ctx.shadowBlur = 0;

    ctx.font = '20px monospace';
    ctx.fillStyle = '#88ccff';
    let y = 100;
    for (const [key, value] of Object.entries(data ?? {})) {
      const text = `${key}: ${value}`;
      ctx.fillText(text, 30, y);
      y += 34;
      if (y > h - 30) break;
    }

    ctx.fillStyle = 'rgba(0, 255, 204, 0.03)';
    for (let yL = 0; yL < h; yL += 6) {
      ctx.fillRect(0, yL, w, 3);
    }

    this.texture.needsUpdate = true;
  }
}
