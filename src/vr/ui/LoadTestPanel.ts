import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import { downloadText } from '../../utils/Download.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import type { AccessibilityOptions, WorldEventBusLike, MovablePanelOptions } from '../coordinators/types.ts';
import {
  DEFAULT_LOAD_TEST_PROFILE,
  QUEST_3S_QUALIFICATION_PROFILE,
  type LoadTestDriver,
  type LoadTestProfile,
  type LoadTestSummary,
} from '../scalability/LoadTestDriver.ts';
import type { StepFrameStats, VerdictGrade } from '../scalability/LoadTestThresholds.ts';
import type {
  QuestBoundaryProgress,
  QuestBoundarySummary,
} from '../scalability/QuestBoundaryProbe.ts';

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

interface LoadTestStepEvent {
  phase: string;
  stepIndex: number;
  totalSteps: number;
  result?: {
    grade: VerdictGrade;
    reasons: string[];
    spec: { rowCount: number };
    frames: StepFrameStats;
  };
}

interface LoadTestPanelOptions extends MovablePanelOptions {
  driver: LoadTestDriver;
  eventBus: WorldEventBusLike;
  onStart?: (profile: LoadTestProfile) => void;
  onStartBoundary?: () => void;
  onStop?: () => void;
  onFlush?: () => void;
}

type LoadAction =
  | 'size:1k'
  | 'size:8k'
  | 'size:65k'
  | 'size:100k'
  | 'size:250k'
  | 'size:full'
  | 'start-full'
  | 'start-quest'
  | 'start-quest-10m'
  | 'stop'
  | 'flush'
  | 'download';

const PANEL_WIDTH = 920;
const PANEL_HEIGHT = 820;

function singleStepProfile(rowCount: number, durationSec: number, label: string): LoadTestProfile {
  return {
    name: 'single-' + label,
    settleSec: 2,
    steps: [{ topology: 'TABULAR', rowCount, durationSec, label }],
  };
}

const SIZE_PRESETS: Record<string, LoadTestProfile> = {
  'size:1k': singleStepProfile(1_000, 20, '1k'),
  'size:8k': singleStepProfile(8_000, 20, '8k'),
  'size:65k': singleStepProfile(65_000, 30, '65k'),
  'size:100k': singleStepProfile(100_000, 30, '100k'),
  'size:250k': singleStepProfile(250_000, 30, '250k'),
  'size:full': DEFAULT_LOAD_TEST_PROFILE,
};

export class LoadTestPanel extends SpatialPanel {
  readonly title = 'LOAD TEST';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  private readonly _driver: LoadTestDriver;
  private readonly _onStart?: (profile: LoadTestProfile) => void;
  private readonly _onStartBoundary?: () => void;
  private readonly _onStop?: () => void;
  private readonly _onFlush?: () => void;

  private _lastSample: LoadTestSample | null = null;
  private _lastStep: LoadTestStepEvent | null = null;
  private _lastSummary: LoadTestSummary | null = null;
  private _lastBoundarySummary: QuestBoundarySummary | null = null;
  private _lastDownloadPayload: LoadTestSummary | QuestBoundarySummary | null = null;
  private _boundaryProgress: QuestBoundaryProgress | null = null;
  private _boundaryRunning = false;
  private _dirty = true;
  private _unsubs: Array<() => void> = [];

  private readonly _summaryText: Text;
  private readonly _actions: Container;
  private _buttons: Button[] = [];
  private _textScale = 1;
  private _highContrast = false;

  constructor(analystAnchor: THREE.Object3D, options: LoadTestPanelOptions) {
    const highContrast = options.highContrast ?? false;
    const theme = getTheme(highContrast);
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        gap: SPACING_TOKENS.grid.x8,
        padding: SPACING_TOKENS.grid.x12,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      options.parentGroup ?? analystAnchor,
      null
    );

    this.name = 'load-test-panel';
    this._driver = options.driver;
    this._onStart = options.onStart;
    this._onStartBoundary = options.onStartBoundary;
    this._onStop = options.onStop;
    this._onFlush = options.onFlush;
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;

