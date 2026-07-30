import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.js';

/**
 * In-VR panel showing live opt-in telemetry: frame timing, dropped frames,
 * session duration, gesture counts, operation counts, and recent errors.
 *
 * Nothing leaves the local session unless the user explicitly exports it.
 */
export class TelemetryPanel extends MovablePanel {
  constructor(cameraGroup, options = {}) {
    super(cameraGroup, {
      title: 'TELEMETRY',
      width: 900,
      height: 720,
      position: options.position ?? [0.75, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.9, 0.72],
      titleBarHeight: 44,
      tilt: 0.22,
    });

    this.telemetry = options.telemetry ?? null;
    this._lastReport = null;
    this.render();
  }

  update() {
    if (!this.telemetry) return;
    const report = this.telemetry.getReport();
    if (this._sameReport(report)) return;
    this._lastReport = report;
    this.render();
  }

  _sameReport(report) {
    const last = this._lastReport;
    if (!last) return false;
    return (
      last.timestamp === report.timestamp &&
      last.frames.count === report.frames.count &&
      last.errors.count === report.errors.count &&
      last.session.durationSeconds === report.session.durationSeconds
    );
  }

  renderContent(ctx, w, contentH) {
    const pad = 20;
    const lineH = 28;
    let y = pad;

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'left';

    const report = this.telemetry?.getReport();
    if (!report || !report.enabled) {
      ctx.fillText('Telemetry is disabled.', pad, y + lineH);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#88aaff';
      ctx.fillText('Enable it in Settings → Telemetry Opt-in.', pad, y + lineH * 2);
      return;
    }

    const { session, frames, operations, gestures, errors } = report;
    const sections = [];

    sections.push({
      title: 'SESSION',
      lines: [
        `Duration: ${formatDuration(session.durationSeconds)}`,
        `Dataset: ${session.datasetName} (${session.datasetTopology})`,
      ],
    });

    const fps = frames.lastMs > 0 ? (1000 / frames.lastMs).toFixed(0) : '-';
    const avgMs = frames.averageMs.toFixed(1);
    sections.push({
      title: 'PERFORMANCE',
      lines: [
        `Frames: ${frames.count}  Dropped: ${frames.dropped}`,
        `Last frame: ${frames.lastMs.toFixed(1)} ms (~${fps} fps)`,
        `Average frame: ${avgMs} ms`,
        `Budget: ${frames.histogram.under16} smooth / ${frames.histogram.under33} ok / ${frames.histogram.under50} slow / ${frames.histogram.under100 + frames.histogram.over100} bad`,
      ],
    });

    sections.push({
      title: 'OPERATIONS',
      lines: Object.keys(operations).length
        ? Object.entries(operations).map(([op, n]) => `${op}: ${n}`)
        : ['No operations yet.'],
    });

    sections.push({
      title: 'GESTURES',
      lines: Object.keys(gestures).length
        ? Object.entries(gestures).map(([g, n]) => `${g}: ${n}`)
        : ['No gestures yet.'],
    });

    sections.push({
      title: 'ERRORS',
      lines: [
        `Errors: ${errors.count}  Warnings: ${errors.warnings}  Rejections: ${errors.unhandledRejections}`,
        errors.last ? `Last: ${errors.last.message}` : 'No errors recorded.',
      ],
    });

    for (const section of sections) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#00ffff';
      ctx.fillText(`// ${section.title}`, pad, y + lineH);
      y += lineH + 6;
      ctx.font = '16px monospace';
      ctx.fillStyle = '#ccffff';
      for (const line of section.lines) {
        ctx.fillText(line, pad + 8, y + lineH);
        y += lineH;
        if (y > contentH - pad) return;
      }
      y += 10;
    }
  }
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
