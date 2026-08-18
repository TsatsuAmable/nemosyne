import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { buildReviewBundle, formatReviewBundle } from '../../utils/ReviewBundle.ts';
import { downloadText } from '../../utils/Download.ts';
import type { Dataset } from '../../data/Dataset.ts';
import type {
  MovablePanelOptions,
  PerformanceBudgetLike,
  PrivacyLevel,
  SettingsMap,
  TelemetryCollectorLike,
} from '../coordinators/types.ts';

/**
 * In-VR settings panel for gesture, statistical-lens, feedback, telemetry,
 * and accessibility customization. Settings are persisted to localStorage and
 * synced with the World through an `onChange` callback.
 *
 * The panel renders large, high-contrast toggle rows so they are readable and
 * clickable with a hand pointer in the Meta Quest 3S.
 */

interface SettingsPanelOptions extends MovablePanelOptions {
  onChange?: (key: string, value: unknown) => void;
  onExitVR?: () => void;
  telemetryCollector?: TelemetryCollectorLike | null;
  performanceBudget?: PerformanceBudgetLike | null;
  dataset?: Dataset | null;
  datasetTopology?: string;
  sessionDurationSeconds?: number;
  userNotes?: string;
}

interface StepperBounds {
  dec: { x: number; y: number; w: number; h: number };
  inc: { x: number; y: number; w: number; h: number };
}

interface ChoiceBounds {
  prev: { x: number; y: number; w: number; h: number };
  next: { x: number; y: number; w: number; h: number };
}

interface SettingsButton {
  key: keyof SettingsMap & string;
  label: string;
  section: string;
  type: 'toggle' | 'stepper' | 'choice';
  min?: number;
  max?: number;
  step?: number;
  choices?: string[];
  bounds: { x: number; y: number; w: number; h: number };
  stepperBounds?: StepperBounds;
  choiceBounds?: ChoiceBounds;
  rowY: number;
  rowH: number;
}

export class SettingsPanel extends MovablePanel {
  static STORAGE_KEY = 'nemosyne-vr-settings';

  static DEFAULTS: SettingsMap = {
    // lensTDA / lensCorrelation are sub-toggles: which components of the
    // statistical lens appear *when the lens is on*. They default on; the lens
    // itself is hidden by default via World._statisticalLensEnabled (progressive
    // disclosure). Flipping these to false would suppress TDA even when the
    // analyst explicitly toggles the lens on.
    lensTDA: true,
    lensCorrelation: true,
    feedbackAudio: true,
    feedbackHaptic: true,
    feedbackVisual: true,
    gesturesEnabled: true,
    telemetryEnabled: false,
    colorblindMode: 'none',
    highContrast: false,
    textScale: 1,
    dwellSelection: false,
    dwellTimeMs: 1200,
    strictBudget: false,
    collabEnabled: false,
    collabRoom: 'default',
    collabName: 'Analyst',
    userMode: 'novice',
    snapTurn: true,
    snapTurnAngle: 30,
    vignette: false,
    vignetteIntensity: 0.4,
    seatedHeightOffset: 0,
    defaultPanelDistance: 1.2,
    reducedMotion: false,
    miniOverview: true,
    peerPresence: true,
  };

  onChange: (key: string, value: unknown) => void;
  settings: SettingsMap;
  private _buttons: SettingsButton[];

  private _telemetryCollector: TelemetryCollectorLike | null;
  private _performanceBudget: PerformanceBudgetLike | null;
  private _dataset: Dataset | null;
  private _datasetTopology: string;
  private _sessionDurationSeconds: number;
  private _userNotes: string;
  private _exportPrivacyLevel: PrivacyLevel;
  private _onExitVR: (() => void) | null;
  private _exitVRBounds: { x: number; y: number; w: number; h: number } | null = null;

  constructor(cameraGroup: THREE.Group, options: SettingsPanelOptions = {}) {
    super(cameraGroup, {
      title: 'SETTINGS',
      width: 900,
      height: 1120,
      position: options.position ?? [0.65, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.9, 0.82],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });

    this.onChange = options.onChange ?? (() => {});
    this._onExitVR = options.onExitVR ?? null;
    this.settings = this._loadSettings();

    this._telemetryCollector = options.telemetryCollector ?? null;
    this._performanceBudget = options.performanceBudget ?? null;
    this._dataset = options.dataset ?? null;
    this._datasetTopology = options.datasetTopology ?? '-';
    this._sessionDurationSeconds = options.sessionDurationSeconds ?? 0;
    this._userNotes = options.userNotes ?? '';
    this._exportPrivacyLevel = 'metadata';

    this._buttons = [];
    this._buildButtons();
    this.render();
  }

