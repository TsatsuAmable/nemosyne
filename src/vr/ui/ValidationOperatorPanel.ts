import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import type {
  AccessibilityOptions,
  WorldEventBusLike,
  MovablePanelOptions,
} from '../coordinators/types.ts';
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

type ValidationAction =
  | 'run-performance'
  | 'run-boundary'
  | 'stop'
  | 'flush'
  | 'download'
  | 'refresh'
  | 'modality-controller'
  | 'modality-hand'
  | 'ux-pass'
  | 'ux-fail'
  | 'ux-skip'
  | 'comfort-ok'
  | 'comfort-issue'
  | 'comfort-skip'
  | 'ux-submit';

interface ActionState {
  id: ValidationAction;
  label: string;
  disabled: boolean;
  variant: 'primary' | 'secondary' | 'danger';
}

const PANEL_WIDTH = 980;
const PANEL_HEIGHT = 900;

/**
 * QV5/QV6 headset-side operator surface.
 *
 * This panel never derives promotion truth. It projects the launcher-owned,
 * schema-validated manifest and server-owned delivery/progress receipts. UIKit
 * owns presentation and semantic input only.
 */
export class ValidationOperatorPanel extends SpatialPanel {
  readonly title = 'DEVICE VALIDATION';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  private readonly _context: BrowserValidationContext;
  private readonly _onStartPerformance: () => void;
  private readonly _onStartBoundary: () => void;
  private readonly _onStop: () => void;
  private readonly _onFlush: () => void;
  private readonly _onDownload: () => Promise<void>;
  private readonly _onRefreshStatus: () => Promise<void>;
  private readonly _onSubmitUx: (submission: GuidedUxSubmission) => Promise<void>;
  private readonly _unsubs: Array<() => void> = [];

  private _dirty = true;
  private _sample: LoadTestSample | null = null;
  private _boundary: BoundaryProgress | null = null;
  private _runMessage = 'Confirming validation session with evidence sink…';
  private _delivery: ValidationDeliveryUiState = {
    status: 'idle',
    message: 'No evidence delivered yet.',
  };
  private _serverStatus: ValidationServerStatus | null = null;
  private _progress: QualificationProgress | null = null;
  private _armed: 'performance' | 'boundary' | null = null;
  private _armedUntil = 0;
  private _uxModality: GuidedUxInputModality = 'controller';
  private _uxIndex = 0;
  private _uxResults: GuidedUxTaskResult[] = [];
  private _comfort: GuidedComfortOutcome | null = null;
  private _uxSubmitted = false;
  private _textScale = 1;
  private _highContrast = false;

  private readonly _summary: Text;
  private readonly _actions: Container;
  private _actionButtons: Button[] = [];

  constructor(cameraGroup: THREE.Object3D, options: ValidationOperatorPanelOptions) {
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
      options.parentGroup ?? cameraGroup,
      null
    );

    this.name = 'validation-operator-panel';
    this._context = options.context;
    this._onStartPerformance = options.onStartPerformance;
    this._onStartBoundary = options.onStartBoundary;
    this._onStop = options.onStop;
    this._onFlush = options.onFlush;
    this._onDownload = options.onDownload;
    this._onRefreshStatus = options.onRefreshStatus;
    this._onSubmitUx = options.onSubmitUx;
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;

