import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { AccessibilityOptions } from '../coordinators/types.ts';

export interface OperationLogEntry {
  operation: string;
  rowCount?: number;
  timestamp?: number;
}

interface OperationLogPanelOptions {
  position?: [number, number, number];
  worldSize?: [number, number];
  textScale?: number;
  highContrast?: boolean;
}

const PANEL_WIDTH = 800;
const PANEL_HEIGHT = 640;
const BASE_FONT_SIZE = 16;

/**
 * Read-only panel showing a chronological list of applied analysis operations.
 *
 * UXR1 migrates this passive provenance projection from MovablePanel/
 * CanvasTexture to SpatialPanel + UIKit. Operation history remains owned by
 * the existing world/analysis-history path; the panel only renders supplied
 * entries.
 */
export class OperationLogPanel extends SpatialPanel {
  readonly title = 'OPERATION LOG';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  entries: OperationLogEntry[] = [];

  private readonly _content: Text;
  private _textScale: number;
  private _highContrast: boolean;

  constructor(analystAnchor: THREE.Object3D, options: OperationLogPanelOptions = {}) {
    const highContrast = options.highContrast ?? false;
    const theme = getTheme(highContrast);
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        gap: SPACING_TOKENS.grid.x8,
        padding: SPACING_TOKENS.grid.x16,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      analystAnchor,
      null
    );

    this.name = 'operation-log-panel';
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;

    const worldWidth = options.worldSize?.[0] ?? 0.8;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [-0.65, 1.55, -1.1]));
    this.position.copy(this.defaultPosition);

    this._content = new Text({
      text: '',
      fontSize: BASE_FONT_SIZE * this._textScale,
      color: Number(theme.textPrimary),
    });
    this.add(this._content);
    this.render();
  }

  /** Replace the current operation log; display newest entries first. */
  setEntries(entries: OperationLogEntry[]): void {
    this.entries = entries.slice().reverse();
    this.render();
  }

  applyAccessibility(options: AccessibilityOptions): void {
    this._textScale = options.textScale;
    this._highContrast = options.highContrast;
    const theme = getTheme(this._highContrast);
    this.setProperties({
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
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
    const theme = getTheme(this._highContrast);
    this._content.setProperties({
      text: this._formatEntries(),
      fontSize: BASE_FONT_SIZE * this._textScale,
      color: Number(theme.textPrimary),
    });
  }

  private _formatEntries(): string {
    if (this.entries.length === 0) return '// Recent operations\nNo operations yet.';

    const lines = ['// Recent operations'];
    for (const entry of this.entries.slice(0, 18)) {
      const time = entry.timestamp
        ? new Date(entry.timestamp).toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '--:--:--';
      const suffix = entry.rowCount != null ? ' — ' + entry.rowCount + ' rows' : '';
      lines.push(time + '  ' + entry.operation + suffix);
    }
    return lines.join('\n');
  }
}
