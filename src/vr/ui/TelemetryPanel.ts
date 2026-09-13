import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import { buildReviewBundle, formatReviewBundle } from '../../utils/ReviewBundle.ts';
import { downloadText } from '../../utils/Download.ts';
import type { Dataset } from '../../data/Dataset.ts';
import type {
  AccessibilityOptions,
  PerformanceBudgetLike,
  PrivacyLevel,
  TelemetryCollectorLike,
  TelemetryReport,
} from '../coordinators/types.ts';

export interface TelemetryPanelOptions {
  telemetry?: TelemetryCollectorLike | null;
  budget?: PerformanceBudgetLike | null;
  dataset?: Dataset | null;
  datasetTopology?: string;
  sessionDurationSeconds?: number;
  userNotes?: string;
  privacyLevel?: PrivacyLevel;
  position?: [number, number, number];
  worldSize?: [number, number];
  textScale?: number;
  highContrast?: boolean;
  colorblindMode?: string;
}

const PANEL_WIDTH = 900;
const PANEL_HEIGHT = 720;
const BASE_FONT_SIZE = 16;

/**
 * Local-only telemetry and review-export surface.
 *
 * UXR1 migrates this panel from MovablePanel/CanvasTexture to SpatialPanel +
 * UIKit. Telemetry collection, privacy policy and review-bundle construction
 * remain owned by their existing authorities; UIKit only renders and dispatches
 * the two explicit user actions.
 */
export class TelemetryPanel extends SpatialPanel {
  readonly title = 'TELEMETRY';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  telemetry: TelemetryCollectorLike | null;
  budget: PerformanceBudgetLike | null;
  dataset: Dataset | null;
  datasetTopology: string;
  sessionDurationSeconds: number;
  userNotes: string;
  privacyLevel: PrivacyLevel;
  fullSession: boolean;

  private _lastReport: TelemetryReport | null = null;
  private readonly _content: Text;
  private readonly _privacyButton: Button;
  private readonly _exportButton: Button;
  private _textScale: number;
  private _highContrast: boolean;

  constructor(analystAnchor: THREE.Object3D, options: TelemetryPanelOptions = {}) {
    const highContrast = options.highContrast ?? false;
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

    this.name = 'telemetry-panel';
    this.telemetry = options.telemetry ?? null;
    this.budget = options.budget ?? null;
    this.dataset = options.dataset ?? null;
    this.datasetTopology = options.datasetTopology ?? '-';
    this.sessionDurationSeconds = options.sessionDurationSeconds ?? 0;
    this.userNotes = options.userNotes ?? '';
    this.privacyLevel = options.privacyLevel ?? 'metadata';
    this.fullSession = this.privacyLevel === 'full-session';
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;

    const worldWidth = options.worldSize?.[0] ?? 0.9;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [0.75, 1.55, -1.1]));
    this.position.copy(this.defaultPosition);

    this._content = new Text({
      text: '',
      fontSize: BASE_FONT_SIZE * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._privacyButton = new Button({
      label: this._privacyLabel(),
      variant: 'secondary',
      onClick: () => this.togglePrivacyLevel(),
    });
    this._exportButton = new Button({
      label: 'EXPORT REVIEW BUNDLE',
      variant: 'primary',
      onClick: () => this._exportReviewBundle(),
      disabled: !this.telemetry || !this.budget,
      disabledReason: !this.telemetry || !this.budget ? 'Telemetry and budget are required' : undefined,
    });

    this.add(this._content, this._privacyButton, this._exportButton);
    this.render();
  }

  update(delta = 0): void {
    super.update(delta);
    if (!this.telemetry) return;
    const report = this.telemetry.getReport();
    if (this._sameReport(report)) return;
    this._lastReport = report;
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
    const theme = getTheme(this._highContrast);
    this._content.setProperties({
      text: this._formatReport(this.telemetry?.getReport() ?? null),
      fontSize: BASE_FONT_SIZE * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._privacyButton.label = this._privacyLabel();
    const disabled = !this.telemetry || !this.budget;
    this._exportButton.disabled = disabled;
    this._exportButton.disabledReason = disabled ? 'Telemetry and budget are required' : undefined;
  }

  togglePrivacyLevel(): void {
    this.fullSession = !this.fullSession;
    this.privacyLevel = this.fullSession ? 'full-session' : 'metadata';
    this.render();
  }

  private _privacyLabel(): string {
    return 'EXPORT LEVEL: ' + (this.fullSession ? 'FULL SESSION' : 'METADATA');
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

  private _formatReport(report: TelemetryReport | null): string {
    if (!report || !report.enabled) {
      return 'Telemetry is disabled.\nEnable it in Settings → Telemetry Opt-in.';
    }

    const { session, frames, operations, gestures, errors } = report;
    const fps = frames.lastMs > 0 ? (1000 / frames.lastMs).toFixed(0) : '-';
    const operationLines = Object.keys(operations).length
      ? Object.entries(operations).map(([op, n]) => op + ': ' + n)
      : ['No operations yet.'];
    const gestureLines = Object.keys(gestures).length
      ? Object.entries(gestures).map(([gesture, n]) => gesture + ': ' + n)
      : ['No gestures yet.'];

    return [
      '// SESSION',
      'Duration: ' + formatDuration(session.durationSeconds),
      'Dataset: ' + session.datasetName + ' (' + session.datasetTopology + ')',
      '',
      '// PERFORMANCE',
      'Frames: ' + frames.count + '  Dropped: ' + frames.dropped,
      'Last frame: ' + frames.lastMs.toFixed(1) + ' ms (~' + fps + ' fps)',
      'Average frame: ' + frames.averageMs.toFixed(1) + ' ms',
      'Budget: ' +
        frames.histogram.under16 +
        ' smooth / ' +
        frames.histogram.under33 +
        ' ok / ' +
        frames.histogram.under50 +
        ' slow / ' +
        (frames.histogram.under100 + frames.histogram.over100) +
        ' bad',
      '',
      '// OPERATIONS',
      ...operationLines,
      '',
      '// GESTURES',
      ...gestureLines,
      '',
      '// ERRORS',
      'Errors: ' +
        errors.count +
        '  Warnings: ' +
        errors.warnings +
        '  Rejections: ' +
        errors.unhandledRejections,
      errors.last ? 'Last: ' + errors.last.message : 'No errors recorded.',
    ].join('\n');
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
  if (h > 0) return h + 'h ' + (m % 60) + 'm ' + (s % 60) + 's';
  if (m > 0) return m + 'm ' + (s % 60) + 's';
  return s + 's';
}
