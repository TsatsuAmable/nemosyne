import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { downloadText } from '../../utils/Download.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import type { WorldEventBusLike, MovablePanelOptions } from '../coordinators/types.ts';
import {
  DEFAULT_LOAD_TEST_PROFILE,
  type LoadTestDriver,
  type LoadTestProfile,
  type LoadTestSummary,
} from '../scalability/LoadTestDriver.ts';
import type { StepFrameStats, VerdictGrade } from '../scalability/LoadTestThresholds.ts';

/** Live sample payload emitted on LOADTEST_SAMPLE. */
interface LoadTestSample {
  stepIndex: number;
  totalSteps: number;
  spec: { topology: string; rowCount: number; durationSec: number; label?: string };
  elapsedMs: number;
  frameCount: number;
  frames: StepFrameStats;
  gpu: { drawCalls: number; triangles: number; points: number; lines: number };
  criticalFrames: number;
}

/** Step transition payload emitted on LOADTEST_STEP. */
interface LoadTestStepEvent {
  phase: string;
  stepIndex: number;
  totalSteps: number;
  spec?: { topology: string; rowCount: number; durationSec: number; label?: string };
  result?: { grade: VerdictGrade; reasons: string[]; spec: { rowCount: number }; frames: StepFrameStats };
  partial?: boolean;
}

interface LoadTestPanelOptions extends MovablePanelOptions {
  driver: LoadTestDriver;
  eventBus: WorldEventBusLike;
  /** Start a run with the given profile (World wraps telemetry-consent around it). */
  onStart?: (profile: LoadTestProfile) => void;
  onStop?: () => void;
  /** Re-POST the last summary to the local dev-server log endpoint. */
  onFlush?: () => void;
}

interface BtnRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const GRADE_COLOR: Record<VerdictGrade, string> = {
  green: '#00ff66',
  yellow: '#ffcc00',
  red: '#ff3344',
};

/** Single-N presets + the full staircase. Clicking one starts that run. */
function singleStepProfile(rowCount: number, durationSec: number, label: string): LoadTestProfile {
  return {
    name: `single-${label}`,
    settleSec: 2,
    steps: [{ topology: 'TABULAR', rowCount, durationSec, label }],
  };
}

const SIZE_PRESETS: { id: string; label: string; profile: LoadTestProfile }[] = [
  { id: '1k', label: '1k', profile: singleStepProfile(1_000, 20, '1k') },
  { id: '8k', label: '8k', profile: singleStepProfile(8_000, 20, '8k') },
  { id: '65k', label: '65k', profile: singleStepProfile(65_000, 30, '65k') },
  { id: '100k', label: '100k', profile: singleStepProfile(100_000, 30, '100k') },
  { id: '250k', label: '250k', profile: singleStepProfile(250_000, 30, '250k') },
  { id: 'full', label: 'Full', profile: DEFAULT_LOAD_TEST_PROFILE },
];

/**
 * In-VR panel for the load-test harness. Shows live per-frame p50/p95/p99, FPS,
 * dropped rate, GPU counters, and the green/yellow/red verdict as the staircase
 * runs; on completion shows the overall recommendation (whether the command
 * buffer is warranted and the perf level it must meet). Buttons start a single-N
 * or full-staircase run, stop, flush the summary to the local dev-server log,
 * and download it.
 *
 * The panel only displays perf/UX aggregates computed by the driver — never
 * user dataset rows or session snapshots.
 */
export class LoadTestPanel extends MovablePanel {
  private readonly _driver: LoadTestDriver;
  private readonly _onStart?: (profile: LoadTestProfile) => void;
  private readonly _onStop?: () => void;
  private readonly _onFlush?: () => void;
  private _lastSample: LoadTestSample | null = null;
  private _lastStep: LoadTestStepEvent | null = null;
  private _lastSummary: LoadTestSummary | null = null;
  private _dirty = true;
  private _buttons: BtnRect[] = [];
  private _unsubs: Array<() => void> = [];

