/**
 * A draggable dashboard panel that hosts a ChartPlane.
 *
 * UXR1 removes the legacy MovablePanel canvas-copy layer. ChartPlane keeps
 * authority over its own CanvasTexture/rendering; SpatialPanel/UIKit provides
 * the panel chrome and dashboard-compatible spatial container.
 */

import * as THREE from 'three';
import { Custom, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
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

export class ChartPlanePanel extends SpatialPanel {
  readonly defaultPosition: THREE.Vector3;
  readonly tilt: number;
  readonly width: number;
  readonly height: number;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  chartPlane: ChartPlane;
  chartType: ChartKind;
  title: string;

  private readonly _titleText: Text;
  private readonly _chartSurface: Custom;
  private _textScale: number;
  private _highContrast: boolean;

  constructor(
    analystAnchor: THREE.Object3D,
    dataset: Dataset | null | undefined,
    options: ChartPlanePanelOptions = {}
  ) {
    const width = options.width ?? 1024;
    const height = options.height ?? 768;
    const worldSize = options.worldSize ?? [1.1, 0.75];
    const highContrast = options.highContrast ?? false;
    const theme = getTheme(highContrast);

    super(
      {
        width,
        height,
        flexDirection: 'column',
        gap: SPACING_TOKENS.grid.x8,
        padding: SPACING_TOKENS.grid.x8,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      analystAnchor,
      null
    );

    this.name = 'chart-plane-panel';
    this.width = width;
    this.height = height;
    this.tilt = options.tilt ?? 0;
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;

    this.scale.setScalar(worldSize[0] / width);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [0, 1.6, 1.5]));
    this.position.copy(this.defaultPosition);
    this.userData.panelPixelSize = [width, height];

    const chartTitle = options.title ?? 'CHART';
    this.title = chartTitle;
    this._titleText = new Text({
      text: chartTitle,
      fontSize: 22 * this._textScale,
      fontWeight: 'bold',
      color: Number(theme.textPrimary),
    });
    this.add(this._titleText);

    const chartHeight = height - 70;
    this.chartPlane = new ChartPlane({
      chartType: options.chartType,
      column: options.column,
      xColumn: options.xColumn,
      yColumn: options.yColumn,
      title: chartTitle,
      color: options.color,
      colorblindMode: options.colorblindMode ?? 'none',
      // The mesh is mounted under a pixel-space SpatialPanel root, so use
      // panel-local dimensions. Root scaling converts these to world metres.
      worldSize: [width - 32, chartHeight - 16],
      width,
      height: chartHeight,
    });
    this.chartType = options.chartType ?? ChartType.BAR;
    this._chartSurface = new Custom(
      {
        width: width - 32,
        height: chartHeight - 16,
      },
      undefined,
      { material: this.chartPlane.material }
    );
    this.add(this._chartSurface);

    if (dataset) this.setDataset(dataset);
  }

  setDataset(dataset: Dataset | null | undefined): void {
    this.chartPlane.setDataset(dataset);
  }

  update(delta = 0): void {
    super.update(delta);
    this.chartPlane.update();
  }

  applyAccessibility(options: AccessibilityOptions): void {
    this._textScale = options.textScale;
    this._highContrast = options.highContrast;
    const theme = getTheme(this._highContrast);
    this.setProperties({
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
    });
    this._titleText.setProperties({
      fontSize: 22 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this.chartPlane.colorblindMode = options.colorblindMode ?? 'none';
    this.chartPlane.update();
  }

  show(): void {
    this.visible = true;
    this.isMinimized = false;
  }

  hide(): void {
    const changed = this.visible;
    this.visible = false;
    if (changed) this.onHide?.();
  }

  override dispose(): void {
    this.chartPlane.dispose();
    super.dispose();
  }
}
