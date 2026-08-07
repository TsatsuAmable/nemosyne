import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import type { MovablePanelOptions } from '../coordinators/types.ts';

export interface OperationLogEntry {
  operation: string;
  rowCount?: number;
  timestamp?: number;
}

interface OperationLogPanelOptions {
  position?: [number, number, number];
  worldSize?: [number, number];
}

/**
 * Read-only panel showing a chronological list of applied analysis operations.
 * Provides lightweight provenance so the user can see how the current palace
 * state was reached.
 */
export class OperationLogPanel extends MovablePanel {
  entries: OperationLogEntry[];

  constructor(cameraGroup: THREE.Group, options: OperationLogPanelOptions = {}) {
    const movableOptions: MovablePanelOptions = {
      title: 'OPERATION LOG',
      width: 800,
      height: 640,
      position: options.position ?? [-0.65, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.8, 0.64],
      titleBarHeight: 44,
      tilt: 0.22,
    };
    super(cameraGroup, movableOptions);

    this.entries = [];
    this.render();
  }

  /**
   * Replace the current operation log and re-render.
   */
  setEntries(entries: OperationLogEntry[]): void {
    this.entries = entries.slice().reverse(); // newest first
    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 18;
    const lineH = 28;
    let y = pad;

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'left';
    ctx.fillText('// Recent operations', pad, y);
    y += lineH + 8;

    if (this.entries.length === 0) {
      ctx.font = '16px monospace';
      ctx.fillStyle = '#88aaff';
      ctx.fillText('No operations yet.', pad, y);
      return;
    }

    ctx.font = '16px monospace';
    for (const entry of this.entries.slice(0, 18)) {
      const time = entry.timestamp
        ? new Date(entry.timestamp).toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '--:--:--';
      const suffix = entry.rowCount != null ? ` — ${entry.rowCount} rows` : '';
      const text = `${time}  ${entry.operation}${suffix}`;
      ctx.fillStyle = '#ccffff';
      ctx.fillText(text, pad, y);
      y += lineH;
      if (y > contentH - pad) break;
    }
  }
}
