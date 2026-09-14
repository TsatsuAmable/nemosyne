/* eslint-disable no-console -- VRConsole intercepts and restores console output
   to mirror browser output into a world-space diagnostic surface. */
import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { AccessibilityOptions } from '../coordinators/types.ts';

interface VRConsoleOptions {
  maxLines?: number;
  textScale?: number;
  highContrast?: boolean;
}

interface LogLine {
  level: string;
  text: string;
}

interface ConsolePatch {
  log: typeof console.log;
  warn: typeof console.warn;
  error: typeof console.error;
}

const PANEL_WIDTH = 1024;
const PANEL_HEIGHT = 720;

/**
 * In-VR console/log panel.
 *
 * UXR1 migrates the presentation substrate from MovablePanel/CanvasTexture to
 * SpatialPanel + UIKit. Browser console remains authoritative; this surface
 * mirrors the most recent log lines and restores the original console methods
 * when disposed.
 */
export class VRConsole extends SpatialPanel {
  readonly title = 'LIVE VR CONSOLE';
  readonly defaultPosition = new THREE.Vector3(0, 1.45, -1.3);
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  maxLines: number;
  lines: LogLine[];

  private readonly _content: Text;
  private _originalConsole: ConsolePatch | null = null;
  private _textScale: number;
  private _highContrast: boolean;
  private _mirrorInProgress = false;
  private _projectionDirty = false;

  constructor(analystAnchor: THREE.Object3D, { maxLines = 24, textScale = 1, highContrast = false }: VRConsoleOptions = {}) {
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

    this.name = 'vr-console';
    this.maxLines = maxLines;
    this.lines = [];
    this._textScale = textScale;
    this._highContrast = highContrast;

    this.scale.setScalar(1.2 / PANEL_WIDTH);
    this.position.copy(this.defaultPosition);

    this._content = new Text({
      text: '',
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this.add(this._content);

    this.render();
    this._patchConsole();
  }

  log(level: string, args: unknown[]): void {
    if (this._mirrorInProgress) return;
    const text = args
      .map((value) => {
        try {
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
        } catch {
          return '[unserializable]';
        }
      })
      .join(' ');

    const stamp = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    this.lines.push({ level, text: '[' + stamp + '] ' + text });
    if (this.lines.length > this.maxLines) {
      this.lines.splice(0, this.lines.length - this.maxLines);
    }
    this._projectionDirty = true;
  }

  update(): void {
    if (!this._projectionDirty) return;
    this._projectionDirty = false;
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
    if (this._mirrorInProgress) return;

    this._mirrorInProgress = true;
    try {
      const theme = getTheme(this._highContrast);
      this._content.setProperties({
        text: this.lines.map((line) => line.text).join('\n'),
        fontSize: 16 * this._textScale,
        color: Number(theme.textPrimary),
      });
    } finally {
      this._mirrorInProgress = false;
    }
  }

  _patchConsole(): void {
    if (this._originalConsole) return;
    this._originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    console.log = (...args: unknown[]) => {
      this._originalConsole?.log(...args);
      this.log('log', args);
    };
    console.warn = (...args: unknown[]) => {
      this._originalConsole?.warn(...args);
      this.log('warn', args);
    };
    console.error = (...args: unknown[]) => {
      this._originalConsole?.error(...args);
      this.log('error', args);
    };
  }

  unpatchConsole(): void {
    if (!this._originalConsole) return;
    console.log = this._originalConsole.log;
    console.warn = this._originalConsole.warn;
    console.error = this._originalConsole.error;
    this._originalConsole = null;
  }

  override dispose(): void {
    this.unpatchConsole();
    super.dispose();
  }
}
