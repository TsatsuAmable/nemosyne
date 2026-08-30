import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import { buildReviewBundle, formatReviewBundle } from '../../utils/ReviewBundle.ts';
import { downloadText } from '../../utils/Download.ts';
import type { Dataset } from '../../data/Dataset.ts';
import type {
  AccessibilityOptions,
  MovablePanelOptions,
  PerformanceBudgetLike,
  PrivacyLevel,
  TelemetryCollectorLike,
  TelemetryReport,
} from '../coordinators/types.ts';

interface TelemetryPanelOptions extends MovablePanelOptions {
  telemetry?: TelemetryCollectorLike | null;
  budget?: PerformanceBudgetLike | null;
  dataset?: Dataset | null;
  datasetTopology?: string;
  sessionDurationSeconds?: number;
  userNotes?: string;
  privacyLevel?: PrivacyLevel;
}

/**
 * In-VR panel showing live opt-in telemetry: frame timing, dropped frames,
 * session duration, gesture counts, operation counts, and recent errors.
 *
 * Nothing leaves the local session unless the user explicitly exports it.
 */
export class TelemetryPanel extends MovablePanel {
  telemetry: TelemetryCollectorLike | null;
  budget: PerformanceBudgetLike | null;
  dataset: Dataset | null;
  datasetTopology: string;
  sessionDurationSeconds: number;
  userNotes: string;
  privacyLevel: PrivacyLevel;
  fullSession: boolean;

  private _lastReport: TelemetryReport | null = null;

  constructor(cameraGroup: THREE.Group, options: TelemetryPanelOptions = {}) {
    super(cameraGroup, {
      title: 'TELEMETRY',
      width: 900,
      height: 720,
      position: options.position ?? [0.75, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.9, 0.72],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });

    this.telemetry = options.telemetry ?? null;
    this.budget = options.budget ?? null;
    this.dataset = options.dataset ?? null;
    this.datasetTopology = options.datasetTopology ?? '-';
    this.sessionDurationSeconds = options.sessionDurationSeconds ?? 0;
    this.userNotes = options.userNotes ?? '';
    this.privacyLevel = options.privacyLevel ?? 'metadata';
    this.fullSession = this.privacyLevel === 'full-session';

    this.render();
  }

  update(): void {
    if (!this.telemetry) return;
    const report = this.telemetry.getReport();
    if (this._sameReport(report)) return;
    this._lastReport = report;
    this.render();
  }

  private _sameReport(report: TelemetryReport): boolean {
    const last = this._lastReport;
    if (!last) return false;
    return (
      last.timestamp === report.timestamp &&
      last.frames.count === report.frames.count &&
      last.errors.count === report.errors.count &&
      last.session.durationSeconds === report.session.durationSeconds
    );
  }

  applyAccessibility(options: AccessibilityOptions): void {
    super.applyAccessibility(options);
    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 20;
    const lineH = 28;
    let y = pad;

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
    ctx.textAlign = 'left';

    const report = this.telemetry?.getReport();
    if (!report || !report.enabled) {
      ctx.fillText('Telemetry is disabled.', pad, y + lineH);
      ctx.font = '16px monospace';
      ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
      ctx.fillText('Enable it in Settings → Telemetry Opt-in.', pad, y + lineH * 2);
      return;
    }

    const { session, frames, operations, gestures, errors } = report;
    const sections: { title: string; lines: string[] }[] = [];

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
      ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
      ctx.fillText(`// ${section.title}`, pad, y + lineH);
      y += lineH + 6;
      ctx.font = '16px monospace';
      ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
      for (const line of section.lines) {
        ctx.fillText(line, pad + 8, y + lineH);
        y += lineH;
        if (y > contentH - pad) return;
      }
      y += 10;
    }

    // Export Review Bundle button.
    this._renderExportButton(ctx, w, contentH);
  }

  private _renderExportButton(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const btnW = 260;
    const btnH = 40;
    const pad = 20;
    const x = w - btnW - pad;
    const y = contentH - btnH - pad;

    // Button background.
    ctx.fillStyle = this.highContrast ? 'rgba(255,255,255,0.9)' : cssHex(COLOR_TOKENS.interaction.focus) + '26';
    ctx.fillRect(x, y, btnW, btnH);
    ctx.strokeStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.primary) : cssHex(COLOR_TOKENS.interaction.focus);
    ctx.lineWidth = this.highContrast ? 3 : 2;
    ctx.strokeRect(x, y, btnW, btnH);

    // Label.
    ctx.font = this._scaleFont('bold 16px monospace');
    ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.space.void) : cssHex(COLOR_TOKENS.interaction.focus);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXPORT REVIEW BUNDLE', x + btnW / 2, y + btnH / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Toggle label.
    ctx.font = this._scaleFont('14px monospace');
    ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.primary) : cssHex(COLOR_TOKENS.text.secondary);
    const label = this.fullSession ? 'full-session' : 'metadata';
    ctx.fillText(`level: ${label}`, pad, y + btnH / 2 + 5);
  }

  handleContentClick(worldRaycaster: THREE.Raycaster): boolean {
    const hits = worldRaycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;

    const uv = hits[0].uv;
    if (!uv) return false;
    const cx = uv.x * this.width;
    const cy = (1 - uv.y) * this.height;

    const contentH = this.height - this.titleBarHeight;
    const btnW = 260;
    const btnH = 40;
    const pad = 20;
    const bx = this.width - btnW - pad;
    const by = this.titleBarHeight + contentH - btnH - pad;

    // Click on the privacy-level label toggles between metadata and full-session.
    if (cx >= pad && cx <= pad + 140 && cy >= by && cy <= by + btnH) {
      this.fullSession = !this.fullSession;
      this.privacyLevel = this.fullSession ? 'full-session' : 'metadata';
      this.render();
      return true;
    }

    // Click on the export button downloads the bundle.
    if (cx >= bx && cx <= bx + btnW && cy >= by && cy <= by + btnH) {
      this._exportReviewBundle();
      return true;
    }

    return false;
  }

  private _exportReviewBundle(): void {
    if (!this.telemetry || !this.budget) return;

    const privacyLevel: PrivacyLevel = this.fullSession ? 'full-session' : 'metadata';
    const bundle = buildReviewBundle({
      telemetryCollector: this.telemetry,
      performanceBudget: this.budget,
      privacyLevel,
      dataset: this.dataset ?? undefined,
      datasetTopology: this.datasetTopology,
      sessionDurationSeconds: this.sessionDurationSeconds,
      userNotes: this.userNotes,
    });

    downloadText(formatReviewBundle(bundle), 'nemosyne-review-bundle.json', 'application/json').catch(
      () => {}
    );
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
