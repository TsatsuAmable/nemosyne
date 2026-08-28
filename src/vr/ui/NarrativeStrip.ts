import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import type { MovablePanelOptions } from '../coordinators/types.ts';
import type { AnalysisHistory, HistoryFrame } from '../../data/AnalysisHistory.ts';

export interface NarrativeStripOptions extends MovablePanelOptions {
  analystAnchor?: THREE.Group | null;
  history?: AnalysisHistory;
  onSeek?: (index: number) => void;
}

interface ChipBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Analyst-anchored breadcrumb strip that visualises the AnalysisHistory stack.
 *
 * Each applied operation becomes a clickable chip on a horizontal timeline. The
 * current frame is highlighted; clicking any chip jumps directly to that point
 * in the analysis (undo/redo to the selected frame). The strip stays attached to
 * the analyst anchor so it is always within arm's reach without blocking the
 * data palace.
 */
export class NarrativeStrip extends MovablePanel {
  history: AnalysisHistory | null;
  onSeek: (index: number) => void;
  _chipBounds: ChipBounds[];

  constructor(cameraGroup: THREE.Group, options: NarrativeStripOptions = {}) {
    super(cameraGroup, {
      title: 'ANALYSIS TIMELINE',
      width: 900,
      height: 220,
      position: options.position ?? [0, 1.35, -1.05],
      worldSize: options.worldSize ?? [0.9, 0.22],
      titleBarHeight: 40,
      tilt: 0.18,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
      parentGroup: options.analystAnchor ?? null,
    });

    this.history = options.history ?? null;
    this.onSeek = options.onSeek ?? (() => {});
    this._chipBounds = [];
    this.render();
  }

  setHistory(history: AnalysisHistory | null): void {
    this.history = history;
    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const margin = 24;
    const frames: HistoryFrame[] = this.history?.frames() ?? [];

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (frames.length === 0) {
      ctx.font = this._scaleFont('16px monospace');
      ctx.fillStyle = this.highContrast ? '#aaaaaa' : '#778899';
      ctx.fillText(
        'Apply a data operation (filter, sort, aggregate, cluster, anomaly, time-slice) to build a timeline.',
        margin,
        contentH / 2
      );
      this._chipBounds = [];
      return;
    }

    const accent = `#${this.remapColor(0x00ffcc).toString(16).padStart(6, '0')}`;
    const dim = this.highContrast ? '#888888' : '#445566';
    const trackY = contentH / 2;

    // Compute chip geometry so the full timeline fits with a minimum width.
    const gap = 12;
    const minChipW = 80;
    const maxChipW = 160;
    const available = w - margin * 2 - gap * (frames.length - 1);
    const chipW = Math.max(minChipW, Math.min(maxChipW, Math.floor(available / frames.length)));
    const chipH = 48;

    // Draw connecting track.
    const trackLeft = margin + chipW / 2;
    const trackRight = margin + chipW / 2 + (chipW + gap) * (frames.length - 1);
    ctx.strokeStyle = dim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trackLeft, trackY);
    ctx.lineTo(trackRight, trackY);
    ctx.stroke();

    this._chipBounds = [];
    const current = this.history?.currentIndex ?? -1;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const x = margin + i * (chipW + gap);
      const y = trackY - chipH / 2;
      const isCurrent = i === current;

      // Chip background.
      ctx.fillStyle = isCurrent ? 'rgba(0, 255, 204, 0.22)' : 'rgba(60, 60, 80, 0.45)';
      ctx.fillRect(x, y, chipW, chipH);
      ctx.strokeStyle = isCurrent ? accent : dim;
      ctx.lineWidth = isCurrent ? 3 : 2;
      ctx.strokeRect(x, y, chipW, chipH);

      // Operation label.
      ctx.font = this._scaleFont(isCurrent ? 'bold 16px monospace' : '14px monospace');
      ctx.fillStyle = this.highContrast ? '#ffffff' : isCurrent ? '#00ffff' : '#ccffff';
      ctx.textAlign = 'center';
      const label = this._formatLabel(frame.operation, frame.parameters);
      this._clipText(ctx, label, chipW - 12);
      ctx.fillText(label, x + chipW / 2, y + chipH / 2 - 5);

      // Optional row-count hint.
      const count =
        frame.rowCountAfter ??
        frame.rowCountBefore ??
        frame.datasetAfter?.rowCount ??
        frame.datasetBefore?.rowCount;
      if (typeof count === 'number') {
        ctx.font = this._scaleFont('12px monospace');
        ctx.fillStyle = this.highContrast ? '#cccccc' : '#88ccaa';
        ctx.fillText(`${count} rows`, x + chipW / 2, y + chipH / 2 + 14);
      }

      this._chipBounds.push({ x, y, w: chipW, h: chipH });
    }

    ctx.textAlign = 'left';
  }

  private _formatLabel(operation: string, parameters: Record<string, unknown> = {}): string {
    const paramKeys = Object.keys(parameters);
    if (!paramKeys.length) return operation;
    const firstKey = paramKeys[0];
    const firstValue = parameters[firstKey];
    const value =
      typeof firstValue === 'number' ? Number(firstValue.toFixed(2)) : String(firstValue);
    return `${operation}: ${firstKey}=${value}`;
  }

  private _clipText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    const measured = ctx.measureText(text).width;
    if (measured <= maxWidth) return text;
    let clipped = text;
    while (clipped.length > 0 && ctx.measureText(`${clipped}…`).width > maxWidth) {
      clipped = clipped.slice(0, -1);
    }
    return `${clipped}…`;
  }

  handleContentClick(worldRaycaster: THREE.Raycaster): boolean {
    const hits = worldRaycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;

    const uv = hits[0].uv;
    if (!uv) return false;
    const cx = uv.x * this.width;
    const cy = (1 - uv.y) * this.height;

    for (let i = 0; i < this._chipBounds.length; i++) {
      const b = this._chipBounds[i];
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        this.onSeek(i);
        return true;
      }
    }
    return false;
  }
}
