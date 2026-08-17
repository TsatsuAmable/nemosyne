import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import type { MovablePanelOptions } from '../coordinators/types.ts';
import type { AtlasRecommendation } from '../../atlas/types.ts';

export interface RecommendationPanelOptions extends MovablePanelOptions {
  getRecommendation: () => AtlasRecommendation | null;
  onAccept?: () => void;
  onReject?: () => void;
  onOverride?: () => void;
  onGenerate?: () => void;
}

interface BtnRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ACTION_LABELS: Record<string, string> = {
  'inspect-cluster': 'Inspect Cluster',
  'inspect-boundary': 'Inspect Boundary',
  'explore-region': 'Explore Region',
  'compare-regions': 'Compare Regions',
  'investigate-anomaly': 'Investigate Anomaly',
};

const DECISION_COLOR: Record<string, string> = {
  pending: '#ffcc00',
  accepted: '#00ff66',
  rejected: '#ff3344',
  overridden: '#9966ff',
};

export class RecommendationPanel extends MovablePanel {
  private readonly _getRecommendation: () => AtlasRecommendation | null;
  private readonly _onAccept?: () => void;
  private readonly _onReject?: () => void;
  private readonly _onOverride?: () => void;
  private readonly _onGenerate?: () => void;
  private _dirty = true;
  private _buttons: BtnRect[] = [];

  constructor(cameraGroup: THREE.Group, options: RecommendationPanelOptions) {
    super(cameraGroup, {
      title: 'GUIDANCE',
      width: 720,
      height: 620,
      position: options.position ?? [0.8, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.72, 0.62],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });
    this._getRecommendation = options.getRecommendation;
    this._onAccept = options.onAccept;
    this._onReject = options.onReject;
    this._onOverride = options.onOverride;
    this._onGenerate = options.onGenerate;
    this.render();
  }

  update(): void {
    if (this._dirty) {
      this._dirty = false;
      this.render();
    }
  }

