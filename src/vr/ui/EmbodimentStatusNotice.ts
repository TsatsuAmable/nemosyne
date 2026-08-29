import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import type { MovablePanelOptions } from '../coordinators/types.ts';
import type { DracoTopologyNode } from '../../moneta/MonetaTopologyNode.ts';

interface EmbodimentStatusNoticeOptions extends MovablePanelOptions {
  getDracoNode: () => DracoTopologyNode | null;
}

export class EmbodimentStatusNotice extends MovablePanel {
  private readonly _getDracoNode: () => DracoTopologyNode | null;
  private _dirty = true;
  private _lastText: string = '';

  constructor(cameraGroup: THREE.Group, options: EmbodimentStatusNoticeOptions) {
    super(cameraGroup, {
      title: '',
      width: 600,
      height: 120,
      position: options.position ?? [0, 1.2, -1.0],
      worldSize: options.worldSize ?? [0.6, 0.12],
      titleBarHeight: 0,
      tilt: 0,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });
    this._getDracoNode = options.getDracoNode;
    this.mesh.visible = false;
    this.render();
  }

  update(): void {
    const node = this._getDracoNode();
    const status = node?.group?.userData?.semanticEmbodimentStatus as string | undefined;
    const refusal = node?.group?.userData?.semanticEmbodimentRefusal as string | undefined;

    if (status && (status === 'REFUSED' || status === 'INVALID' || status === 'PENDING' || status === 'UNAVAILABLE')) {
      const displayText = this._formatStatusText(status, refusal);
      if (displayText !== this._lastText) {
        this._lastText = displayText;
        this._dirty = true;
      }
      if (!this.mesh.visible) {
        this.mesh.visible = true;
      }
    } else {
      if (this.mesh.visible) {
        this.mesh.visible = false;
      }
      return;
    }

    if (this._dirty) {
      this._dirty = false;
      this.render();
    }
  }

  private _formatStatusText(status: string, refusal?: string): string {
    switch (status) {
      case 'REFUSED':
        return `REPRESENTATION REFUSED: ${refusal ?? 'Constraints could not be satisfied'}`;
      case 'INVALID':
        return 'REPRESENTATION INVALID: Result does not match expected embodiment';
      case 'PENDING':
        return 'REPRESENTATION PENDING: Awaiting analytical result...';
      case 'UNAVAILABLE':
        return 'REPRESENTATION UNAVAILABLE: No semantic embodiment data';
      default:
        return '';
    }
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 16;

    ctx.fillStyle = 'rgba(20, 5, 10, 0.95)';
    ctx.fillRect(0, 0, w, contentH);

    const status = this._getDracoNode()?.group?.userData?.semanticEmbodimentStatus as string | undefined;
    let borderColor = '#ff6644';
    if (status === 'PENDING') borderColor = '#ffcc00';
    else if (status === 'UNAVAILABLE') borderColor = '#888888';

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, w - 6, contentH - 6);

    ctx.font = this._scaleFont('bold 16px monospace');
    ctx.fillStyle = borderColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._lastText, pad, contentH / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}