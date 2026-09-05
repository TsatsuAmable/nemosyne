import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import type { WorldEventBusLike, MovablePanelOptions } from '../coordinators/types.ts';
import type { BrowserValidationContext } from '../../validation/browser-validation-session.ts';
import type {
  QualificationProgress,
  ValidationDeliveryReceipt,
  ValidationServerStatus,
} from '../../validation/validation-delivery.ts';
import {
  GUIDED_UX_SCHEMA_VERSION,
  GUIDED_UX_TASKS,
  type GuidedComfortOutcome,
  type GuidedUxInputModality,
  type GuidedUxOutcome,
  type GuidedUxSubmission,
  type GuidedUxTaskResult,
} from '../../validation/guided-ux-validation.ts';

interface BtnRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  disabled?: boolean;
}

interface LoadTestSample {
  spec: { durationSec: number; rowCount: number; label?: string };
  elapsedMs: number;
  frames: { p95Ms: number; fpsAvg: number; droppedPct: number };
}

interface BoundaryProgress {
  phase: string;
  progressPercent: number;
}

export type ValidationDeliveryUiState =
  | { status: 'idle'; message: string }
  | { status: 'sending'; message: string }
  | { status: 'captured'; message: string; receivedAt: string }
  | { status: 'downloaded'; message: string; receivedAt: string }
  | { status: 'failed'; message: string };

interface ValidationOperatorPanelOptions extends MovablePanelOptions {
  context: BrowserValidationContext;
  eventBus: WorldEventBusLike;
  onStartPerformance: () => void;
  onStartBoundary: () => void;
  onStop: () => void;
  onFlush: () => void;
  onDownload: () => Promise<void>;
  onRefreshStatus: () => Promise<void>;
  onSubmitUx: (submission: GuidedUxSubmission) => Promise<void>;
}

/**
 * QV5/QV6 headset-side operator surface.
 *
 * This panel never derives promotion truth. It displays the launcher-owned,
 * schema-validated manifest and server-owned delivery/progress receipts.
 */
export class ValidationOperatorPanel extends MovablePanel {
  private readonly _context: BrowserValidationContext;
  private readonly _eventBus: WorldEventBusLike;
  private readonly _onStartPerformance: () => void;
  private readonly _onStartBoundary: () => void;
  private readonly _onStop: () => void;
  private readonly _onFlush: () => void;
  private readonly _onDownload: () => Promise<void>;
  private readonly _onRefreshStatus: () => Promise<void>;
  private readonly _onSubmitUx: (submission: GuidedUxSubmission) => Promise<void>;
  private readonly _unsubs: Array<() => void> = [];
  private _buttons: BtnRect[] = [];
  private _dirty = true;
  private _sample: LoadTestSample | null = null;
  private _boundary: BoundaryProgress | null = null;
  private _runMessage = 'Idle';
  private _delivery: ValidationDeliveryUiState = { status: 'idle', message: 'No evidence delivered yet.' };
  private _serverStatus: ValidationServerStatus | null = null;
  private _progress: QualificationProgress | null = null;
  private _armed: 'performance' | 'boundary' | null = null;
  private _armedUntil = 0;
  private _uxModality: GuidedUxInputModality = 'controller';
  private _uxIndex = 0;
  private _uxResults: GuidedUxTaskResult[] = [];
  private _comfort: GuidedComfortOutcome | null = null;
  private _uxSubmitted = false;

  constructor(cameraGroup: THREE.Group, options: ValidationOperatorPanelOptions) {
    super(cameraGroup, {
      title: 'DEVICE VALIDATION',
      width: 980,
      height: 900,
      position: options.position ?? [-0.9, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.98, 0.9],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });
    this._context = options.context;
    this._eventBus = options.eventBus;
    this._onStartPerformance = options.onStartPerformance;
    this._onStartBoundary = options.onStartBoundary;
    this._onStop = options.onStop;
    this._onFlush = options.onFlush;
    this._onDownload = options.onDownload;
    this._onRefreshStatus = options.onRefreshStatus;
    this._onSubmitUx = options.onSubmitUx;

    this._unsubs.push(
      this._eventBus.on(WorldTopics.LOADTEST_SAMPLE, (payload) => {
        this._sample = payload as LoadTestSample;
        this._runMessage = 'Performance run active';
        this._dirty = true;
      })
    );
    this._unsubs.push(
      this._eventBus.on(WorldTopics.LOADTEST_COMPLETE, () => {
        this._sample = null;
        this._runMessage = 'Performance run complete; delivering evidence…';
        this._dirty = true;
      })
    );
    this._unsubs.push(
      this._eventBus.on(WorldTopics.QUEST_BOUNDARY_PROGRESS, (payload) => {
        this._boundary = payload as BoundaryProgress;
        this._runMessage = '10M boundary active';
        this._dirty = true;
      })
    );
    this._unsubs.push(
      this._eventBus.on(WorldTopics.QUEST_BOUNDARY_COMPLETE, () => {
        this._boundary = null;
        this._runMessage = '10M boundary complete; delivering evidence…';
        this._dirty = true;
      })
    );

    this.render();
    queueMicrotask(() => {
      void this._refresh();
    });
  }

