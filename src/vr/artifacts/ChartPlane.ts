import * as THREE from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import { categoricalColor } from '../../data/Encodings.ts';
import type { Updatable } from '../coordinators/types.ts';

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;
const MARGIN = { top: 70, right: 60, bottom: 80, left: 90 };

export const ChartType = {
  BAR: 'BAR',
  LINE: 'LINE',
  HISTOGRAM: 'HISTOGRAM',
  BOX: 'BOX',
  CORRELATION: 'CORRELATION',
} as const;
export type ChartKind = (typeof ChartType)[keyof typeof ChartType];

export interface ChartPlaneOptions {
  width?: number;
  height?: number;
  worldSize?: [number, number];
  chartType?: ChartKind;
  column?: string | null;
  xColumn?: string | null;
  yColumn?: string | null;
  title?: string;
  color?: string;
  colorblindMode?: string | boolean;
}

export interface DracoFactsLike {
  numericColumns?: number;
  hasTimeSeries?: boolean;
}

interface ChartRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * World-space 2D chart panels rendered to a CanvasTexture.
 *
 * ChartPlane draws bar, line, histogram, box, and correlation-heatmap plots
 * from a Dataset and attaches them as a world-space quad. The canvas updates
 * when the underlying dataset changes, so the panel can follow live streams
 * and data operations.
 */
export class ChartPlane implements Updatable {
  width: number;
  height: number;
  worldSize: [number, number];
  chartType: ChartKind;
  column: string | null;
  xColumn: string | null;
  yColumn: string | null;
  title: string;
  color: string;
  colorblindMode: string | boolean;

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh;

  dataset: Dataset | null;

  constructor({
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    worldSize = [1.6, 1.2],
    chartType = ChartType.BAR,
    column = null,
    xColumn = null,
    yColumn = null,
    title = 'Chart',
    color = '#00ffcc',
    colorblindMode = 'none',
  }: ChartPlaneOptions = {}) {
    this.width = width;
    this.height = height;
    this.worldSize = worldSize;
    this.chartType = chartType;
    this.column = column;
    this.xColumn = xColumn;
    this.yColumn = yColumn;
    this.title = title;
    this.color = color;
    this.colorblindMode = colorblindMode;

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.PlaneGeometry(worldSize[0], worldSize[1]);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'chart-plane';

    this.dataset = null;
  }

  /** Factory helper that picks a sensible chart type from a Draco facts object. */
  static fromFacts(facts: DracoFactsLike, dataset: Dataset, options: Partial<ChartPlaneOptions> = {}): ChartPlane {
    let type: ChartKind = ChartType.BAR;
    const column = options.column ?? dataset.numericColumns[0]?.name ?? null;
    let xColumn: string | null = null;
    let yColumn: string | null = null;
    let title = options.title ?? 'Chart';

    if (facts.hasTimeSeries) {
      type = ChartType.LINE;
      xColumn = dataset.temporalColumns[0]?.name ?? null;
      yColumn = column;
      title = options.title ?? 'Time Series';
    } else if (facts.numericColumns && (facts.numericColumns as number) > 1) {
      type = ChartType.CORRELATION;
      title = options.title ?? 'Correlation Matrix';
    } else if (column) {
      type = ChartType.HISTOGRAM;
      title = options.title ?? `Distribution of ${column}`;
    }

    return new ChartPlane({
      chartType: type,
      column,
      xColumn,
      yColumn,
      title,
      ...options,
    });
  }

  mount(parent: { add(object: THREE.Object3D): void }): void {
    parent.add(this.mesh);
  }

  setDataset(dataset: Dataset | null | undefined): void {
    this.dataset = dataset ?? null;
    this.draw();
  }

  setTitle(title: string): void {
    this.title = title;
    this.draw();
  }

  setType(type: ChartKind): void {
    this.chartType = type;
    this.draw();
  }

  update(): void {
    this.draw();
  }

  draw(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);
    this._drawBackground(ctx, w, h);
    this._drawTitle(ctx, w);

    if (!this.dataset || this.dataset.rowCount === 0) {
      this._drawNoData(ctx, w, h);
      this.texture.needsUpdate = true;
      return;
    }

    switch (this.chartType) {
      case ChartType.LINE:
        this._drawLineChart(ctx, w, h);
        break;
      case ChartType.HISTOGRAM:
        this._drawHistogram(ctx, w, h);
        break;
      case ChartType.BOX:
        this._drawBoxPlot(ctx, w, h);
        break;
      case ChartType.CORRELATION:
        this._drawCorrelationHeatmap(ctx, w, h);
        break;
      case ChartType.BAR:
      default:
        this._drawBarChart(ctx, w, h);
        break;
    }

