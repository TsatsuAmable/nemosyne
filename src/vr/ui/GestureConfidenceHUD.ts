import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { AccessibilityOptions } from '../coordinators/types.ts';

export interface GestureConfidenceEntry {
  gestureName: string;
  confidence: number;
  lastDetectedMs: number;
}

const PANEL_WIDTH = 700;
const PANEL_HEIGHT = 550;
const DEFAULT_GESTURES = [
  'pinchTogether',
  'pinchApart',
  'swipeLeft',
  'swipeRight',
  'scoopUp',
  'pushForward',
] as const;

/**
 * Live gesture-confidence diagnostic.
 *
 * UXR1 migrates this passive assist surface from MovablePanel/CanvasTexture to
 * SpatialPanel + UIKit. Gesture recognition remains authoritative upstream in
 * AdaptiveAssistController/EventBus; this class only clamps and projects the
 * confidence values supplied to it.
 */
export class GestureConfidenceHUD extends SpatialPanel {
  readonly title = 'GESTURE CONFIDENCE RADAR';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  private _confidenceMap = new Map<string, GestureConfidenceEntry>();
  private readonly _content: Text;
  private _textScale = 1;
  private _highContrast = false;

  constructor(
    analystAnchor: THREE.Object3D,
    position: [number, number, number] = [0.8, 1.5, -1.2]
  ) {
    const theme = getTheme(false);
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

    this.name = 'gesture-confidence-hud';
    this.scale.setScalar(0.85 / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...position);
    this.position.copy(this.defaultPosition);

    this._content = new Text({
      text: '',
      fontSize: 16,
      color: Number(theme.textPrimary),
    });
    this.add(this._content);

    this._initializeDefaultEntries();
    this.render();
  }

  private _initializeDefaultEntries(): void {
    for (const gestureName of DEFAULT_GESTURES) {
      this._confidenceMap.set(gestureName, {
        gestureName,
        confidence: 0,
        lastDetectedMs: 0,
      });
    }
  }

  recordConfidence(gestureName: string, confidence: number, time = Date.now()): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(confidence) ? confidence : 0));
    this._confidenceMap.set(gestureName, {
      gestureName,
      confidence: clamped,
      lastDetectedMs: time,
    });
    this.render();
  }

  getConfidence(gestureName: string): GestureConfidenceEntry | null {
    const entry = this._confidenceMap.get(gestureName);
    return entry ? { ...entry } : null;
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
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });
  }

  private _formatEntries(): string {
    const lines = ['GESTURE NAME                 CONFIDENCE'];
    for (const entry of this._confidenceMap.values()) {
      const pct = Math.round(entry.confidence * 100);
      const filled = Math.round(entry.confidence * 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      lines.push(
        entry.gestureName.toUpperCase().padEnd(28) +
          bar +
          ' ' +
          String(pct).padStart(3) +
          '%'
      );
    }
    return lines.join('\n');
  }
}
