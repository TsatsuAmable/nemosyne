/* eslint-disable no-console -- VRConsole intercepts and restores console.log
   to mirror browser output into a world-space panel; referencing it is intentional. */
import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import type { MovablePanelOptions } from '../coordinators/types.ts';

interface VRConsoleOptions {
  maxLines?: number;
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

/**
 * In-VR console/log panel.
 *
 * Captures console.log / warn / error output and renders the most recent
 * messages to a world-space canvas texture. Useful for debugging the Meta
 * Quest 3S build without relying on PC DevTools.
 */
export class VRConsole extends MovablePanel {
  maxLines: number;
  lines: LogLine[];
  private _originalConsole: ConsolePatch | null = null;

  constructor(cameraGroup: THREE.Group, { maxLines = 24 }: VRConsoleOptions = {}) {
    const options: MovablePanelOptions = {
      title: 'LIVE VR CONSOLE',
      width: 1024,
      height: 720,
      position: [0, 1.45, -1.3],
      worldSize: [1.2, 0.84],
      titleBarHeight: 44,
      contentPadding: 16,
    };
    super(cameraGroup, options);

    this.maxLines = maxLines;
    this.lines = [];

    this._patchConsole();
    this.render();
  }

  log(level: string, args: unknown[]): void {
    const text = args
      .map((a) => {
        try {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
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

    this.lines.push({ level, text: `[${stamp}] ${text}` });
    if (this.lines.length > this.maxLines) {
      this.lines.shift();
    }
    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    ctx.font = '16px monospace';
    const lineH = 22;
    const topPad = 10;
    let y = topPad + lineH;

    const lines = this.lines ?? [];
    for (const line of lines) {
      switch (line.level) {
        case 'error':
          ctx.fillStyle = '#ff5555';
          break;
        case 'warn':
          ctx.fillStyle = '#ffaa00';
          break;
        case 'debug':
          ctx.fillStyle = '#88ccff';
          break;
        default:
          ctx.fillStyle = '#ccffcc';
      }
      ctx.fillText(line.text, 16, y);
      y += lineH;
      if (y > contentH - 8) break;
    }

    // Subtle scanline overlay.
    ctx.fillStyle = 'rgba(0, 255, 204, 0.03)';
    for (let yL = 0; yL < contentH; yL += 6) {
      ctx.fillRect(0, yL, w, 3);
    }
  }

  _patchConsole(): void {
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
}