  update(): void {
    if (this._armed && performance.now() > this._armedUntil) {
      this._armed = null;
      this._dirty = true;
    }
    if (this._dirty) {
      this._dirty = false;
      this.render();
    }
  }

  dispose(): void {
    for (const unsub of this._unsubs) unsub();
    this._unsubs.length = 0;
  }

  setDeliverySending(message = 'Delivering evidence…'): void {
    this._delivery = { status: 'sending', message };
    this._dirty = true;
  }

  setDeliveryReceipt(receipt: ValidationDeliveryReceipt): void {
    this._delivery = {
      status: 'captured',
      message: `Captured: ${receipt.artifact}`,
      receivedAt: receipt.receivedAt,
    };
    this._progress = receipt.progress;
    this._dirty = true;
  }

  setDeliveryFailure(message: string): void {
    this._delivery = { status: 'failed', message };
    this._dirty = true;
  }

  setDownloaded(message = 'Fallback file download requested.'): void {
    this._delivery = { status: 'downloaded', message, receivedAt: new Date().toISOString() };
    this._dirty = true;
  }

  setServerStatus(status: ValidationServerStatus): void {
    this._serverStatus = status;
    this._progress = status.progress;
    this._dirty = true;
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 20;
    const lineH = 25;
    let y = pad;
    this._buttons = [];
    const manifest = this._context.manifest;
    const device = manifest.deviceIdentity;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
    ctx.fillText('// GOVERNED SESSION', pad, y + lineH);
    y += lineH + 4;

    ctx.font = this._scaleFont('15px monospace');
    const eligible = manifest.promotionEligible && this._context.attributable;
    ctx.fillStyle = eligible
      ? cssHex(COLOR_TOKENS.status.verified)
      : cssHex(COLOR_TOKENS.danger.destructive);
    ctx.fillText(
      `${eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'} · ${manifest.validationMode} · ${manifest.gates.join(', ') || 'no gate'}`,
      pad + 8,
      y + lineH
    );
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.fillText(`Session: ${manifest.sessionLabel}`, pad + 8, y + lineH * 2);
    ctx.fillText(`Build: ${manifest.buildId.slice(0, 12)} · tree ${manifest.worktree.toUpperCase()}`, pad + 8, y + lineH * 3);
    ctx.fillText(
      `Device: ${device?.model ?? 'UNAVAILABLE'} · firmware/build ${device?.buildIncremental ?? manifest.declaredFirmwareVersion ?? 'UNAVAILABLE'}`,
      pad + 8,
      y + lineH * 4
    );
    ctx.fillText(
      `Identity: ${device?.captureBasis ?? 'investigator-declared/unavailable'} · evidence ${manifest.evidenceClass}`,
      pad + 8,
      y + lineH * 5
    );
    y += lineH * 5 + 8;

    if (!this._context.attributable || manifest.invalidations.length > 0) {
      ctx.fillStyle = cssHex(COLOR_TOKENS.epistemic.uncertain);
      const reason = this._context.attributionIssue ?? manifest.invalidations[0] ?? 'Run cannot support promotion-grade claims.';
      ctx.fillText(this._truncate(ctx, `Reason: ${reason}`, w - pad * 2 - 8), pad + 8, y + lineH);
      y += lineH + 6;
    }

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
    ctx.fillText('// EVIDENCE', pad, y + lineH);
    y += lineH + 4;
    ctx.font = this._scaleFont('15px monospace');
    const progress = this._progress;
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.fillText(
      progress
        ? `Same build/device: render ${Math.min(progress.renderCompleted, progress.target)}/${progress.target} · boundary ${Math.min(progress.boundaryAttempts, progress.target)}/${progress.target}`
        : 'Same build/device progress: not yet confirmed by evidence sink.',
      pad + 8,
      y + lineH
    );
    const deliveryColor = this._delivery.status === 'captured'
      ? cssHex(COLOR_TOKENS.status.verified)
      : this._delivery.status === 'failed'
        ? cssHex(COLOR_TOKENS.danger.destructive)
        : cssHex(COLOR_TOKENS.text.secondary);
    ctx.fillStyle = deliveryColor;
    const deliveredAt = 'receivedAt' in this._delivery
      ? ` · ${this._delivery.receivedAt.slice(11, 19)}Z`
      : '';
    ctx.fillText(this._truncate(ctx, `${this._delivery.message}${deliveredAt}`, w - pad * 2 - 8), pad + 8, y + lineH * 2);
    const disposition = this._serverStatus?.gateDisposition;
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.fillText(
      `Disposition: ${disposition?.status ?? 'PENDING'}${disposition?.reasons?.[0] ? ` · ${disposition.reasons[0]}` : ''}`,
      pad + 8,
      y + lineH * 3
    );
    y += lineH * 3 + 10;

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
    ctx.fillText('// RUN', pad, y + lineH);
    y += lineH + 4;
    ctx.font = this._scaleFont('15px monospace');
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.fillText(this._runMessage, pad + 8, y + lineH);
    if (this._sample) {
      const pct = Math.min(100, (this._sample.elapsedMs / (this._sample.spec.durationSec * 1000)) * 100);
      ctx.fillText(
        `Rows ${this._sample.spec.rowCount} · ${pct.toFixed(0)}% · p95 ${this._sample.frames.p95Ms.toFixed(1)}ms · ${this._sample.frames.fpsAvg.toFixed(0)}fps · drop ${this._sample.frames.droppedPct.toFixed(1)}%`,
        pad + 8,
        y + lineH * 2
      );
      y += lineH;
    } else if (this._boundary) {
      ctx.fillText(`10M ${this._boundary.phase} · ${this._boundary.progressPercent.toFixed(1)}%`, pad + 8, y + lineH * 2);
      y += lineH;
    }
    y += lineH + 10;

    if (manifest.validationMode === 'quest-ux') {
      y = this._renderUxRunner(ctx, w, y, lineH);
    } else {
      this._renderRunGuidance(ctx, w, y, lineH);
    }

    this._renderButtons(ctx, w, contentH);
  }

