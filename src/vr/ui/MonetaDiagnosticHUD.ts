import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { MonetaTopologyNode } from '../../moneta/MonetaTopologyNode.ts';

interface DiagnosticButton {
  ruleName: string;
  action: 'INC' | 'DEC';
  x: number;
  y: number;
  w: number;
  h: number;
}

export class MonetaDiagnosticHUD extends MovablePanel {
  monetaNode: MonetaTopologyNode;
  buttons: DiagnosticButton[];
  candidateHistory: Array<{ layout: string; geometry: string; cost: number; timestamp: number }>;
  private _clickCooldownMs: number;
  private _lastClickAt: number;
  private _lastCost: number | null = null;
  private _costDelta: number = 0;

  constructor(
    cameraGroup: THREE.Group,
    monetaNode: MonetaTopologyNode,
    position: [number, number, number] = [-0.8, 1.5, -1.2]
  ) {
    super(cameraGroup, {
      title: 'MONETA CONSTRAINT DIAGNOSTIC',
      width: 1100,
      height: 640,
      position,
      worldSize: [1.3, 0.72],
      titleBarHeight: 50,
      contentPadding: 20,
    });

    this.monetaNode = monetaNode;
    this.buttons = [];
    this.candidateHistory = [];
    this._registerButtons();

    this._clickCooldownMs = 350;
    this._lastClickAt = -this._clickCooldownMs;

    this.render();
    // P1-UV1: normal product builds do not surface solver internals. The
    // deliberately instrumented diagnostics build remains the explicit route,
    // including after representation replacement creates a fresh HUD instance.
    if (import.meta.env.VITE_NEMOSYNE_DIAGNOSTICS !== '1') {
      this.hide();
    }
  }

  get dracoNode(): MonetaTopologyNode {
    return this.monetaNode;
  }

  _registerButtons(): void {
    const constraints = this.monetaNode.engine.softConstraints;
    this.buttons = [];
    const pad = 24;
    constraints.forEach((sc, idx) => {
      const y = 140 + pad + idx * 70;
      this.buttons.push({ ruleName: sc.name, action: 'DEC', x: 710, y: y - 4, w: 46, h: 34 });
      this.buttons.push({ ruleName: sc.name, action: 'INC', x: 890, y: y - 4, w: 46, h: 34 });
    });
    this.totalContentHeight = 160 + pad + constraints.length * 70 + 120;
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const result = this.monetaNode.solverResult;
    const pad = 24;

    if (result?.spec) {
      const currentCost = result.cost;
      if (this._lastCost !== null && this._lastCost !== currentCost) {
        this._costDelta = currentCost - this._lastCost;
        this.candidateHistory.unshift({
          layout: result.spec.layout,
          geometry: result.spec.geometry,
          cost: currentCost,
          timestamp: Date.now(),
        });
        if (this.candidateHistory.length > 5) this.candidateHistory.pop();
      }
      this._lastCost = currentCost;
    }

    const constraints = this.monetaNode.engine.softConstraints;
    this.totalContentHeight = 160 + pad + constraints.length * 70 + 120;

    ctx.fillStyle = 'rgba(0, 60, 80, 0.7)';
    ctx.fillRect(20, 20 + pad, w - 40, 85);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffaa00';
    if (result?.spec) {
      ctx.fillText(`LAYOUT: [ ${result.spec.layout} ]`, 40, 50 + pad);
      ctx.fillText(`GEOM: [ ${result.spec.geometry} ]`, 420, 50 + pad);
      ctx.fillText(`BEHAV: [ ${result.spec.behavior} ]`, 750, 50 + pad);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`COST: ${(result?.cost ?? 0).toFixed(1)}  |  LOWER IS BETTER`, 40, 85 + pad);

    if (this._costDelta !== 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = this._costDelta < 0 ? '#00ff66' : '#ff3300';
      ctx.fillText(`DELTA: ${this._costDelta > 0 ? '+' : ''}${this._costDelta.toFixed(1)}`, 540, 85 + pad);
    }

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#88ccff';
    ctx.fillText('CONSTRAINT', 20, 130 + pad);
    ctx.fillText('WEIGHT', 560, 130 + pad);

    const rowH = 70;
    constraints.forEach((sc, idx) => {
      const y = 155 + pad + idx * rowH;
      const nameMaxWidth = 345;

      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.textAlign = 'left';
      const nameText = `${idx + 1}. ${sc.name.toUpperCase()}`;
      ctx.fillText(nameText, 20, y + 20, nameMaxWidth);

      let penalty = 0;
      if (result?.spec && result?.facts) {
        penalty = sc.eval(result.facts, result.spec);
      }

      ctx.strokeStyle = penalty > 0 ? '#ff3366' : '#00ffcc';
      ctx.lineWidth = 2;
      ctx.strokeRect(380, y, 300, 26);
      ctx.fillStyle = penalty > 0 ? 'rgba(255, 51, 102, 0.2)' : 'rgba(0, 255, 204, 0.15)';
      ctx.fillRect(382, y + 2, 296, 22);
      ctx.fillStyle = penalty > 0 ? '#ff3366' : '#00ffcc';
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
    for (let yL = 0; yL < Math.max(contentH, this.totalContentHeight); yL += 6) {
      ctx.fillRect(0, yL, w, 3);
    }
  }

  handleContentClick(raycaster: THREE.Raycaster): boolean {
    const hits = raycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;
    const uv = hits[0].uv;
    if (!uv) return false;
    const canvasX = uv.x * this.width;
    const canvasY = (1 - uv.y) * this.height;

    const contentY = canvasY - (this.titleBarHeight + 4) + this.scrollOffset;

    for (const btn of this.buttons) {
      const hitY = (contentY >= btn.y && contentY <= btn.y + btn.h) || (canvasY >= btn.y && canvasY <= btn.y + btn.h);
      if (
        canvasX >= btn.x &&
        canvasX <= btn.x + btn.w &&
        hitY
      ) {
        const now = performance.now();
        if (now - this._lastClickAt < this._clickCooldownMs) {
          return true;
        }
        this._lastClickAt = now;

        const delta = btn.action === 'INC' ? 5 : -5;
        this.monetaNode.adjustWeight(btn.ruleName, delta);
        this.render();
        return true;
      }
    }
    return false;
  }
}

export { MonetaDiagnosticHUD as DracoDiagnosticHUD };
