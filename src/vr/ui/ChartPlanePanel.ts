/**
 * A draggable dashboard panel that hosts a ChartPlane.
 *
 * The chart is rendered to its own CanvasTexture by ChartPlane, then copied
 * into the MovablePanel canvas below the title bar. This lets the chart
 * participate in the dashboard snapping system while keeping the chart drawing
 * logic unchanged.
 */

import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { ChartPlane, ChartType, type ChartKind } from '../artifacts/ChartPlane.ts';
import type { Dataset } from '../../data/Dataset.ts';
import type { AccessibilityOptions, MovablePanelOptions } from '../coordinators/types.ts';

interface ChartPlanePanelOptions extends MovablePanelOptions {
  chartType?: ChartKind;
  column?: string;
  xColumn?: string;
  yColumn?: string;
  title?: string;
  color?: string;
}

export class ChartPlanePanel extends MovablePanel {
  chartPlane: ChartPlane;
  chartType: ChartKind;
  private _datasetVersion = 0;

  constructor(cameraGroup: THREE.Group, dataset: Dataset | null | undefined, options: ChartPlanePanelOptions = {}) {
    const worldSize = options.worldSize ?? [1.1, 0.75];
    super(cameraGroup, {
      title: options.title ?? 'CHART',
      width: options.width ?? 1024,
      height: options.height ?? 768,
      position: options.position ?? [0, 1.6, 1.5],
      worldSize,
      titleBarHeight: options.titleBarHeight ?? 44,
      tilt: options.tilt ?? 0,
      minDistance: options.minDistance ?? 0.3,
      maxDistance: options.maxDistance ?? 2.5,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });

    this.chartPlane = new ChartPlane({
      chartType: options.chartType,
      column: options.column,
      xColumn: options.xColumn,
      yColumn: options.yColumn,
      title: options.title ?? 'CHART',
      color: options.color,
      colorblindMode: options.colorblindMode ?? 'none',
      worldSize,
      width: this.width,
      height: this.height - this.titleBarHeight,
    });
    this.chartType = options.chartType ?? ChartType.BAR;

    this.title = this.chartPlane.title;
    if (dataset) this.setDataset(dataset);
  }

  setDataset(dataset: Dataset | null | undefined): void {
    this._datasetVersion++;
    this.chartPlane.setDataset(dataset);
    this.render();
    // Force texture upload unconditionally: the CanvasTextureCacheManager
    // hashes panel UI state (title/scroll/scale) but not dataset identity,
    // so it would otherwise skip the GPU upload on unchanged UI state.
    (this.texture as unknown as { needsUpdate: boolean }).needsUpdate = true;
  }

  update(): void {
    // ChartPlane does not animate, but this hook lets the panel refresh when
    // the underlying dataset is changed externally.
    this.chartPlane.update();
    this.render();
  }

  applyAccessibility(options: AccessibilityOptions): void {
    super.applyAccessibility(options);
    this.chartPlane.colorblindMode = options.colorblindMode ?? 'none';
    this.chartPlane.update();
    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    if (!this.chartPlane?.canvas) return;

    const chart = this.chartPlane.canvas;
    const chartW = chart.width;
    const chartH = chart.height;
    if (!chartW || !chartH) return;

    // Scale the chart to fit the content area while preserving aspect ratio.
    const scale = Math.min(w / chartW, contentH / chartH);
    const drawW = chartW * scale;
    const drawH = chartH * scale;
    const x = (w - drawW) / 2;
    const y = (contentH - drawH) / 2;

    if (typeof ctx.drawImage === 'function') {
      ctx.drawImage(chart, x, y, drawW, drawH);
    } else {
      // Fallback for test environments that mock the 2D context.
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.textAlign = 'center';
      ctx.fillText(this.chartPlane.title, w / 2, contentH / 2);
    }
  }
}