    const worldWidth = options.worldSize?.[0] ?? 0.92;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [-0.9, 1.55, -1.1]));
    this.position.copy(this.defaultPosition);

    this._summaryText = new Text({
      text: '',
      fontSize: 15 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._actions = new Container({
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING_TOKENS.grid.x4,
    });
    this.add(this._summaryText, this._actions);

    const bus = options.eventBus;
    this._unsubs.push(
      bus.on(WorldTopics.LOADTEST_SAMPLE, (payload) => {
        this._lastSample = payload as LoadTestSample;
        this._dirty = true;
      }),
      bus.on(WorldTopics.LOADTEST_STEP, (payload) => {
        this._lastStep = payload as LoadTestStepEvent;
        this._dirty = true;
      }),
      bus.on(WorldTopics.LOADTEST_COMPLETE, (payload) => {
        this._lastSummary = payload as LoadTestSummary;
        this._lastDownloadPayload = this._lastSummary;
        this._lastSample = null;
        this._dirty = true;
      }),
      bus.on(WorldTopics.QUEST_BOUNDARY_START, () => {
        this._boundaryRunning = true;
        this._lastBoundarySummary = null;
        this._lastDownloadPayload = null;
        this._dirty = true;
      }),
      bus.on(WorldTopics.QUEST_BOUNDARY_PROGRESS, (payload) => {
        this._boundaryProgress = payload as QuestBoundaryProgress;
        this._dirty = true;
      }),
      bus.on(WorldTopics.QUEST_BOUNDARY_COMPLETE, (payload) => {
        this._boundaryRunning = false;
        this._lastBoundarySummary = payload as QuestBoundarySummary;
        this._lastDownloadPayload = this._lastBoundarySummary;
        this._dirty = true;
      })
    );

    this._rebuildButtons();
    this.render();
  }

  get lastSummary(): LoadTestSummary | null {
    return this._lastSummary;
  }

  get lastBoundarySummary(): QuestBoundarySummary | null {
    return this._lastBoundarySummary;
  }

  get lastStep(): LoadTestStepEvent | null {
    return this._lastStep;
  }

  update(delta = 0): void {
    super.update(delta);
    if (!this._dirty) return;
    this._dirty = false;
    this.render();
  }

  dispatchAction(id: LoadAction): boolean {
    if (id in SIZE_PRESETS) {
      this._start(SIZE_PRESETS[id]);
      return true;
    }

    switch (id) {
      case 'start-full':
        this._start(DEFAULT_LOAD_TEST_PROFILE);
        return true;
      case 'start-quest':
        this._start(QUEST_3S_QUALIFICATION_PROFILE);
        return true;
      case 'start-quest-10m':
        this._startBoundary();
        return true;
      case 'stop':
        this._onStop?.();
        return true;
      case 'flush':
        this._onFlush?.();
        return true;
      case 'download':
        this._downloadSummary();
        return true;
      default:
        return false;
    }
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

  override dispose(): void {
    for (const unsub of this._unsubs) {
      try {
        unsub();
      } catch {
        // Best-effort cleanup only.
      }
    }
    this._unsubs = [];
    super.dispose();
  }

  render(): void {
    const theme = getTheme(this._highContrast);
    this._summaryText.setProperties({
      text: this._formatSummary(),
      fontSize: 15 * this._textScale,
      color: Number(theme.textPrimary),
    });
  }

  private _formatSummary(): string {
    const lines: string[] = ['LOAD TEST / QUEST BOUNDARY', ''];

    if (this._boundaryRunning && this._boundaryProgress) {
      lines.push(
        'Mode: QUEST 10M boundary probe',
        'Phase: ' + this._boundaryProgress.phase,
        'Progress: ' + this._boundaryProgress.progressPercent.toFixed(1) + '%',
        'Frame gaps and WASM memory are being recorded.',
        'Device qualification remains blocked pending required audits.'
      );
      return lines.join('\n');
    }

    if (this._lastBoundarySummary && this._lastDownloadPayload === this._lastBoundarySummary) {
      lines.push(
        'Quest 10M boundary: ' + this._lastBoundarySummary.outcome.status.toUpperCase(),
        'WASM retained: ' +
          String(this._lastBoundarySummary.memory.retainedWasmGrowthBytes ?? 'unknown') +
          ' bytes',
        'Max XR frame gap: ' +
          (this._lastBoundarySummary.maximumFrameGapMs?.toFixed(1) ?? 'unknown') +
          ' ms',
        'Device qualification remains blocked pending required audits.'
      );
      return lines.join('\n');
    }

    if (this._lastSummary) {
      lines.push('Completed load test: ' + this._lastSummary.profileName);
      for (const step of this._lastSummary.steps.slice(-8)) {
        lines.push(
          step.spec.rowCount +
            ': ' +
            step.grade.toUpperCase() +
            (step.reasons.length ? ' · ' + step.reasons.join('; ') : '')
        );
      }
      lines.push('', this._lastSummary.verdict.recommendation);
      return lines.join('\n');
    }

    if (this._lastSample) {
      const frame = this._lastSample.frames;
      const progress = Math.min(
        100,
        (this._lastSample.elapsedMs / (this._lastSample.spec.durationSec * 1000)) * 100
      );
      lines.push(
        'Phase: ' + this._driver.phase,
        'Step: ' +
          this._lastSample.stepIndex +
          '/' +
          this._lastSample.totalSteps +
          ' · ' +
          (this._lastSample.spec.label ?? this._lastSample.spec.rowCount),
        'p50 ' +
          frame.p50Ms.toFixed(1) +
          ' · p95 ' +
          frame.p95Ms.toFixed(1) +
          ' · p99 ' +
          frame.p99Ms.toFixed(1) +
          ' ms',
        'FPS ' +
          frame.fpsAvg.toFixed(0) +
          ' · dropped ' +
          frame.droppedPct.toFixed(1) +
          '% · GC spikes ' +
          frame.gcSpikes,
        'draw ' +
          this._lastSample.gpu.drawCalls +
          ' · tri ' +
          this._lastSample.gpu.triangles +
          ' · pts ' +
          this._lastSample.gpu.points +
          ' · lines ' +
          this._lastSample.gpu.lines,
        'Progress ' + progress.toFixed(0) + '% · critical frames ' + this._lastSample.criticalFrames
      );
      return lines.join('\n');
    }

    lines.push('Idle · select a size or qualification profile to start.');
    return lines.join('\n');
  }

  private _rebuildButtons(): void {
    for (const button of this._buttons) {
      this._actions.remove(button);
      button.dispose();
    }
    this._buttons = [];

    const definitions: Array<[LoadAction, string, 'primary' | 'secondary' | 'danger']> = [
      ['size:1k', '1k', 'secondary'],
      ['size:8k', '8k', 'secondary'],
      ['size:65k', '65k', 'secondary'],
      ['size:100k', '100k', 'secondary'],
      ['size:250k', '250k', 'secondary'],
      ['size:full', 'Full', 'secondary'],
      ['start-full', 'START FULL', 'primary'],
      ['start-quest', 'QUEST 3S', 'primary'],
      ['start-quest-10m', 'QUEST 10M', 'primary'],
      ['stop', 'STOP', 'danger'],
      ['flush', 'FLUSH LOG', 'secondary'],
      ['download', 'DOWNLOAD', 'secondary'],
    ];

    for (const [id, label, variant] of definitions) {
      const button = new Button({
        label,
        variant,
        onClick: () => {
          this.dispatchAction(id);
        },
      });
      button.name = id;
      this._buttons.push(button);
      this._actions.add(button);
    }
  }

  private _start(profile: LoadTestProfile): void {
    this._lastSummary = null;
    this._lastBoundarySummary = null;
    this._lastDownloadPayload = null;
    this._lastSample = null;
    this._dirty = true;
    if (this._onStart) this._onStart(profile);
    else this._driver.run(profile);
    this.render();
  }

  private _startBoundary(): void {
    this._lastSummary = null;
    this._lastBoundarySummary = null;
    this._lastDownloadPayload = null;
    this._lastSample = null;
    this._dirty = true;
    this._onStartBoundary?.();
    this.render();
  }

  private _downloadSummary(): void {
    const summary = this._lastDownloadPayload;
    if (!summary) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix =
      summary.profileName === 'quest-3s-rust-boundary-10m'
        ? 'nemosyne-quest-boundary'
        : 'nemosyne-loadtest';
    void downloadText(
      JSON.stringify(summary, null, 2),
      prefix + '-' + timestamp + '.json',
      'application/json'
    ).catch(() => {});
  }
}
