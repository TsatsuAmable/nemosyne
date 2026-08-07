import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import type {
  AccessibilityOptions,
  MovablePanelOptions,
  PerformanceBudgetLike,
  TelemetryCollectorLike,
  TelemetryReport,
} from '../coordinators/types.ts';

interface PerformancePanelOptions extends MovablePanelOptions {
  budget?: PerformanceBudgetLike | null;
  telemetry?: TelemetryCollectorLike | null;
}

interface PerformanceReport {
  tel: TelemetryReport | null;
  violations: ReturnType<PerformanceBudgetLike['getViolations']>;
  budgets: ReturnType<PerformanceBudgetLike['getBudgets']>;
}

/**
 * In-VR panel showing live performance budgets and recent violations.
 *
 * Works with the engine's PerformanceBudget instance to surface Quest Browser
 * profiling data without leaving VR.
 */
export class PerformancePanel extends MovablePanel {
  budget: PerformanceBudgetLike | null;
  telemetry: TelemetryCollectorLike | null;

  private _lastReport: PerformanceReport | null = null;

  constructor(cameraGroup: THREE.Group, options: PerformancePanelOptions = {}) {
    super(cameraGroup, {
      title: 'PERFORMANCE',
      width: 960,
      height: 720,
      position: options.position ?? [0.55, 1.6, -1.05],
      worldSize: options.worldSize ?? [0.96, 0.72],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });

    this.budget = options.budget ?? null;
    this.telemetry = options.telemetry ?? null;
    this._lastReport = null;
    this.render();
  }

  update(): void {
    if (!this.budget) return;
    const report = this._buildReport();
    const changed = JSON.stringify(report) !== JSON.stringify(this._lastReport);
    if (!changed) return;
    this._lastReport = report;
    this.render();
  }

  private _buildReport(): PerformanceReport {
    const tel = this.telemetry?.getReport?.() ?? null;
    const violations = this.budget?.getViolations?.() ?? [];
    const budgets = this.budget?.getBudgets?.() ?? {};
    return { tel, violations, budgets };
  }

  applyAccessibility(options: AccessibilityOptions): void {
    super.applyAccessibility(options);
    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, _w: number, contentH: number): void {
    const pad = 20;
    const lineH = 28;
    let y = pad;

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#00ffff';
    ctx.textAlign = 'left';

    const { tel, violations, budgets } = this._buildReport();

    if (!this.budget) {
      ctx.fillText('Performance budget not available.', pad, y + lineH);
      return;
    }

    // Telemetry summary.
    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#00ffff';
    ctx.fillText('// TELEMETRY', pad, y + lineH);
    y += lineH + 8;

    if (tel) {
      ctx.font = this._scaleFont('16px monospace');
      ctx.fillStyle = this.highContrast ? '#ffffff' : '#ccffff';
      const fps = tel.frames.lastMs > 0 ? (1000 / tel.frames.lastMs).toFixed(0) : '-';
      ctx.fillText(`Session: ${formatDuration(tel.session.durationSeconds)}`, pad + 8, y + lineH);
      y += lineH;
      ctx.fillText(
        `Frames: ${tel.frames.count}  Dropped: ${tel.frames.dropped}`,
        pad + 8,
        y + lineH
      );
      y += lineH;
      ctx.fillText(
        `Frame time: ${tel.frames.lastMs.toFixed(1)} ms (~${fps} fps)`,
        pad + 8,
        y + lineH
      );
      y += lineH;
      ctx.fillText(`Avg frame: ${tel.frames.averageMs.toFixed(1)} ms`, pad + 8, y + lineH);
      y += lineH;
    } else {
      ctx.font = this._scaleFont('16px monospace');
      ctx.fillStyle = '#88aaff';
      ctx.fillText(
        'Telemetry is disabled. Enable it in Settings → Telemetry Opt-in.',
        pad + 8,
        y + lineH
      );
      y += lineH * 2;
    }

    y += 10;

    // Budgets.
    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#00ffff';
    ctx.fillText('// BUDGETS', pad, y + lineH);
    y += lineH + 8;

    ctx.font = this._scaleFont('16px monospace');
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#ccffff';
    const budgetRows: [string, string][] = [
      ['Frame time', `${budgets.frameMs?.toFixed(1) ?? '-'} ms`],
      ['Draw calls', `${budgets.drawCalls ?? '-'}`],
      ['Triangles', `${(budgets.triangles ?? 0).toLocaleString()}`],
      ['Points', `${(budgets.points ?? 0).toLocaleString()}`],
      ['Interactables', `${budgets.interactables ?? '-'}`],
      ['Updatables', `${budgets.updatables ?? '-'}`],
      ['Panels', `${budgets.panels ?? '-'}`],
    ];
    for (const [label, value] of budgetRows) {
      ctx.fillText(`${label}: ${value}`, pad + 8, y + lineH);
      y += lineH;
    }

    y += 10;

    // Violations.
    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#00ffff';
    ctx.fillText('// VIOLATIONS', pad, y + lineH);
    y += lineH + 8;

    if (violations.length === 0) {
      ctx.font = this._scaleFont('16px monospace');
      ctx.fillStyle = this.highContrast ? '#ffffff' : '#88ffaa';
      ctx.fillText('No budget violations.', pad + 8, y + lineH);
    } else {
      ctx.font = this._scaleFont('16px monospace');
      for (const v of violations.slice(-8).reverse()) {
        const color = v.severity === 'critical' ? '#ff3355' : '#ffaa33';
        ctx.fillStyle = this.highContrast ? '#ffffff' : color;
        const time = new Date(v.time ?? Date.now()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        ctx.fillText(`${time} ${v.message}`, pad + 8, y + lineH);
        y += lineH;
        if (y > contentH - pad) return;
      }
    }
  }
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
