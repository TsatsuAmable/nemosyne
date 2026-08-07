import * as THREE from 'three';
import { MovablePanel } from '../vr/ui/MovablePanel.ts';
import { DracoTopologyNode } from './DracoTopologyNode.ts';

interface DiagnosticButton {
  ruleName: string;
  action: 'INC' | 'DEC';
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Floating VR diagnostic panel for live-tuning Draco soft-constraint weights.
 * Rendered with CanvasTexture; hit-test via controller/hand raycaster.
 *
 * Inherits from MovablePanel so it can be dragged by the title bar, minimized,
 * and recalled with a system gesture.
 */
export class DracoDiagnosticHUD extends MovablePanel {
  dracoNode: DracoTopologyNode;
  buttons: DiagnosticButton[];
  private _clickCooldownMs: number;
  private _lastClickAt: number;

  constructor(
    cameraGroup: THREE.Group,
    dracoNode: DracoTopologyNode,
    position: [number, number, number] = [-0.8, 1.5, -1.2]
  ) {
    super(cameraGroup, {
      title: 'DRACO CONSTRAINT DIAGNOSTIC',
      width: 1100,
      height: 800,
      position,
      worldSize: [1.3, 0.95],
      titleBarHeight: 50,
      contentPadding: 20,
    });

    this.dracoNode = dracoNode;
    this.buttons = [];
    this._registerButtons();

    this._clickCooldownMs = 350;
    this._lastClickAt = -this._clickCooldownMs;

    this.render();
  }

  _registerButtons(): void {
    const constraints = this.dracoNode.engine.softConstraints;
    this.buttons = [];
    const pad = 24;
    constraints.forEach((sc, idx) => {
      const y = 120 + pad + idx * 70;
      this.buttons.push({ ruleName: sc.name, action: 'DEC', x: 710, y: y - 4, w: 46, h: 34 });
      this.buttons.push({ ruleName: sc.name, action: 'INC', x: 890, y: y - 4, w: 46, h: 34 });
    });
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const h = contentH;
    const result = this.dracoNode.solverResult;

    const pad = 24;

    ctx.fillStyle = 'rgba(0, 60, 80, 0.7)';
    ctx.fillRect(20, 20 + pad, w - 40, 70);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffaa00';
    if (result?.spec) {
      ctx.fillText(`LAYOUT: [ ${result.spec.layout} ]`, 40, 50 + pad);
      ctx.fillText(`GEOM: [ ${result.spec.geometry} ]`, 420, 50 + pad);
      ctx.fillText(`BEHAV: [ ${result.spec.behavior} ]`, 750, 50 + pad);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`COST: ${(result?.cost ?? 0).toFixed(1)}  |  LOWER IS BETTER`, 40, 80 + pad);

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#88ccff';
    ctx.fillText('CONSTRAINT', 20, 115 + pad);
    ctx.fillText('WEIGHT', 560, 115 + pad);
    ctx.fillText('', 710, 115 + pad);
    ctx.fillText('', 890, 115 + pad);

    const constraints = this.dracoNode.engine.softConstraints;
    const rowH = 70;
    constraints.forEach((sc, idx) => {
      const y = 140 + pad + idx * rowH;
      const nameMaxWidth = 345;

      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.textAlign = 'left';
      const nameText = `${idx + 1}. ${sc.name.toUpperCase()}`;
      ctx.fillText(nameText, 20, y + 20, nameMaxWidth);

      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2;
      ctx.strokeRect(380, y, 300, 26);
      ctx.fillStyle = 'rgba(0, 255, 204, 0.15)';
      ctx.fillRect(382, y + 2, 296, 22);
      ctx.fillStyle = '#00ffcc';
      const barWidth = Math.min(292, (sc.weight / 50) * 292);
      ctx.fillRect(382, y + 2, barWidth, 22);

      ctx.fillStyle = '#ff0055';
      ctx.fillRect(710, y - 4, 46, 34);
      ctx.fillStyle = '#00cc66';
      ctx.fillRect(890, y - 4, 46, 34);

      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('−', 733, y + 21);
      ctx.fillText('+', 913, y + 21);

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#ffdd00';
      ctx.fillText(`${sc.weight}`, 823, y + 21);

      ctx.strokeStyle = 'rgba(0, 255, 204, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, y + 46);
      ctx.lineTo(w - 20, y + 46);
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(0, 255, 204, 0.03)';
    for (let yL = 0; yL < h; yL += 6) {
      ctx.fillRect(0, yL, w, 3);
    }
  }

  /**
   * Handle a pointer click inside the content area. Returns true if a button
   * was hit.
   */
  handleContentClick(raycaster: THREE.Raycaster): boolean {
    const hits = raycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;
    const uv = hits[0].uv;
    if (!uv) return false;
    const canvasX = uv.x * this.width;
    const canvasY = (1 - uv.y) * this.height;

    for (const btn of this.buttons) {
      if (
        canvasX >= btn.x &&
        canvasX <= btn.x + btn.w &&
        canvasY >= btn.y &&
        canvasY <= btn.y + btn.h
      ) {
        const now = performance.now();
        if (now - this._lastClickAt < this._clickCooldownMs) {
          return true;
        }
        this._lastClickAt = now;

        const delta = btn.action === 'INC' ? 5 : -5;
        this.dracoNode.adjustWeight(btn.ruleName, delta);
        this.render();
        return true;
      }
    }
    return false;
  }
}