  constructor(cameraGroup: THREE.Group, options: LoadTestPanelOptions) {
    super(cameraGroup, {
      title: 'LOAD TEST',
      width: 920,
      height: 820,
      position: options.position ?? [-0.9, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.92, 0.82],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });
    this._driver = options.driver;
    this._onStart = options.onStart;
    this._onStop = options.onStop;
    this._onFlush = options.onFlush;

    // Subscribe to load-test events for live display. Handlers set a dirty flag;
    // the actual canvas re-render happens in update() to avoid mid-event writes.
    const bus = options.eventBus;
    this._unsubs.push(
      bus.on(WorldTopics.LOADTEST_SAMPLE, (p) => {
        this._lastSample = p as LoadTestSample;
        this._dirty = true;
      })
    );
    this._unsubs.push(
      bus.on(WorldTopics.LOADTEST_STEP, (p) => {
        this._lastStep = p as LoadTestStepEvent;
        this._dirty = true;
      })
    );
    this._unsubs.push(
      bus.on(WorldTopics.LOADTEST_COMPLETE, (p) => {
        this._lastSummary = p as LoadTestSummary;
        this._lastSample = null;
        this._dirty = true;
      })
    );

    this.render();
  }

  update(): void {
    if (this._dirty) {
      this._dirty = false;
      this.render();
    }
  }

  dispose(): void {
    for (const unsub of this._unsubs) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    this._unsubs = [];
  }

  /** Holds the last completed summary so World can flush/download it. */
  get lastSummary(): LoadTestSummary | null {
    return this._lastSummary;
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 20;
    const lineH = 26;
    let y = pad;
    this._buttons = [];

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const driver = this._driver;
    const phase = driver.phase;
    const cur = driver.currentStep;
    const total = driver.totalSteps;
    const idx = driver.stepIndex;

    // --- STATUS ---
    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = '#00ffff';
    ctx.fillText('// STATUS', pad, y + lineH);
    y += lineH + 4;
    ctx.font = this._scaleFont('15px monospace');
    ctx.fillStyle = '#ccffff';
    const stepLabel = cur ? `${cur.label ?? cur.rowCount} (${cur.topology})` : '-';
    ctx.fillText(`Phase: ${phase}`, pad + 8, y + lineH);
    ctx.fillText(`Step: ${idx}/${total}  ${stepLabel}`, pad + 8, y + lineH * 2);
    y += lineH * 2 + 8;

    // --- LIVE METRICS (from last sample) ---
    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = '#00ffff';
    ctx.fillText('// LIVE METRICS', pad, y + lineH);
    y += lineH + 4;

    const s = this._lastSample;
    ctx.font = this._scaleFont('15px monospace');
    ctx.fillStyle = '#ccffff';
    if (s) {
      const f = s.frames;
      const progress = Math.min(100, (s.elapsedMs / (s.spec.durationSec * 1000)) * 100);
      ctx.fillText(`p50 ${f.p50Ms.toFixed(1)}  p95 ${f.p95Ms.toFixed(1)}  p99 ${f.p99Ms.toFixed(1)} ms`, pad + 8, y + lineH);
      ctx.fillText(`fps ${f.fpsAvg.toFixed(0)}  dropped ${f.droppedPct.toFixed(1)}%  gc-spikes ${f.gcSpikes}`, pad + 8, y + lineH * 2);
      ctx.fillText(`draw ${s.gpu.drawCalls}  tri ${s.gpu.triangles}  pts ${s.gpu.points}  lines ${s.gpu.lines}`, pad + 8, y + lineH * 3);
      ctx.fillText(`frames ${s.frameCount}  progress ${progress.toFixed(0)}%  crit ${s.criticalFrames}`, pad + 8, y + lineH * 4);
      y += lineH * 4 + 8;
    } else {
      ctx.fillText('Idle — select a size to start.', pad + 8, y + lineH);
      y += lineH + 8;
    }

    // --- VERDICT (completed steps + overall) ---
    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = '#00ffff';
    ctx.fillText('// VERDICT', pad, y + lineH);
    y += lineH + 4;

    const summary = this._lastSummary;
    if (summary) {
      ctx.font = this._scaleFont('15px monospace');
      for (const step of summary.steps) {
        const color = GRADE_COLOR[step.grade] ?? '#ccffff';
        const reasons = step.reasons.length ? ` — ${step.reasons.join('; ')}` : '';
        ctx.fillStyle = color;
        const line = `${step.spec.rowCount}: ${step.grade.toUpperCase()}${reasons}`;
        ctx.fillText(this._truncate(ctx, line, w - pad * 2 - 8), pad + 8, y + lineH);
        y += lineH;
        if (y > contentH - 180) break;
      }
      // Overall recommendation.
      ctx.fillStyle = '#88ffcc';
      ctx.font = this._scaleFont('bold 15px monospace');
      y = this._wrapText(ctx, summary.verdict.recommendation, pad + 8, y, w - pad * 2 - 8, lineH, contentH - 130);
      y += 6;
    } else {
      ctx.font = this._scaleFont('15px monospace');
      ctx.fillStyle = '#88aaff';
      ctx.fillText('No run completed yet.', pad + 8, y + lineH);
      y += lineH + 8;
    }

    // --- BUTTONS ---
    this._renderButtons(ctx, w, contentH);
  }

