import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { StatusStripController } from './StatusStripController.ts';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { COLOR_TOKENS, SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import { remapColor } from '../../utils/Accessibility.ts';
import type { AccessibilityOptions, PointerLike } from '../coordinators/types.ts';

const PANEL_WIDTH = 900;
const PANEL_HEIGHT = 156;
const DEFAULT_WORLD_WIDTH = 0.9;
const BASE_FONT_SIZE = 18;

export interface StatusStripPanelOptions {
  statusStrip: StatusStripController;
  position?: [number, number, number];
  worldSize?: [number, number];
  textScale?: number;
  highContrast?: boolean;
  colorblindMode?: string;
}

/**
 * Persistent, analyst-anchored investigation grounding surface.
 *
 * UXR1 migrates the C2 status strip from the legacy CanvasTexture/MovablePanel
 * renderer to the shared SpatialPanel + UIKit substrate. The strip remains a
 * presentation-only projection: it owns no analytical, investigation or
 * recovery authority and is deliberately non-interactive.
 */
export class StatusStripPanel extends SpatialPanel {
  readonly title = 'STATUS';
  readonly defaultPosition: THREE.Vector3;

  private readonly _statusStrip: StatusStripController;
  private readonly _lineTexts: Text[] = [];
  private _lastLines: string[] = [];
  private _textScale: number;
  private _highContrast: boolean;
  private _colorblindMode: string;

  constructor(analystAnchor: THREE.Object3D, options: StatusStripPanelOptions) {
    const highContrast = options.highContrast ?? false;
    const colorblindMode = options.colorblindMode ?? 'none';
    const theme = getTheme(highContrast);
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        justifyContent: 'center',
        gap: SPACING_TOKENS.grid.x4,
        padding: SPACING_TOKENS.grid.x16,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      analystAnchor,
      null,
    );

    this.name = 'status-strip-panel';
    this._statusStrip = options.statusStrip;
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;
    this._colorblindMode = colorblindMode;

    const worldWidth = options.worldSize?.[0] ?? DEFAULT_WORLD_WIDTH;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    const position = options.position ?? [0, 1.8, -1.2];
    this.defaultPosition = new THREE.Vector3(...position);
    this.position.copy(this.defaultPosition);

    // The status strip is persistent grounding, not a manipulable workspace
    // panel. Keeping it off InputRouter also prevents it intercepting data hits.
    this.setGrabEnabled(false);
    this.setGrabRailVisible(false);

    for (let index = 0; index < 4; index++) {
      const line = new Text({
        text: '',
        fontSize: BASE_FONT_SIZE * this._textScale,
        color: this._lineColor(index),
        fontWeight: index === 0 ? 'bold' : 'medium',
      });
      this._lineTexts.push(line);
      this.add(line);
    }
    this._syncLines(true);
  }

  update(delta = 0): void {
    super.update(delta);
    this._syncLines(false);
  }

  /** Presentation-only surface: never capture or dispatch pointer interaction. */
  override handlePointerDown(_raycaster: THREE.Raycaster, _pointer: PointerLike): string | null {
    return null;
  }

  override handlePointerMove(_raycaster: THREE.Raycaster, _pointer: PointerLike): void {}

  override handlePointerUp(_raycaster: THREE.Raycaster, _pointer: PointerLike): void {}

  applyAccessibility(options: AccessibilityOptions): void {
    this._textScale = options.textScale;
    this._highContrast = options.highContrast;
    this._colorblindMode = String(options.colorblindMode);
    const theme = getTheme(this._highContrast);
    this.setProperties({
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
    });
    this._lineTexts.forEach((line, index) => {
      line.setProperties({
        fontSize: BASE_FONT_SIZE * this._textScale,
        color: this._lineColor(index),
      });
    });
  }

  private _syncLines(force: boolean): void {
    const lines = this._statusStrip.formatInvestigationLines();
    for (let index = 0; index < this._lineTexts.length; index++) {
      const text = lines[index] ?? '';
      if (force || this._lastLines[index] !== text) {
        this._lineTexts[index].setProperties({ text });
      }
    }
    this._lastLines = [...lines];
  }

  private _lineColor(index: number): number {
    const theme = getTheme(this._highContrast);
    if (index === 0) return Number(theme.textPrimary);
    if (index === 1) {
      return this._highContrast
        ? Number(theme.accentColor)
        : (remapColor(COLOR_TOKENS.interaction.focus, this._colorblindMode) as number);
    }
    return Number(theme.textMuted);
  }
}