    this.texture.needsUpdate = true;
  }

  _drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(4, 12, 24, 0.94)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    // Scanlines.
    ctx.fillStyle = 'rgba(0, 255, 204, 0.03)';
    for (let y = 0; y < h; y += 8) {
      ctx.fillRect(0, y, w, 2);
    }
  }

  _drawTitle(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.textAlign = 'center';
    ctx.fillText(`// ${this.title}`, w / 2, 44);
    ctx.textAlign = 'left';
  }

  _drawNoData(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.font = '24px monospace';
    ctx.fillStyle = '#88ccff';
    ctx.textAlign = 'center';
    ctx.fillText('NO DATA', w / 2, h / 2);
    ctx.textAlign = 'left';
  }

  _chartRect(w: number, h: number): ChartRect {
    return {
      x: MARGIN.left,
      y: MARGIN.top,
      width: w - MARGIN.left - MARGIN.right,
      height: h - MARGIN.top - MARGIN.bottom,
    };
  }

  _numericValues(columnName?: string | null): number[] {
    if (!this.dataset) return [];
    const name = (columnName ?? this.column)!;
    if (!name) return [];
    return this.dataset
      .getColumnValues(name)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  }

  _drawBarChart(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const values = this._numericValues();
    const labels =
      this.dataset!.categoricalColumns.length > 0
        ? this.dataset!.getColumnValues(this.dataset!.categoricalColumns[0].name)
        : values.map((_, i) => String(i));
    const rect = this._chartRect(w, h);
    const max = Math.max(...values, 1);
    const barWidth = rect.width / values.length;

    this._drawAxes(ctx, rect, 'category', 'value', 0, max);

    for (let i = 0; i < values.length; i++) {
      const barH = (values[i] / max) * rect.height;
      const x = rect.x + i * barWidth + barWidth * 0.15;
      const y = rect.y + rect.height - barH;
      const categorical = categoricalColor(i, i, this.colorblindMode);
      ctx.fillStyle = this.colorblindMode !== 'none' && this.colorblindMode !== false
        ? `#${categorical.toString(16).padStart(6, '0')}`
        : this.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, barWidth * 0.7, barH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth * 0.7, barH);

      if (typeof ctx.save === 'function') {
        ctx.save();
        ctx.translate(x + barWidth * 0.35, rect.y + rect.height + 24);
        ctx.rotate(-Math.PI / 4);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#88ccff';
        ctx.textAlign = 'right';
        ctx.fillText(String(labels[i] ?? i).slice(0, 12), 0, 0);
        ctx.restore();
      } else {
        ctx.font = '14px monospace';
        ctx.fillStyle = '#88ccff';
        ctx.textAlign = 'center';
        ctx.fillText(
          String(labels[i] ?? i).slice(0, 12),
          x + barWidth * 0.35,
          rect.y + rect.height + 24
        );
      }
    }
  }

  _drawLineChart(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const xName = this.xColumn ?? this.dataset!.temporalColumns[0]?.name;
    const yName = this.yColumn ?? this.column ?? this.dataset!.numericColumns[0]?.name;
    if (!yName) return this._drawNoData(ctx, w, h);

    const rows = this.dataset!.rows.slice().sort((a, b) => {
      const av = xName ? a[xName] : a._index;
      const bv = xName ? b[xName] : b._index;
      if (typeof av === 'number') return av - (bv as number);
      return String(av).localeCompare(String(bv));
    });
    const ys = rows.map((r) => Number(r[yName])).filter((v) => !Number.isNaN(v));
    if (ys.length === 0) return this._drawNoData(ctx, w, h);

    const rect = this._chartRect(w, h);
    const min = Math.min(...ys);
    const max = Math.max(...ys, min + 1);
    const range = max - min;

    this._drawAxes(ctx, rect, xName ?? 'index', yName, min, max);

    ctx.beginPath();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    for (let i = 0; i < ys.length; i++) {
      const x = rect.x + (i / Math.max(1, ys.length - 1)) * rect.width;
      const y = rect.y + rect.height - ((ys[i] - min) / range) * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Points.
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < ys.length; i++) {
      const x = rect.x + (i / Math.max(1, ys.length - 1)) * rect.width;
      const y = rect.y + rect.height - ((ys[i] - min) / range) * rect.height;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawHistogram(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const values = this._numericValues();
    if (values.length === 0) return this._drawNoData(ctx, w, h);

    const bins = Math.max(3, Math.min(20, Math.ceil(Math.sqrt(values.length))));
    const min = Math.min(...values);
    const max = Math.max(...values, min + 1);
    const step = (max - min) / bins;
    const counts = new Array(bins).fill(0);
    for (const v of values) {
      const idx = Math.min(bins - 1, Math.floor((v - min) / step));
      counts[idx]++;
    }

    const rect = this._chartRect(w, h);
    const maxCount = Math.max(...counts, 1);
    const barWidth = rect.width / bins;

    this._drawAxes(ctx, rect, this.column ?? 'value', 'count', 0, maxCount);

    for (let i = 0; i < bins; i++) {
      const barH = (counts[i] / maxCount) * rect.height;
      const x = rect.x + i * barWidth + barWidth * 0.1;
      const y = rect.y + rect.height - barH;
      ctx.fillStyle = this.color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x, y, barWidth * 0.8, barH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth * 0.8, barH);
    }
  }

  _drawBoxPlot(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const values = this._numericValues();
    if (values.length === 0) return this._drawNoData(ctx, w, h);

    const sorted = values.slice().sort((a, b) => a - b);
    const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
    const q2 = sorted[Math.floor((sorted.length - 1) * 0.5)];
    const q3 = sorted[Math.ceil((sorted.length - 1) * 0.75)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const rect = this._chartRect(w, h);
    const range = Math.max(max, min + 1) - min;
    const cx = rect.x + rect.width / 2;
    const boxW = rect.width * 0.3;

    this._drawAxes(ctx, rect, '', this.column ?? 'value', min, max);

    const yFor = (v: number): number => rect.y + rect.height - ((v - min) / range) * rect.height;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    // Whiskers.
    ctx.beginPath();
    ctx.moveTo(cx, yFor(min));
    ctx.lineTo(cx, yFor(max));
    ctx.stroke();

    // Box.
    ctx.fillStyle = 'rgba(0, 255, 204, 0.25)';
    ctx.fillRect(cx - boxW / 2, yFor(q3), boxW, yFor(q1) - yFor(q3));
    ctx.strokeRect(cx - boxW / 2, yFor(q3), boxW, yFor(q1) - yFor(q3));

    // Median.
    ctx.beginPath();
    ctx.moveTo(cx - boxW / 2, yFor(q2));
    ctx.lineTo(cx + boxW / 2, yFor(q2));
    ctx.stroke();

    // Min / max caps.
    ctx.beginPath();
    ctx.moveTo(cx - boxW / 4, yFor(min));
    ctx.lineTo(cx + boxW / 4, yFor(min));
    ctx.moveTo(cx - boxW / 4, yFor(max));
    ctx.lineTo(cx + boxW / 4, yFor(max));
    ctx.stroke();
  }

  _drawCorrelationHeatmap(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const names = this.dataset!.numericColumns.map((c) => c.name);
    if (names.length < 2) return this._drawNoData(ctx, w, h);

    const values = names.map((name) =>
      this.dataset!.getColumnValues(name).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
    );
    const n = values[0]?.length || 0;
    if (n === 0) return this._drawNoData(ctx, w, h);

    const stats = values.map((vals) => {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      return { mean, std };
    });

    const matrix: number[][] = [];
    for (let i = 0; i < names.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < names.length; j++) {
        if (stats[i].std === 0 || stats[j].std === 0) {
          matrix[i][j] = i === j ? 1 : 0;
          continue;
        }
        let cov = 0;
        for (let k = 0; k < n; k++) {
          cov += (values[i][k] - stats[i].mean) * (values[j][k] - stats[j].mean);
        }
        cov /= n;
        matrix[i][j] = cov / (stats[i].std * stats[j].std);
      }
    }

    const rect = this._chartRect(w, h);
    const size = names.length;
    const cell = Math.min(rect.width, rect.height) / size;

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const corr = matrix[i][j];
        const intensity = Math.abs(corr);
        const r = corr < 0 ? Math.floor(255 * intensity) : 0;
        const g = corr >= 0 ? Math.floor(255 * intensity) : 0;
        const b = Math.floor(100 * (1 - intensity));
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(rect.x + j * cell, rect.y + i * cell, cell - 2, cell - 2);
      }
    }

    // Labels.
    ctx.fillStyle = '#88ccff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i < size; i++) {
      ctx.fillText(names[i].slice(0, 10), rect.x - 8, rect.y + i * cell + cell / 2 + 5);
    }
    ctx.textAlign = 'center';
    for (let j = 0; j < size; j++) {
      if (typeof ctx.save === 'function') {
        ctx.save();
        ctx.translate(rect.x + j * cell + cell / 2, rect.y - 8);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(names[j].slice(0, 10), 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(names[j].slice(0, 10), rect.x + j * cell + cell / 2, rect.y - 8);
      }
    }
  }

  _drawAxes(
    ctx: CanvasRenderingContext2D,
    rect: ChartRect,
    xLabel: string | number,
    yLabel: string | number,
    yMin: number,
    yMax: number
  ): void {
    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y);
    ctx.lineTo(rect.x, rect.y + rect.height);
    ctx.lineTo(rect.x + rect.width, rect.y + rect.height);
    ctx.stroke();

    ctx.fillStyle = '#88ccff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(yMax)), rect.x - 10, rect.y + 6);
    ctx.fillText(String(Math.round(yMin)), rect.x - 10, rect.y + rect.height);

    ctx.textAlign = 'center';
    ctx.fillText(String(xLabel), rect.x + rect.width / 2, rect.y + rect.height + 50);

    // Avoid ctx.save/restore in environments that don't support it (some test mocks).
    if (typeof ctx.save === 'function') {
      ctx.save();
      ctx.translate(28, rect.y + rect.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(yLabel), 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(String(yLabel), 28, rect.y + rect.height / 2);
    }
  }
}