    const worldWidth = options.worldSize?.[0] ?? 0.98;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [-0.9, 1.55, -1.1]));
    this.position.copy(this.defaultPosition);

    this._summary = new Text({
      text: '',
      fontSize: 15 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._actions = new Container({
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING_TOKENS.grid.x4,
    });
    this.add(this._summary, this._actions);

    this._unsubs.push(
      options.eventBus.on(WorldTopics.LOADTEST_SAMPLE, (payload) => {
        this._sample = payload as LoadTestSample;
        this._runMessage = 'Performance run active';
        this._dirty = true;
      }),
      options.eventBus.on(WorldTopics.LOADTEST_COMPLETE, () => {
        this._sample = null;
        this._runMessage = 'Performance run complete; delivering evidence…';
        this._dirty = true;
      }),
      options.eventBus.on(WorldTopics.QUEST_BOUNDARY_PROGRESS, (payload) => {
        this._boundary = payload as BoundaryProgress;
        this._runMessage = '10M boundary active';
        this._dirty = true;
      }),
      options.eventBus.on(WorldTopics.QUEST_BOUNDARY_COMPLETE, () => {
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

  update(delta = 0): void {
    super.update(delta);
    if (this._armed && performance.now() > this._armedUntil) {
      this._armed = null;
      this._dirty = true;
    }
    if (!this._dirty) return;
    this._dirty = false;
    this.render();
  }

  override dispose(): void {
    for (const unsub of this._unsubs) {
      try {
        unsub();
      } catch {
        // Best-effort listener cleanup.
      }
    }
    this._unsubs.length = 0;
    super.dispose();
  }

  setDeliverySending(message = 'Delivering evidence…'): void {
    this._delivery = { status: 'sending', message };
    this._dirty = true;
  }

  setDeliveryReceipt(receipt: ValidationDeliveryReceipt): void {
    this._delivery = {
      status: 'captured',
      message: 'Captured: ' + receipt.artifact,
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
    this._delivery = {
      status: 'downloaded',
      message,
      receivedAt: new Date().toISOString(),
    };
    this._dirty = true;
  }

  setServerStatus(status: ValidationServerStatus): void {
    this._serverStatus = status;
    this._progress = status.progress;
    if (this._runMessage.startsWith('Confirming validation session')) {
      this._runMessage = 'Validation session confirmed by evidence sink.';
    }
    this._dirty = true;
  }

  getActionState(id: ValidationAction): ActionState | null {
    return this._actionStates().find((action) => action.id === id) ?? null;
  }

  getRenderedSummary(): string {
    return this._formatSummary();
  }

  dispatchAction(id: ValidationAction): boolean {
    const state = this.getActionState(id);
    if (!state || state.disabled) return false;

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
    }

    this._dirty = true;
    this.render();
    return true;
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
    this._summary.setProperties({
      text: this._formatSummary(),
      fontSize: 15 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._rebuildActions();
  }

  private _actionStates(): ActionState[] {
    const mode = (this._serverStatus?.manifest ?? this._context.manifest).validationMode;
    const confirmed = this._serverStatus !== null;

    if (mode === 'quest-ux') {
      const uxLocked = !confirmed || this._uxSubmitted;
      const canSubmit =
        confirmed &&
        !this._uxSubmitted &&
        this._uxResults.length === GUIDED_UX_TASKS.length &&
        this._comfort !== null;
      return [
        {
          id: 'modality-controller',
          label: 'CONTROLLER',
          disabled: uxLocked,
          variant: this._uxModality === 'controller' ? 'primary' : 'secondary',
        },
        {
          id: 'modality-hand',
          label: 'HAND',
          disabled: uxLocked,
          variant: this._uxModality === 'hand' ? 'primary' : 'secondary',
        },
        { id: 'ux-pass', label: 'PASS', disabled: uxLocked, variant: 'primary' },
        { id: 'ux-fail', label: 'FAIL', disabled: uxLocked, variant: 'danger' },
        { id: 'ux-skip', label: 'NOT RUN', disabled: uxLocked, variant: 'secondary' },
        { id: 'comfort-ok', label: 'COMFORT OK', disabled: uxLocked, variant: 'primary' },
        {
          id: 'comfort-issue',
          label: 'COMFORT ISSUE',
          disabled: uxLocked,
          variant: 'danger',
        },
        {
          id: 'comfort-skip',
          label: 'COMFORT N/R',
          disabled: uxLocked,
          variant: 'secondary',
        },
        { id: 'ux-submit', label: 'SUBMIT', disabled: !canSubmit, variant: 'primary' },
        { id: 'refresh', label: 'REFRESH', disabled: false, variant: 'secondary' },
      ];
    }

    const runId: ValidationAction =
      mode === 'quest-perf' ? 'run-performance' : mode === 'quest-10m' ? 'run-boundary' : 'refresh';

    const runLabel =
      mode === 'quest-perf'
        ? this._armed === 'performance'
          ? 'CONFIRM PERF'
          : 'ARM PERF'
        : mode === 'quest-10m'
          ? this._armed === 'boundary'
            ? 'CONFIRM 10M'
            : 'ARM 10M'
          : 'NO GOVERNED RUN';

    const actions: ActionState[] = [];
    if (mode === 'quest-perf' || mode === 'quest-10m') {
      actions.push({
        id: runId,
        label: runLabel,
        disabled: !confirmed,
        variant: 'primary',
      });
    }
    actions.push(
      { id: 'stop', label: 'STOP', disabled: false, variant: 'danger' },
      { id: 'flush', label: 'FLUSH', disabled: false, variant: 'secondary' },
      { id: 'download', label: 'DOWNLOAD', disabled: false, variant: 'secondary' },
      { id: 'refresh', label: 'REFRESH', disabled: false, variant: 'secondary' }
    );
    return actions;
  }

  private _rebuildActions(): void {
    for (const button of this._actionButtons) {
      this._actions.remove(button);
      button.dispose();
    }
    this._actionButtons = [];

    for (const action of this._actionStates()) {
      const button = new Button({
        label: action.label,
        variant: action.variant,
        disabled: action.disabled,
        onClick: () => {
          this.dispatchAction(action.id);
        },
      });
      button.name = action.id;
      this._actionButtons.push(button);
      this._actions.add(button);
    }
  }

  private _formatSummary(): string {
    const manifest = this._serverStatus?.manifest ?? this._context.manifest;
    const device = manifest.deviceIdentity;
    const confirmed = this._serverStatus !== null;
    const eligible = confirmed && manifest.promotionEligible && this._context.attributable;
    const statusLabel = confirmed
      ? eligible
        ? 'ELIGIBLE'
        : 'NOT ELIGIBLE'
      : 'AWAITING SINK CONFIRMATION';

    const lines = [
      'GOVERNED SESSION',
      statusLabel +
        ' · ' +
        manifest.validationMode +
        ' · ' +
        (manifest.gates.join(', ') || 'no gate'),
      'Session: ' + manifest.sessionLabel,
      'Build: ' + manifest.buildId.slice(0, 12) + ' · tree ' + manifest.worktree.toUpperCase(),
      'Profile: ' + (manifest.profile ?? 'none'),
      'Device: ' +
        (device?.model ?? 'UNAVAILABLE') +
        ' · firmware/build ' +
        (device?.buildIncremental ?? manifest.declaredFirmwareVersion ?? 'UNAVAILABLE'),
      'Identity basis: ' + (device?.captureBasis ?? 'investigator-declared/unavailable'),
      '',
      'EVIDENCE',
    ];

    if (!confirmed || !this._context.attributable || manifest.invalidations.length > 0) {
      const reason = !confirmed
        ? 'Exact launcher manifest has not yet been confirmed by the evidence sink.'
        : (this._context.attributionIssue ??
          manifest.invalidations[0] ??
          'Run cannot support promotion-grade claims.');
      lines.push('Reason: ' + reason);
    }

    if (this._progress) {
      lines.push(
        'Same build/device: render ' +
          Math.min(this._progress.renderCompleted, this._progress.target) +
          '/' +
          this._progress.target +
          ' · boundary ' +
          Math.min(this._progress.boundaryAttempts, this._progress.target) +
          '/' +
          this._progress.target
      );
    } else {
      lines.push('Same build/device progress: not yet confirmed by evidence sink.');
    }

    lines.push(this._delivery.message);
    const disposition = this._serverStatus?.gateDisposition;
    lines.push(
      'Disposition: ' +
        (disposition?.status ?? 'UNADJUDICATED') +
        (disposition?.reasons?.[0] ? ' · ' + disposition.reasons[0] : ''),
      '',
      'RUN',
      this._runMessage
    );

    if (this._sample) {
      const pct = Math.min(
        100,
        (this._sample.elapsedMs / (this._sample.spec.durationSec * 1000)) * 100
      );
      lines.push(
        'Rows ' +
          this._sample.spec.rowCount +
          ' · ' +
          pct.toFixed(0) +
          '% · p95 ' +
          this._sample.frames.p95Ms.toFixed(1) +
          'ms · ' +
          this._sample.frames.fpsAvg.toFixed(0) +
          'fps · drop ' +
          this._sample.frames.droppedPct.toFixed(1) +
          '%'
      );
    } else if (this._boundary) {
      lines.push(
        '10M ' + this._boundary.phase + ' · ' + this._boundary.progressPercent.toFixed(1) + '%'
      );
    }

    if (manifest.validationMode === 'quest-ux') {
      lines.push('', 'GUIDED PHYSICAL UX');
      if (!confirmed) {
        lines.push('Guided UX input is locked until the exact session manifest is confirmed.');
      } else if (this._uxIndex < GUIDED_UX_TASKS.length) {
        const task = GUIDED_UX_TASKS[this._uxIndex];
        lines.push(
          'Input modality: ' + this._uxModality.toUpperCase() + ' (investigator-selected)',
          'Task ' + (this._uxIndex + 1) + '/' + GUIDED_UX_TASKS.length + ': ' + task.label,
          task.instruction
        );
      } else {
        lines.push(
          'Tasks recorded: ' + this._uxResults.length + '/' + GUIDED_UX_TASKS.length,
          'Comfort: ' + (this._comfort?.toUpperCase() ?? 'NOT RECORDED'),
          this._uxSubmitted ? 'Guided UX evidence delivered.' : 'Record comfort, then SUBMIT.'
        );
      }
    } else if (!confirmed) {
      lines.push(
        'Governed start is locked until the evidence sink confirms the exact launcher manifest.'
      );
    } else if (manifest.validationMode === 'quest-perf') {
      lines.push(
        this._armed === 'performance'
          ? 'Confirm within 10 seconds to start ' + (manifest.profile ?? 'unknown') + '.'
          : 'Governed performance profile ' +
              (manifest.profile ?? 'unknown') +
              '. Arm first, then confirm.'
      );
    } else if (manifest.validationMode === 'quest-10m') {
      lines.push(
        this._armed === 'boundary'
          ? 'Confirm within 10 seconds to start the 10M synthetic boundary workload.'
          : '10M synthetic boundary exercise. This is boundary evidence, not device qualification.'
      );
    } else {
      lines.push('This mode does not own a governed on-device run.');
    }

    return lines.join('\n');
  }

  private _confirmOrRun(action: 'performance' | 'boundary'): void {
    if (!this._serverStatus) {
      this._runMessage = 'Start refused: exact validation manifest is not confirmed.';
      void this._refresh();
      return;
    }

    const now = performance.now();
    if (this._armed !== action || now > this._armedUntil) {
      this._armed = action;
      this._armedUntil = now + 10_000;
      this._runMessage = 'Armed ' + action + '; confirm within 10 seconds.';
      return;
    }

    this._armed = null;
    this._runMessage = action + ' start requested.';
    if (action === 'performance') this._onStartPerformance();
    else this._onStartBoundary();
  }

  private _recordUx(outcome: GuidedUxOutcome): void {
    if (!this._serverStatus || this._uxIndex >= GUIDED_UX_TASKS.length || this._uxSubmitted) {
      return;
    }

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
      !this._serverStatus ||
      this._uxSubmitted ||
      this._uxResults.length !== GUIDED_UX_TASKS.length ||
      this._comfort === null
    ) {
      if (!this._serverStatus) void this._refresh();
      return;
    }

    const manifest = this._serverStatus.manifest;
    const now = new Date().toISOString();
    const submission: GuidedUxSubmission = {
      schemaVersion: GUIDED_UX_SCHEMA_VERSION,
      sessionId: manifest.sessionId,
      sessionLabel: manifest.sessionLabel,
      buildId: manifest.buildId,
      deviceBuildFingerprint: manifest.deviceIdentity?.buildFingerprint ?? null,
      evidenceKind: 'guided-physical-ux',
      results: [...this._uxResults],
      comfortObservation: {
        outcome: this._comfort,
        recordedAt: now,
        note: null,
      },
      completedAt: now,
    };

    this.setDeliverySending('Delivering guided UX evidence…');
    try {
      await this._onSubmitUx(submission);
      this._uxSubmitted = true;
      this._dirty = true;
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
      this.setDeliveryFailure(
        'Status refresh failed: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }
}