  private _renderRunGuidance(ctx: CanvasRenderingContext2D, w: number, y: number, lineH: number): void {
    const pad = 20;
    ctx.font = this._scaleFont('15px monospace');
    ctx.fillStyle = cssHex(COLOR_TOKENS.epistemic.uncertain);
    const mode = this._context.manifest.validationMode;
    let text = 'This mode does not own a governed on-device run. Restart with an explicit validation lane.';
    if (mode === 'quest-perf') {
      text = this._armed === 'performance'
        ? 'CONFIRM within 10 seconds: run the governed Quest 3S staircase. Evidence must land to count.'
        : 'Quest 3S performance staircase. Arm first, then confirm. Protocol requires ≥3 captured runs.';
    } else if (mode === 'quest-10m') {
      text = this._armed === 'boundary'
        ? 'CONFIRM within 10 seconds: allocate/build the 10M synthetic boundary workload. Browser termination is possible.'
        : '10M synthetic boundary exercise: large allocation, non-qualification evidence. Arm first, then confirm.';
    }
    this._wrapText(ctx, text, pad + 8, y, w - pad * 2 - 8, lineH, y + lineH * 3);
  }

  private _renderUxRunner(ctx: CanvasRenderingContext2D, w: number, y: number, lineH: number): number {
    const pad = 20;
    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
    ctx.fillText('// GUIDED PHYSICAL UX', pad, y + lineH);
    y += lineH + 4;
    ctx.font = this._scaleFont('15px monospace');
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.fillText(`Input modality: ${this._uxModality.toUpperCase()} (investigator-selected)`, pad + 8, y + lineH);
    if (this._uxIndex < GUIDED_UX_TASKS.length) {
      const task = GUIDED_UX_TASKS[this._uxIndex];
      ctx.fillText(`Task ${this._uxIndex + 1}/${GUIDED_UX_TASKS.length}: ${task.label}`, pad + 8, y + lineH * 2);
      this._wrapText(ctx, task.instruction, pad + 8, y + lineH * 2, w - pad * 2 - 8, lineH, y + lineH * 4);
      y += lineH * 4;
    } else {
      ctx.fillText(`Tasks recorded: ${this._uxResults.length}/${GUIDED_UX_TASKS.length}`, pad + 8, y + lineH * 2);
      ctx.fillText(`Comfort: ${this._comfort?.toUpperCase() ?? 'NOT RECORDED'}`, pad + 8, y + lineH * 3);
      ctx.fillText(this._uxSubmitted ? 'Guided UX evidence delivered.' : 'Record comfort, then SUBMIT.', pad + 8, y + lineH * 4);
      y += lineH * 4;
    }
    return y;
  }

