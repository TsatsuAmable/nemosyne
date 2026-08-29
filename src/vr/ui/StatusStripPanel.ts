import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import type { MovablePanelOptions } from '../coordinators/types.ts';
import { StatusStripController } from './StatusStripController.ts';

interface StatusStripPanelOptions extends MovablePanelOptions {
  statusStrip: StatusStripController;
}

export class StatusStripPanel extends MovablePanel {
  private readonly _statusStrip: StatusStripController;
  private _lastText: string = '';
  private _dirty = true;

  constructor(cameraGroup: THREE.Group, options: StatusStripPanelOptions) {
    super(cameraGroup, {
      title: 'STATUS',
      width: 720,
      height: 80,
      position: options.position ?? [0, 1.8, -1.2],
      worldSize: options.worldSize ?? [0.72, 0.08],
      titleBarHeight: 0,
      tilt: 0,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });
    this._statusStrip = options.statusStrip;
    this.render();
  }

  update(): void {
    const text = this._statusStrip.formatStripText();
    if (text !== this._lastText) {
      this._lastText = text;
      this._dirty = true;
    }
    if (this._dirty) {
      this._dirty = false;
      this.render();
    }
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 16;

    ctx.fillStyle = 'rgba(10, 20, 35, 0.9)';
    ctx.fillRect(0, 0, w, contentH);

    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, contentH - 4);

    ctx.font = this._scaleFont('bold 16px monospace');
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._lastText || 'Initializing...', pad, contentH / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}