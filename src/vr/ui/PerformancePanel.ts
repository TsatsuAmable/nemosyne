import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type {
  AccessibilityOptions,
  PerformanceBudgetLike,
  TelemetryCollectorLike,
  TelemetryReport,
} from '../coordinators/types.ts';

export interface PerformancePanelOptions {
  budget?: PerformanceBudgetLike | null;
  telemetry?: TelemetryCollectorLike | null;
  position?: [number, number, number];
  worldSize?: [number, number];
  textScale?: number;
  highContrast?: boolean;
  colorblindMode?: string;
}

interface PerformanceReport {
  tel: TelemetryReport | null;
  violations: ReturnType<PerformanceBudgetLike['getViolations']>;
  budgets: ReturnType<PerformanceBudgetLike['getBudgets']>;
}

const PANEL_WIDTH = 960;
const PANEL_HEIGHT = 720;
const BASE_FONT_SIZE = 16;

/**
 * Live performance budget surface.
 *
 * UXR1 migrates this panel from MovablePanel/CanvasTexture to SpatialPanel +
 * UIKit. PerformanceBudget and telemetry remain the data authorities; this
 * class is only a presentation projection.
 */
export class PerformancePanel extends SpatialPanel {
  readonly title = 'PERFORMANCE';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  budget: PerformanceBudgetLike | null;
  telemetry: TelemetryCollectorLike | null;

  private _lastReport: PerformanceReport | null = null;
  private readonly _content: Text;
  private _textScale: number;
  private _highContrast: boolean;

  constructor(analystAnchor: THREE.Object3D, options: PerformancePanelOptions = {}) {
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

    this.name = 'performance-panel';
    this.budget = options.budget ?? null;
    this.telemetry = options.telemetry ?? null;
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;

    const worldWidth = options.worldSize?.[0] ?? 0.96;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [0.55, 1.6, -1.05]));
    this.position.copy(this.defaultPosition);

    this._content = new Text({
      text: '',
      fontSize: BASE_FONT_SIZE * this._textScale,
      color: Number(theme.textPrimary),
    });
    this.add(this._content);
    this.render();
  }

  update(delta = 0): void {
    super.update(delta);
    if (!this.budget) return;
    const report = this._buildReport();
    if (JSON.stringify(report) === JSON.stringify(this._lastReport)) return;
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
      text: this._formatReport(this._buildReport()),
      fontSize: BASE_FONT_SIZE * this._textScale,
      color: Number(theme.textPrimary),
    });
  }

  private _buildReport(): PerformanceReport {
    return {
      tel: this.telemetry?.getReport?.() ?? null,
      violations: this.budget?.getViolations?.() ?? [],
      budgets: this.budget?.getBudgets?.() ?? {},
    };
  }

  private _formatReport(report: PerformanceReport): string {
    if (!this.budget) return 'Performance budget not available.';

    const { tel, violations, budgets } = report;
    const lines: string[] = ['// TELEMETRY'];
    if (tel) {
      const fps = tel.frames.lastMs > 0 ? (1000 / tel.frames.lastMs).toFixed(0) : '-';
      lines.push(
        'Session: ' + formatDuration(tel.session.durationSeconds),
        'Frames: ' + tel.frames.count + '  Dropped: ' + tel.frames.dropped,
        'Frame time: ' + tel.frames.lastMs.toFixed(1) + ' ms (~' + fps + ' fps)',
        'Avg frame: ' + tel.frames.averageMs.toFixed(1) + ' ms'
      );
    } else {
      lines.push('Telemetry is disabled. Enable it in Settings → Telemetry Opt-in.');
    }

    lines.push(
      '',
      '// BUDGETS',
      'Frame time: ' + (budgets.frameMs?.toFixed(1) ?? '-') + ' ms',
      'Draw calls: ' + (budgets.drawCalls ?? '-'),
      'Triangles: ' + (budgets.triangles ?? 0).toLocaleString(),
      'Points: ' + (budgets.points ?? 0).toLocaleString(),
      'Interactables: ' + (budgets.interactables ?? '-'),
      'Updatables: ' + (budgets.updatables ?? '-'),
      'Panels: ' + (budgets.panels ?? '-'),
      '',
      '// VIOLATIONS'
    );

    if (violations.length === 0) {
      lines.push('No budget violations.');
    } else {
      for (const violation of violations.slice(-8).reverse()) {
        const time = new Date(violation.time ?? Date.now()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        lines.push(time + ' ' + violation.message);
      }
    }

    return lines.join('\n');
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