  private _renderButtons(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 20;
    const gap = 8;
    const btnH = 40;
    const y1 = contentH - btnH * 2 - pad - gap;
    const y2 = contentH - btnH - pad;
    const mode = this._context.manifest.validationMode;

    if (mode === 'quest-ux') {
      const row1 = [
        { id: 'modality-controller', label: 'CONTROLLER' },
        { id: 'modality-hand', label: 'HAND' },
        { id: 'ux-pass', label: 'PASS' },
        { id: 'ux-fail', label: 'FAIL' },
        { id: 'ux-skip', label: 'NOT RUN' },
      ];
      this._drawRow(ctx, row1, y1, w, pad, gap, btnH);
      const row2 = [
        { id: 'comfort-ok', label: 'COMFORT OK' },
        { id: 'comfort-issue', label: 'COMFORT ISSUE' },
        { id: 'comfort-skip', label: 'COMFORT N/R' },
        { id: 'ux-submit', label: 'SUBMIT' },
        { id: 'refresh', label: 'REFRESH' },
      ];
      this._drawRow(ctx, row2, y2, w, pad, gap, btnH);
      return;
    }

    const runId = mode === 'quest-perf' ? 'run-performance' : mode === 'quest-10m' ? 'run-boundary' : 'run-disabled';
    const runLabel = mode === 'quest-perf'
      ? this._armed === 'performance' ? 'CONFIRM PERF' : 'ARM PERF'
      : mode === 'quest-10m'
        ? this._armed === 'boundary' ? 'CONFIRM 10M' : 'ARM 10M'
        : 'NO RUN';
    this._drawRow(
      ctx,
      [
        { id: runId, label: runLabel, disabled: runId === 'run-disabled' },
        { id: 'stop', label: 'STOP' },
        { id: 'flush', label: 'FLUSH' },
        { id: 'download', label: 'DOWNLOAD' },
        { id: 'refresh', label: 'REFRESH' },
      ],
      y2,
      w,
      pad,
      gap,
      btnH
    );
  }