  private _renderButtons(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = 20;
    const btnH = 38;
    const gap = 8;
    // Row 1: size presets (6 buttons).
    const presetW = Math.floor((w - pad * 2 - gap * (SIZE_PRESETS.length - 1)) / SIZE_PRESETS.length);
    const y1 = contentH - btnH * 2 - pad - gap;
    for (let i = 0; i < SIZE_PRESETS.length; i++) {
      const p = SIZE_PRESETS[i];
      const x = pad + i * (presetW + gap);
      this._drawButton(ctx, p.id, p.label, x, y1, presetW, btnH, false);
      this._buttons.push({ id: `size:${p.id}`, x, y: y1, w: presetW, h: btnH });
    }
    // Row 2: Start (full), Stop, Flush, Download.
    const actions: { id: string; label: string }[] = [
      { id: 'start-full', label: 'START FULL' },
      { id: 'stop', label: 'STOP' },
      { id: 'flush', label: 'FLUSH LOG' },
      { id: 'download', label: 'DOWNLOAD' },
    ];
    const actionW = Math.floor((w - pad * 2 - gap * (actions.length - 1)) / actions.length);
    const y2 = contentH - btnH - pad;
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      const x = pad + i * (actionW + gap);
      const active = a.id === 'stop' && this._driver.phase !== 'IDLE' && this._driver.phase !== 'COMPLETE';
      this._drawButton(ctx, a.id, a.label, x, y2, actionW, btnH, active);
      this._buttons.push({ id: a.id, x, y: y2, w: actionW, h: btnH });
    }
  }

  get lastStep(): LoadTestStepEvent | null {
    return this._lastStep;
  }

  private _drawButton(ctx: CanvasRenderingContext2D, _id: string, label: string, x: number, y: number, bw: number, bh: number, active: boolean): void {
    ctx.fillStyle = active ? 'rgba(255, 51, 68, 0.25)' : this.highContrast ? 'rgba(255,255,255,0.9)' : 'rgba(0, 255, 204, 0.15)';
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = active ? '#ff3344' : this.highContrast ? '#ffffff' : '#00ffcc';
    ctx.lineWidth = this.highContrast ? 3 : 2;
    ctx.strokeRect(x, y, bw, bh);
    ctx.font = this._scaleFont('bold 14px monospace');
    ctx.fillStyle = active ? '#ff3344' : this.highContrast ? '#000000' : '#00ffcc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + bw / 2, y + bh / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  handleContentClick(worldRaycaster: THREE.Raycaster): boolean {
    const hits = worldRaycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;
    const uv = hits[0].uv;
    if (!uv) return false;
    const cx = uv.x * this.width;
    const cy = (1 - uv.y) * this.height;

    for (const b of this._buttons) {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        this._dispatchButton(b.id);
        return true;
      }
    }
    return false;
  }

  private _dispatchButton(id: string): void {
    if (id.startsWith('size:')) {
      const presetId = id.slice('size:'.length);
      const preset = SIZE_PRESETS.find((p) => p.id === presetId);
      if (preset) this._start(preset.profile);
      return;
    }
    switch (id) {
      case 'start-full':
        this._start(DEFAULT_LOAD_TEST_PROFILE);
        break;
      case 'stop':
        this._onStop?.();
        break;
      case 'flush':
        this._onFlush?.();
        break;
      case 'download':
        this._downloadSummary();
        break;
      default:
        break;
    }
  }

  private _start(profile: LoadTestProfile): void {
    this._lastSummary = null;
    this._lastSample = null;
    this._dirty = true;
    if (this._onStart) {
      this._onStart(profile);
    } else {
      this._driver.run(profile);
    }
    this.render();
  }

  private _downloadSummary(): void {
    const summary = this._lastSummary;
    if (!summary) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(JSON.stringify(summary, null, 2), `nemosyne-loadtest-${ts}.json`, 'application/json').catch(() => {});
  }

  private _truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
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
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy + lineH);
        cy += lineH;
        line = word;
        if (cy > maxY) return cy;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, cy + lineH);
      cy += lineH;
    }
    return cy;
  }
}