  private _loadSettings(): SettingsMap {
    try {
      const raw = localStorage.getItem(SettingsPanel.STORAGE_KEY);
      return raw
        ? { ...SettingsPanel.DEFAULTS, ...(JSON.parse(raw) as Partial<SettingsMap>) }
        : { ...SettingsPanel.DEFAULTS };
    } catch {
      return { ...SettingsPanel.DEFAULTS };
    }
  }

  private _saveSettings(): void {
    try {
      localStorage.setItem(SettingsPanel.STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Storage may be unavailable in private mode or test environments.
    }
  }

  setSetting<K extends keyof SettingsMap & string>(key: K, value: SettingsMap[K]): void {
    if (!(key in this.settings)) return;
    this.settings[key] = value;
    this._saveSettings();
    this.onChange(key, value);
    this.render();
  }

  getSetting<K extends keyof SettingsMap & string>(key: K): SettingsMap[K] {
    return this.settings[key];
  }

  getAllSettings(): SettingsMap {
    return { ...this.settings };
  }

  private _buildButtons(): void {
    const labels: {
      key: keyof SettingsMap & string;
      label: string;
      section: string;
      type?: 'toggle' | 'stepper' | 'choice';
      min?: number;
      max?: number;
      step?: number;
      choices?: string[];
    }[] = [
      {
        key: 'userMode',
        label: 'User Mode',
        section: 'USER MODE',
        type: 'choice',
        choices: ['novice', 'intermediate', 'expert'],
      },
      { key: 'lensTDA', label: 'TDA Summary Lens', section: 'STATISTICAL LENS' },
      { key: 'lensCorrelation', label: 'Correlation Matrix', section: 'STATISTICAL LENS' },
      { key: 'miniOverview', label: 'Mini Overview', section: 'NAVIGATION' },
      { key: 'peerPresence', label: 'Peer Presence', section: 'COLLABORATION' },
      { key: 'feedbackAudio', label: 'Audio Feedback', section: 'FEEDBACK' },
      { key: 'feedbackHaptic', label: 'Haptic Feedback', section: 'FEEDBACK' },
      { key: 'feedbackVisual', label: 'Visual Feedback', section: 'FEEDBACK' },
      { key: 'gesturesEnabled', label: 'Hand Gestures', section: 'GESTURES' },
      { key: 'telemetryEnabled', label: 'Telemetry Opt-in', section: 'PRIVACY' },
      { key: 'highContrast', label: 'High Contrast', section: 'ACCESSIBILITY' },
      { key: 'dwellSelection', label: 'Dwell Select', section: 'ACCESSIBILITY' },
      {
        key: 'dwellTimeMs',
        label: 'Dwell Time',
        section: 'ACCESSIBILITY',
        type: 'stepper',
        min: 400,
        max: 3000,
        step: 200,
      },
      {
        key: 'textScale',
        label: 'Text Scale',
        section: 'ACCESSIBILITY',
        type: 'stepper',
        min: 0.75,
        max: 2,
        step: 0.25,
      },
      {
        key: 'colorblindMode',
        label: 'Colorblind',
        section: 'ACCESSIBILITY',
        type: 'choice',
        choices: ['none', 'deuteranopia', 'protanopia', 'tritanopia'],
      },
      { key: 'strictBudget', label: 'Strict Budget', section: 'PERFORMANCE' },
      { key: 'snapTurn', label: 'Snap Turn', section: 'COMFORT' },
      {
        key: 'snapTurnAngle',
        label: 'Snap Angle',
        section: 'COMFORT',
        type: 'stepper',
        min: 15,
        max: 90,
        step: 15,
      },
      { key: 'vignette', label: 'Vignette', section: 'COMFORT' },
      {
        key: 'vignetteIntensity',
        label: 'Vignette Intensity',
        section: 'COMFORT',
        type: 'stepper',
        min: 0.1,
        max: 0.9,
        step: 0.1,
      },
      {
        key: 'seatedHeightOffset',
        label: 'Seated Height',
        section: 'COMFORT',
        type: 'stepper',
        min: -0.5,
        max: 0.5,
        step: 0.1,
      },
      {
        key: 'defaultPanelDistance',
        label: 'Panel Distance',
        section: 'COMFORT',
        type: 'stepper',
        min: 0.7,
        max: 2.5,
        step: 0.1,
      },
      { key: 'reducedMotion', label: 'Reduced Motion', section: 'COMFORT' },
      { key: 'collabEnabled', label: 'Collaboration', section: 'NETWORK' },
      {
        key: 'collabRoom',
        label: 'Room',
        section: 'NETWORK',
        type: 'choice',
        choices: ['default', 'team-a', 'team-b', 'demo'],
      },
      {
        key: 'collabName',
        label: 'Name',
        section: 'NETWORK',
        type: 'choice',
        choices: ['Analyst', 'Observer', 'Guest', 'Peer'],
      },
    ];

    const rowH = 72;
    const margin = 28;
    const toggleW = 120;
    const toggleH = 44;
    const stepperW = 180;
    const choiceW = 220;

    this._buttons = [];
    let y = margin;
    let currentSection: string | null = null;

    for (const item of labels) {
      if (item.section !== currentSection) {
        currentSection = item.section;
        y += 24; // section gap
      }

      const type = item.type || 'toggle';
      let bounds: { x: number; y: number; w: number; h: number };
      let stepperBounds: StepperBounds | undefined;
      let choiceBounds: ChoiceBounds | undefined;

      if (type === 'toggle') {
        bounds = {
          x: this.width - margin - toggleW,
          y: this.titleBarHeight + y + (rowH - toggleH) / 2,
          w: toggleW,
          h: toggleH,
        };
      } else if (type === 'stepper') {
        bounds = {
          x: this.width - margin - stepperW,
          y: this.titleBarHeight + y + (rowH - toggleH) / 2,
          w: stepperW,
          h: toggleH,
        };
        stepperBounds = {
          dec: { x: bounds.x, y: bounds.y, w: toggleH, h: toggleH },
          inc: { x: bounds.x + bounds.w - toggleH, y: bounds.y, w: toggleH, h: toggleH },
        };
      } else {
        // choice
        bounds = {
          x: this.width - margin - choiceW,
          y: this.titleBarHeight + y + (rowH - toggleH) / 2,
          w: choiceW,
          h: toggleH,
        };
        const arrowW = toggleH;
        choiceBounds = {
          prev: { x: bounds.x, y: bounds.y, w: arrowW, h: toggleH },
          next: { x: bounds.x + bounds.w - arrowW, y: bounds.y, w: arrowW, h: toggleH },
        };
      }

      this._buttons.push({
        key: item.key,
        label: item.label,
        section: item.section,
        type,
        min: item.min,
        max: item.max,
        step: item.step,
        choices: item.choices,
        bounds,
        stepperBounds,
        choiceBounds,
        rowY: this.titleBarHeight + y,
        rowH,
      });

      y += rowH;
    }
  }

  renderContent(ctx: CanvasRenderingContext2D, _w: number, _contentH: number): void {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let currentSection: string | null = null;
    let privacyRowY = 0;
    let privacyRowH = 0;
    for (const btn of this._buttons) {
      if (btn.section !== currentSection) {
        currentSection = btn.section;
        ctx.fillStyle = this.highContrast ? '#ffffff' : '#00ffff';
        ctx.font = this._scaleFont('bold 18px monospace');
        ctx.fillText(`// ${currentSection}`, 28, btn.rowY - 10);
      }

      // Label.
      ctx.font = this._scaleFont('22px monospace');
      ctx.fillStyle = this.highContrast ? '#ffffff' : '#ccffff';
      ctx.fillText(btn.label, 28, btn.rowY + btn.rowH / 2);

      const { x, y, w: bw, h } = btn.bounds;

      if (btn.type === 'toggle') {
        this._renderToggle(ctx, x, y, bw, h, !!this.settings[btn.key]);
      } else if (btn.type === 'stepper') {
        this._renderStepper(ctx, x, y, bw, h, Number(this.settings[btn.key]), btn.stepperBounds!);
      } else if (btn.type === 'choice') {
        this._renderChoice(ctx, x, y, bw, h, String(this.settings[btn.key]), btn.choices!, btn.choiceBounds!);
      }

      if (btn.section === 'PRIVACY') {
        privacyRowY = btn.rowY;
        privacyRowH = btn.rowH;
      }
    }

    if (privacyRowY > 0) {
      this._renderExportBundleRow(ctx, privacyRowY + privacyRowH + 20);
    }
  }

  private _renderExportBundleRow(ctx: CanvasRenderingContext2D, y: number): void {
    const margin = 28;
    const btnH = 44;
    const toggleW = 160;
    const exportW = 260;

    // Privacy-level toggle.
    const toggleX = margin;
    const level = this._exportPrivacyLevel;
    ctx.fillStyle = this.highContrast ? 'rgba(255,255,255,0.9)' : 'rgba(60, 60, 80, 0.5)';
    ctx.fillRect(toggleX, y, toggleW, btnH);
    ctx.strokeStyle = this.highContrast ? '#ffffff' : '#778899';
    ctx.lineWidth = this.highContrast ? 3 : 2;
    ctx.strokeRect(toggleX, y, toggleW, btnH);
    ctx.font = this._scaleFont('bold 16px monospace');
    ctx.fillStyle = this.highContrast ? '#000000' : '#ccffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`level: ${level}`, toggleX + toggleW / 2, y + btnH / 2);

    // Export button.
    const exportX = this.width - margin - exportW;
    ctx.fillStyle = this.highContrast ? 'rgba(255,255,255,0.9)' : 'rgba(0, 255, 204, 0.15)';
    ctx.fillRect(exportX, y, exportW, btnH);
    ctx.strokeStyle = this.highContrast ? '#ffffff' : '#00ffcc';
    ctx.lineWidth = this.highContrast ? 3 : 2;
    ctx.strokeRect(exportX, y, exportW, btnH);
    ctx.fillStyle = this.highContrast ? '#000000' : '#00ffcc';
    ctx.fillText('EXPORT REVIEW BUNDLE', exportX + exportW / 2, y + btnH / 2);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Store bounds for hit testing.
    this._exportBundleBounds = {
      toggle: { x: toggleX, y, w: toggleW, h: btnH },
      export: { x: exportX, y, w: exportW, h: btnH },
    };

    // Exit VR button row
    const exitY = y + btnH + 16;
    const exitW = this.width - margin * 2;
    ctx.fillStyle = this.highContrast ? '#ff2244' : 'rgba(255, 34, 68, 0.25)';
    ctx.fillRect(margin, exitY, exitW, btnH);
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = this.highContrast ? 3 : 2;
    ctx.strokeRect(margin, exitY, exitW, btnH);
    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#ff99aa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚪 EXIT IMMERSIVE VR (RETURN TO 2D)', margin + exitW / 2, exitY + btnH / 2);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    this._exitVRBounds = { x: margin, y: exitY, w: exitW, h: btnH };
  }

  private _exportBundleBounds: {
    toggle: { x: number; y: number; w: number; h: number };
    export: { x: number; y: number; w: number; h: number };
  } | null = null;

  private _renderToggle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, on: boolean): void {
    const active = on ? this.remapColor(0x00ffcc) : this.highContrast ? 0xffffff : 0x778899;
    ctx.fillStyle = on ? 'rgba(0, 255, 204, 0.25)' : 'rgba(60, 60, 80, 0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = `#${active.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = this.highContrast ? 4 : 3;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = `#${active.toString(16).padStart(6, '0')}`;
    const thumbX = on ? x + w - h + 4 : x + 4;
    ctx.fillRect(thumbX, y + 4, h - 8, h - 8);

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = this.highContrast ? '#000000' : '#001122';
    ctx.textAlign = 'center';
    ctx.fillText(on ? 'ON' : 'OFF', x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
  }

  private _renderStepper(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    value: number,
    bounds: StepperBounds
  ): void {
    ctx.fillStyle = 'rgba(60, 60, 80, 0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = this.highContrast ? '#ffffff' : '#778899';
    ctx.lineWidth = this.highContrast ? 4 : 3;
    ctx.strokeRect(x, y, w, h);

    // Decrement arrow.
    const stepperButton = this._buttons.find((b) => b.stepperBounds === bounds);
    const decActive = stepperButton ? value > stepperButton.min! : true;
    ctx.fillStyle = decActive
      ? `#${this.remapColor(0x00ffcc).toString(16).padStart(6, '0')}`
      : '#445566';
    ctx.fillRect(bounds.dec.x, bounds.dec.y, bounds.dec.w, bounds.dec.h);
    ctx.strokeRect(bounds.dec.x, bounds.dec.y, bounds.dec.w, bounds.dec.h);

    // Increment arrow.
    const incActive = stepperButton ? value < stepperButton.max! : true;
    ctx.fillStyle = incActive
      ? `#${this.remapColor(0x00ffcc).toString(16).padStart(6, '0')}`
      : '#445566';
    ctx.fillRect(bounds.inc.x, bounds.inc.y, bounds.inc.w, bounds.inc.h);
    ctx.strokeRect(bounds.inc.x, bounds.inc.y, bounds.inc.w, bounds.inc.h);

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#00ffff';
    ctx.textAlign = 'center';
    ctx.fillText(`×${Number(value).toFixed(2)}`, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
  }

  private _renderChoice(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    value: string,
    choices: string[],
    bounds: ChoiceBounds
  ): void {
    ctx.fillStyle = 'rgba(60, 60, 80, 0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = this.highContrast ? '#ffffff' : '#778899';
    ctx.lineWidth = this.highContrast ? 4 : 3;
    ctx.strokeRect(x, y, w, h);

    const accent = `#${this.remapColor(0x00ffcc).toString(16).padStart(6, '0')}`;
    ctx.fillStyle = accent;
    ctx.fillRect(bounds.prev.x, bounds.prev.y, bounds.prev.w, bounds.prev.h);
    ctx.strokeRect(bounds.prev.x, bounds.prev.y, bounds.prev.w, bounds.prev.h);

    ctx.fillRect(bounds.next.x, bounds.next.y, bounds.next.w, bounds.next.h);
    ctx.strokeRect(bounds.next.x, bounds.next.y, bounds.next.w, bounds.next.h);

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#00ffff';
    ctx.textAlign = 'center';
    const display =
      String(value ?? '')
        .charAt(0)
        .toUpperCase() + String(value ?? '').slice(1);
    ctx.fillText(display, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
  }

  handleContentClick(worldRaycaster: THREE.Raycaster): boolean {
    const hits = worldRaycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;

    const uv = hits[0].uv;
    if (!uv) return false;
    const cx = uv.x * this.width;
    const cy = (1 - uv.y) * this.height;

    for (const btn of this._buttons) {
      if (btn.type === 'toggle') {
        const b = btn.bounds;
        if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
          this.setSetting(btn.key, !this.settings[btn.key]);
          return true;
        }
      } else if (btn.type === 'stepper') {
        const dec = btn.stepperBounds!.dec;
        const inc = btn.stepperBounds!.inc;
        const current = Number(this.settings[btn.key]);
        if (cx >= dec.x && cx <= dec.x + dec.w && cy >= dec.y && cy <= dec.y + dec.h) {
          this.setSetting(btn.key, Math.max(btn.min!, current - btn.step!));
          return true;
        }
        if (cx >= inc.x && cx <= inc.x + inc.w && cy >= inc.y && cy <= inc.y + inc.h) {
          this.setSetting(btn.key, Math.min(btn.max!, current + btn.step!));
          return true;
        }
      } else if (btn.type === 'choice') {
        const prev = btn.choiceBounds!.prev;
        const next = btn.choiceBounds!.next;
        const choices = btn.choices!;
        const idx = choices.indexOf(String(this.settings[btn.key]));
        if (cx >= prev.x && cx <= prev.x + prev.w && cy >= prev.y && cy <= prev.y + prev.h) {
          const newIdx = (idx - 1 + choices.length) % choices.length;
          this.setSetting(btn.key, choices[newIdx]);
          return true;
        }
        if (cx >= next.x && cx <= next.x + next.w && cy >= next.y && cy <= next.y + next.h) {
          const newIdx = (idx + 1) % choices.length;
          this.setSetting(btn.key, choices[newIdx]);
          return true;
        }
      }
    }
    // Export Review Bundle row in the PRIVACY section.
    const eb = this._exportBundleBounds;
    if (eb) {
      if (cx >= eb.toggle.x && cx <= eb.toggle.x + eb.toggle.w && cy >= eb.toggle.y && cy <= eb.toggle.y + eb.toggle.h) {
        this._exportPrivacyLevel = this._exportPrivacyLevel === 'full-session' ? 'metadata' : 'full-session';
        this.render();
        return true;
      }
      if (cx >= eb.export.x && cx <= eb.export.x + eb.export.w && cy >= eb.export.y && cy <= eb.export.y + eb.export.h) {
        this._exportReviewBundle();
        return true;
      }
    }

    // Exit VR button
    const evb = this._exitVRBounds;
    if (evb && cx >= evb.x && cx <= evb.x + evb.w && cy >= evb.y && cy <= evb.y + evb.h) {
      this._onExitVR?.();
      return true;
    }

    return false;
  }

  private _exportReviewBundle(): void {
    if (!this._telemetryCollector || !this._performanceBudget) return;

    const bundle = buildReviewBundle({
      telemetryCollector: this._telemetryCollector,
      performanceBudget: this._performanceBudget,
      privacyLevel: this._exportPrivacyLevel,
      dataset: this._dataset ?? undefined,
      datasetTopology: this._datasetTopology,
      sessionDurationSeconds: this._sessionDurationSeconds,
      userNotes: this._userNotes,
    });

    downloadText(formatReviewBundle(bundle), 'nemosyne-review-bundle.json', 'application/json').catch(
      () => {}
    );
  }
}