  private _drawRow(
    ctx: CanvasRenderingContext2D,
    items: Array<{ id: string; label: string; disabled?: boolean }>,
    y: number,
    w: number,
    pad: number,
    gap: number,
    btnH: number
  ): void {
    const width = Math.floor((w - pad * 2 - gap * (items.length - 1)) / items.length);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const x = pad + i * (width + gap);
      const selected =
        (item.id === 'modality-controller' && this._uxModality === 'controller') ||
        (item.id === 'modality-hand' && this._uxModality === 'hand');
      ctx.fillStyle = item.disabled
        ? 'rgba(120,120,120,0.15)'
        : selected
          ? cssHex(COLOR_TOKENS.status.verified) + '40'
          : cssHex(COLOR_TOKENS.interaction.focus) + '26';
      ctx.fillRect(x, y, width, btnH);
      ctx.strokeStyle = item.disabled
        ? cssHex(COLOR_TOKENS.text.secondary)
        : selected
          ? cssHex(COLOR_TOKENS.status.verified)
          : cssHex(COLOR_TOKENS.interaction.focus);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, btnH);
      ctx.font = this._scaleFont('bold 13px monospace');
      ctx.fillStyle = item.disabled ? cssHex(COLOR_TOKENS.text.secondary) : cssHex(COLOR_TOKENS.interaction.focus);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, x + width / 2, y + btnH / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      this._buttons.push({ id: item.id, x, y, w: width, h: btnH, disabled: item.disabled });
    }
  }

  handleContentClick(worldRaycaster: THREE.Raycaster): boolean {
    const hits = worldRaycaster.intersectObject(this.mesh, false);
    if (hits.length === 0 || !hits[0].uv) return false;
    const uv = hits[0].uv;
    const cx = uv.x * this.width;
    const cy = (1 - uv.y) * this.height;
    for (const button of this._buttons) {
      if (
        !button.disabled &&
        cx >= button.x &&
        cx <= button.x + button.w &&
        cy >= button.y &&
        cy <= button.y + button.h
      ) {
        this._dispatch(button.id);
        return true;
      }
    }
    return false;
  }

  private _dispatch(id: string): void {
    switch (id) {
      case 'run-performance':
        this._confirmOrRun('performance');
        break;
      case 'run-boundary':
        this._confirmOrRun('boundary');
        break;
      case 'stop':
        this._onStop();
        this._runMessage = 'Stop requested.';
        break;
      case 'flush':
        this._onFlush();
        break;
      case 'download':
        void this._download();
        break;
      case 'refresh':
        void this._refresh();
        break;
      case 'modality-controller':
        this._uxModality = 'controller';
        break;
      case 'modality-hand':
        this._uxModality = 'hand';
        break;
      case 'ux-pass':
        this._recordUx('pass');
        break;
      case 'ux-fail':
        this._recordUx('fail');
        break;
      case 'ux-skip':
        this._recordUx('not-run');
        break;
      case 'comfort-ok':
        this._comfort = 'comfortable';
        break;
      case 'comfort-issue':
        this._comfort = 'issue';
        break;
      case 'comfort-skip':
        this._comfort = 'not-run';
        break;
      case 'ux-submit':
        void this._submitUx();
        break;
      default:
        break;
    }
    this._dirty = true;
  }

  private _confirmOrRun(action: 'performance' | 'boundary'): void {
    const now = performance.now();
    if (this._armed !== action || now > this._armedUntil) {
      this._armed = action;
      this._armedUntil = now + 10_000;
      this._runMessage = `Armed ${action}; confirm within 10 seconds.`;
      return;
    }
    this._armed = null;
    this._runMessage = `${action} start requested.`;
    if (action === 'performance') this._onStartPerformance();
    else this._onStartBoundary();
  }

  private _recordUx(outcome: GuidedUxOutcome): void {
    if (this._uxIndex >= GUIDED_UX_TASKS.length || this._uxSubmitted) return;
    const task = GUIDED_UX_TASKS[this._uxIndex];
    this._uxResults.push({
      taskId: task.id,
      outcome,
      inputModality: this._uxModality,
      modalityBasis: 'investigator-selected',
      recordedAt: new Date().toISOString(),
      note: null,
    });
    this._uxIndex += 1;
  }

  private async _submitUx(): Promise<void> {
    if (
      this._uxSubmitted ||
      this._uxResults.length !== GUIDED_UX_TASKS.length ||
      this._comfort === null
    ) {
      return;
    }
    const manifest = this._context.manifest;
    const now = new Date().toISOString();
    const submission: GuidedUxSubmission = {
      schemaVersion: GUIDED_UX_SCHEMA_VERSION,
      sessionId: manifest.sessionId,
      sessionLabel: manifest.sessionLabel,
      buildId: manifest.buildId,
      deviceBuildFingerprint: manifest.deviceIdentity?.buildFingerprint ?? null,
      evidenceKind: 'guided-physical-ux',
      results: [...this._uxResults],
      comfortObservation: { outcome: this._comfort, recordedAt: now, note: null },
      completedAt: now,
    };
    this.setDeliverySending('Delivering guided UX evidence…');
    try {
      await this._onSubmitUx(submission);
      this._uxSubmitted = true;
    } catch (error) {
      this.setDeliveryFailure(error instanceof Error ? error.message : String(error));
    }
  }

  private async _download(): Promise<void> {
    try {
      await this._onDownload();
      this.setDownloaded();
    } catch (error) {
      this.setDeliveryFailure(error instanceof Error ? error.message : String(error));
    }
  }

  private async _refresh(): Promise<void> {
    try {
      await this._onRefreshStatus();
    } catch (error) {
      this.setDeliveryFailure(`Status refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private _truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let value = text;
    while (value.length > 1 && ctx.measureText(value + '…').width > maxWidth) value = value.slice(0, -1);
    return value + '…';
  }

  private _wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineH: number,
    maxY: number
  ): number {
    const words = text.split(/\s+/);
    let line = '';
    let cy = y;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        ctx.fillText(line, x, cy + lineH);
        cy += lineH;
        if (cy > maxY) return cy;
        line = word;
      } else {
        line = next;
      }
    }
    if (line && cy <= maxY) {
      ctx.fillText(line, x, cy + lineH);
      cy += lineH;
    }
    return cy;
  }
}
