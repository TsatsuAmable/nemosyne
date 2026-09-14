import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { AccessibilityOptions, MovablePanelOptions } from '../coordinators/types.ts';
import type { AnalysisHistory, HistoryFrame } from '../../data/AnalysisHistory.ts';

export interface NarrativeStripOptions extends MovablePanelOptions {
  analystAnchor?: THREE.Group | null;
  history?: AnalysisHistory;
  onSeek?: (index: number) => void;
}

const PANEL_WIDTH = 900;
const PANEL_HEIGHT = 220;

/**
 * Analyst-anchored breadcrumb strip for AnalysisHistory.
 *
 * UXR1 migrates the timeline from MovablePanel/CanvasTexture to SpatialPanel +
 * UIKit. AnalysisHistory remains authoritative; this surface only projects the
 * current stack and forwards explicit seek requests through onSeek.
 */
export class NarrativeStrip extends SpatialPanel {
  readonly title = 'ANALYSIS TIMELINE';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.18;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  history: AnalysisHistory | null;
  onSeek: (index: number) => void;

  private readonly _timeline: Container;
  private readonly _emptyText: Text;
  private _buttons: Button[] = [];
  private _textScale: number;
  private _highContrast: boolean;

  constructor(analystAnchor: THREE.Object3D, options: NarrativeStripOptions = {}) {
    const highContrast = options.highContrast ?? false;
    const theme = getTheme(highContrast);
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        gap: SPACING_TOKENS.grid.x8,
        padding: SPACING_TOKENS.grid.x12,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      options.analystAnchor ?? analystAnchor,
      null
    );

    this.name = 'narrative-strip';
    this.history = options.history ?? null;
    this.onSeek = options.onSeek ?? (() => {});
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;

    const worldWidth = options.worldSize?.[0] ?? 0.9;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [0, 1.35, -1.05]));
    this.position.copy(this.defaultPosition);

    this._emptyText = new Text({
      text: '',
      fontSize: 15 * this._textScale,
      color: Number(theme.textMuted),
    });
    this._timeline = new Container({
      flexDirection: 'row',
      gap: SPACING_TOKENS.grid.x4,
      alignItems: 'center',
    });

    this.add(this._emptyText, this._timeline);
    this.render();
  }

  setHistory(history: AnalysisHistory | null): void {
    this.history = history;
    this.render();
  }

  seekTo(index: number): boolean {
    const frames = this.history?.frames() ?? [];
    if (!Number.isInteger(index) || index < 0 || index >= frames.length) return false;
    this.onSeek(index);
    return true;
  }

  applyAccessibility(options: AccessibilityOptions): void {
    this._textScale = options.textScale;
    this._highContrast = options.highContrast;
    const theme = getTheme(this._highContrast);
    this.setProperties({
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
    });
    this._emptyText.setProperties({
      fontSize: 15 * this._textScale,
      color: Number(theme.textMuted),
    });
    this.render();
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

  render(): void {
    for (const button of this._buttons) {
      this._timeline.remove(button);
      button.dispose();
    }
    this._buttons = [];

    const frames: HistoryFrame[] = this.history?.frames() ?? [];
    if (frames.length === 0) {
      this._emptyText.setProperties({
        text:
          'Apply a data operation (filter, sort, aggregate, cluster, anomaly, time-slice) to build a timeline.',
      });
      return;
    }

    this._emptyText.setProperties({ text: '' });
    const current = this.history?.currentIndex ?? -1;

    for (let index = 0; index < frames.length; index++) {
      const frame = frames[index];
      const count =
        frame.rowCountAfter ??
        frame.rowCountBefore ??
        frame.datasetAfter?.rowCount ??
        frame.datasetBefore?.rowCount;
      const label = this._formatLabel(frame.operation, frame.parameters);
      const button = new Button({
        label: label + (typeof count === 'number' ? '\n' + count + ' rows' : ''),
        variant: index === current ? 'primary' : 'secondary',
        onClick: () => {
          this.seekTo(index);
        },
      });
      this._buttons.push(button);
      this._timeline.add(button);
    }
  }

  private _formatLabel(operation: string, parameters: Record<string, unknown> = {}): string {
    const paramKeys = Object.keys(parameters);
    if (!paramKeys.length) return operation;
    const firstKey = paramKeys[0];
    const firstValue = parameters[firstKey];
    const value =
      typeof firstValue === 'number' ? Number(firstValue.toFixed(2)) : String(firstValue);
    return operation + ': ' + firstKey + '=' + value;
  }
}