  markDirty(): void {
    this._dirty = true;
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 20;
    const lineH = 24;
    let y = pad;
    this._buttons = [];

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const rec = this._getRecommendation();

    if (!rec) {
      ctx.font = this._scaleFont('bold 18px monospace');
      ctx.fillStyle = '#888888';
      ctx.fillText('No active recommendation', pad, y + lineH);
      y += lineH + 8;
      ctx.font = this._scaleFont('14px monospace');
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('Run structure discovery (cluster/TDA)', pad, y + lineH);
      ctx.fillText('to generate guidance.', pad, y + lineH * 2);
      y += lineH * 2 + 16;

      if (this._onGenerate) {
        this._drawButton(ctx, 'generate', 'Generate', pad, y, 200, 40, '#0088cc');
        y += 56;
      }
      this.totalContentHeight = y;
      return;
    }

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = '#00ffff';
    ctx.fillText('// RECOMMENDATION', pad, y + lineH);
    y += lineH + 4;

    ctx.font = this._scaleFont('15px monospace');
    ctx.fillStyle = '#ccffff';
    const actionLabel = ACTION_LABELS[rec.action] ?? rec.action;
    ctx.fillText(`Action: ${actionLabel}`, pad + 8, y + lineH);
    y += lineH + 2;

    const decisionColor = DECISION_COLOR[rec.decision] ?? '#ffcc00';
    ctx.fillStyle = decisionColor;
    ctx.fillText(`Decision: ${rec.decision}`, pad + 8, y + lineH);
    y += lineH + 8;

    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = '#00ffff';
    ctx.fillText('// RATIONALE', pad, y + lineH);
    y += lineH + 2;
    ctx.font = this._scaleFont('14px monospace');
    ctx.fillStyle = '#dddddd';
    y = this._wrapText(ctx, rec.rationale, pad + 8, y, w - pad * 2 - 8, lineH, contentH) + 8;

    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = '#00ffff';
    ctx.fillText('// EVIDENCE', pad, y + lineH);
    y += lineH + 2;
    ctx.font = this._scaleFont('13px monospace');
    ctx.fillStyle = '#bbbbbb';
    if (rec.evidenceItems && rec.evidenceItems.length > 0) {
      for (const item of rec.evidenceItems) {
        const text = `${item.type}: ${item.value.toFixed(3)} (${item.source.slice(-24)})`;
        y = this._wrapText(ctx, text, pad + 8, y, w - pad * 2 - 8, lineH, contentH) + 2;
      }
    } else {
      ctx.fillText(rec.evidence, pad + 8, y + lineH);
      y += lineH;
    }
    y += 8;

    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = '#00ffff';
    ctx.fillText('// CONFIDENCE', pad, y + lineH);
    y += lineH + 4;
    const barW = w - pad * 2 - 8;
    const barH = 18;
    ctx.fillStyle = '#222222';
    ctx.fillRect(pad + 8, y, barW, barH);
    const confW = Math.max(0, Math.min(1, rec.confidence)) * barW;
    ctx.fillStyle = rec.confidence > 0.6 ? '#00ff66' : rec.confidence > 0.3 ? '#ffcc00' : '#ff6644';
    ctx.fillRect(pad + 8, y, confW, barH);
    ctx.font = this._scaleFont('12px monospace');
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${(rec.confidence * 100).toFixed(0)}%`, pad + 12, y + 14);
    y += barH + 12;

    if (rec.limitations) {
      ctx.font = this._scaleFont('13px monospace');
      ctx.fillStyle = '#ff9966';
      y = this._wrapText(ctx, `⚠ ${rec.limitations}`, pad + 8, y, w - pad * 2 - 8, lineH, contentH) + 8;
    }

    if (rec.suggestedEmbodiment) {
      ctx.font = this._scaleFont('13px monospace');
      ctx.fillStyle = '#aa88ff';
      ctx.fillText(`Embodiment: ${rec.suggestedEmbodiment}`, pad + 8, y + lineH);
      y += lineH + 8;
    }

    if (rec.decision === 'pending') {
      const btnW = 180;
      const btnH = 42;
      const gap = 12;
      const totalW = btnW * 3 + gap * 2;
      const startX = (w - totalW) / 2;
      this._drawButton(ctx, 'accept', '✓ Accept', startX, y, btnW, btnH, '#00aa44');
      this._drawButton(ctx, 'reject', '✗ Reject', startX + btnW + gap, y, btnW, btnH, '#aa3333');
      this._drawButton(ctx, 'override', '↻ Override', startX + (btnW + gap) * 2, y, btnW, btnH, '#6633aa');
      y += btnH + 16;
    } else {
      ctx.font = this._scaleFont('14px monospace');
      ctx.fillStyle = DECISION_COLOR[rec.decision] ?? '#ffcc00';
      ctx.fillText(`Decision recorded: ${rec.decision}`, pad + 8, y + lineH);
      y += lineH + 16;
    }

    this.totalContentHeight = y;
  }

  private _drawButton(
    ctx: CanvasRenderingContext2D,
    id: string,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.font = this._scaleFont('bold 15px monospace');
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    this._buttons.push({ id, x, y, w, h });
  }

  handleContentClick(raycaster: THREE.Raycaster): boolean {
    const hits = raycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;
    const uv = hits[0].uv;
    if (!uv) return false;
    const cx = uv.x * this.width;
    const cy = (1 - uv.y) * this.height;

    for (const b of this._buttons) {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        this._dispatchButton(b.id);
        return true;
      }
    }
    return false;
  }

  private _dispatchButton(id: string): void {
    switch (id) {
      case 'accept':
        this._onAccept?.();
        break;
      case 'reject':
        this._onReject?.();
        break;
      case 'override':
        this._onOverride?.();
        break;
      case 'generate':
        this._onGenerate?.();
        break;
      default:
        break;
    }
    this._dirty = true;
    this.render();
  }

  private _wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineH: number,
    maxY: number,
  ): number {
    const words = text.split(/\s+/);
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy + lineH);
        cy += lineH;
        line = word;
        if (cy > maxY) return cy;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, cy + lineH);
      cy += lineH;
    }
    return cy;
  }
}