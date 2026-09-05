import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import type { PanelBudgetController } from '../ui-system/PanelBudgetController.ts';
import { Toggle } from '../ui-system/components/Toggle.ts';
import { Slider } from '../ui-system/components/Slider.ts';
import { SegmentedControl } from '../ui-system/components/SegmentedControl.ts';
import { SectionHeader } from '../ui-system/components/SectionHeader.ts';
import { ScrollContainer } from '../ui-system/components/ScrollContainer.ts';
import { Button } from '../ui-system/components/Button.ts';
import { COLOR_TOKENS, SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import { remapColor } from '../../utils/Accessibility.ts';
import { buildReviewBundle, formatReviewBundle } from '../../utils/ReviewBundle.ts';
import { downloadText } from '../../utils/Download.ts';
import type { Dataset } from '../../data/Dataset.ts';
import type {
  AccessibilityOptions,
  PerformanceBudgetLike,
  PrivacyLevel,
  SettingsMap,
  TelemetryCollectorLike,
} from '../coordinators/types.ts';

/**
 * In-VR settings panel built on the `SpatialPanel` + `@pmndrs/uikit` substrate.
 *
 * Settings are persisted to localStorage and synced to the World through an
 * `onChange` callback. The panel renders UIKit controls (Toggle / Slider /
 * SegmentedControl / Button) so they are readable and usable with both hand
 * pointers (direct touch) and ray interaction on the Meta Quest 3S.
 *
 * Migration note (P1-U3): the previous `MovablePanel` / Canvas2D hit-test model
 * is replaced by UIKit component construction. The public data contract —
 * `STORAGE_KEY`, `DEFAULTS`, `settings`, `onChange`, `getSetting`,
 * `setSetting`, `getAllSettings`, `applyAccessibility`, `show`/`hide`/`toggle`,
 * `update`, `mesh` — is preserved for downstream consumers (World,
 * ComfortSettingsController, WorldSessionController, CollaborationCoordinator,
 * GuidedTourController, WorldInputCoordinator).
 */

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 720;
/** Approximate world-space width in metres; height derives from the aspect ratio. */
const PANEL_WORLD_WIDTH = 0.9;

export interface SettingsPanelOptions {
  torsoAnchor: THREE.Object3D;
  worldScene: THREE.Object3D;
  position?: [number, number, number];
  onChange?: (key: string, value: unknown) => void;
  onExitVR?: () => void;
  telemetryCollector?: TelemetryCollectorLike | null;
  performanceBudget?: PerformanceBudgetLike | null;
  /**
   * Lazily evaluated UX-trace export. Invoked only from the user-initiated
   * EXPORT TRACE button; must return local JSON or null when nothing is
   * recorded. Never called automatically.
   */
  traceExporter?: (() => string | null) | null;
  dataset?: Dataset | null;
  datasetTopology?: string;
  sessionDurationSeconds?: number;
  userNotes?: string;
  textScale?: number;
  highContrast?: boolean;
  colorblindMode?: string;
  /**
   * Optional workspace budget controller. When supplied, the panel registers
   * itself in the `primary` role on `show` and untracks on `hide`, so the live
   * runtime enforces the analyst workspace panel budget rather than relying on
   * each caller to mediate coexistence.
   */
  panelBudgetController?: PanelBudgetController;
}

type SettingType = 'toggle' | 'stepper' | 'choice';

interface SettingDescriptor {
  key: keyof SettingsMap & string;
  label: string;
  section: string;
  type: SettingType;
  min?: number;
  max?: number;
  step?: number;
  choices?: string[];
  format?: (v: number) => string;
}

const SETTINGS: SettingDescriptor[] = [
  {
    key: 'userMode',
    label: 'User Mode',
    section: 'USER MODE',
    type: 'choice',
    choices: ['novice', 'intermediate', 'expert'],
  },
  { key: 'gesturesEnabled', label: 'Hand Gestures', section: 'GESTURES & CONTROLS', type: 'toggle' },
  { key: 'snapTurn', label: 'Snap Turn', section: 'COMFORT', type: 'toggle' },
  {
    key: 'snapTurnAngle',
    label: 'Snap Angle',
    section: 'COMFORT',
    type: 'stepper',
    min: 15,
    max: 90,
    step: 15,
    format: (v) => `${v}°`,
  },
  { key: 'vignette', label: 'Vignette', section: 'COMFORT', type: 'toggle' },
  {
    key: 'vignetteIntensity',
    label: 'Vignette Intensity',
    section: 'COMFORT',
    type: 'stepper',
    min: 0.1,
    max: 0.9,
    step: 0.1,
    format: (v) => v.toFixed(1),
  },
  {
    key: 'seatedHeightOffset',
    label: 'Seated Height',
    section: 'COMFORT',
    type: 'stepper',
    min: -0.5,
    max: 0.5,
    step: 0.1,
    format: (v) => v.toFixed(1),
  },
  { key: 'reducedMotion', label: 'Reduced Motion', section: 'COMFORT', type: 'toggle' },
  {
    key: 'defaultPanelDistance',
    label: 'Panel Distance',
    section: 'SPATIAL ZONATION & NAVIGATION',
    type: 'stepper',
    min: 0.7,
    max: 2.5,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}m`,
  },
  { key: 'miniOverview', label: 'Mini Overview', section: 'SPATIAL ZONATION & NAVIGATION', type: 'toggle' },
  { key: 'peerPresence', label: 'Peer Presence', section: 'SPATIAL ZONATION & NAVIGATION', type: 'toggle' },
  { key: 'highContrast', label: 'High Contrast', section: 'ACCESSIBILITY & LEGIBILITY', type: 'toggle' },
  { key: 'dwellSelection', label: 'Dwell Select', section: 'ACCESSIBILITY & LEGIBILITY', type: 'toggle' },
  {
    key: 'dwellTimeMs',
    label: 'Dwell Time',
    section: 'ACCESSIBILITY & LEGIBILITY',
    type: 'stepper',
    min: 400,
    max: 3000,
    step: 200,
    format: (v) => `${v}ms`,
  },
  {
    key: 'textScale',
    label: 'Text Scale',
    section: 'ACCESSIBILITY & LEGIBILITY',
    type: 'stepper',
    min: 0.75,
    max: 2,
    step: 0.25,
    format: (v) => `${v.toFixed(2)}x`,
  },
  {
    key: 'colorblindMode',
    label: 'Colorblind',
    section: 'ACCESSIBILITY & LEGIBILITY',
    type: 'choice',
    choices: ['none', 'deuteranopia', 'protanopia', 'tritanopia'],
  },
  { key: 'lensTDA', label: 'TDA Summary Lens', section: 'STATISTICAL LENS', type: 'toggle' },
  { key: 'lensCorrelation', label: 'Correlation Matrix', section: 'STATISTICAL LENS', type: 'toggle' },
  { key: 'feedbackAudio', label: 'Audio Feedback', section: 'FEEDBACK', type: 'toggle' },
  { key: 'feedbackHaptic', label: 'Haptic Feedback', section: 'FEEDBACK', type: 'toggle' },
  { key: 'feedbackVisual', label: 'Visual Feedback', section: 'FEEDBACK', type: 'toggle' },
  { key: 'telemetryEnabled', label: 'Telemetry Opt-in', section: 'PRIVACY & TELEMETRY', type: 'toggle' },
  { key: 'prodTraceEnabled', label: 'Prod Trace Recording', section: 'PRIVACY & TELEMETRY', type: 'toggle' },
  { key: 'strictBudget', label: 'Strict Budget', section: 'PERFORMANCE', type: 'toggle' },
  { key: 'collabEnabled', label: 'Collaboration', section: 'COLLABORATION', type: 'toggle' },
  {
    key: 'collabRoom',
    label: 'Room',
    section: 'COLLABORATION',
    type: 'choice',
    choices: ['default', 'team-a', 'team-b', 'demo'],
  },
  {
    key: 'collabName',
    label: 'Name',
    section: 'COLLABORATION',
    type: 'choice',
    choices: ['Analyst', 'Observer', 'Guest', 'Peer'],
  },
];

interface Palette {
  bg: number;
  border: number;
  text: number;
  textMuted: number;
  accent: number;
  danger: number;
}

export class SettingsPanel extends SpatialPanel {
  static STORAGE_KEY = 'nemosyne-vr-settings';

  static DEFAULTS: SettingsMap = {
    lensTDA: true,
    lensCorrelation: true,
    feedbackAudio: true,
    feedbackHaptic: true,
    feedbackVisual: true,
    gesturesEnabled: true,
    telemetryEnabled: false,
    prodTraceEnabled: false,
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

  title = 'SETTINGS';
  onChange: (key: string, value: unknown) => void;
  settings: SettingsMap;
  defaultPosition: THREE.Vector3;

  private _onExitVR: (() => void) | null;
  private _telemetryCollector: TelemetryCollectorLike | null;
  private _performanceBudget: PerformanceBudgetLike | null;
  private _dataset: Dataset | null;
  private _datasetTopology: string;
  private _sessionDurationSeconds: number;
  private _userNotes: string;
  private _exportPrivacyLevel: PrivacyLevel;

  private _textScale: number;
  private _highContrast: boolean;
  private _colorblindMode: string;

  private _contentContainer: ScrollContainer;
  private _controls: Map<string, Toggle | Slider | SegmentedControl> = new Map();
  private _headerText: Text;
  private _labelTexts: { node: Text; baseSize: number }[] = [];
  private _exportButton: Button | null = null;
  private _exportTraceButton: Button | null = null;
  private _traceExporter: (() => string | null) | null = null;
  private _exitButton: Button | null = null;
  private _privacyToggle: Toggle | null = null;
  private _budgetController: PanelBudgetController | null;
  private _disposed = false;

  constructor(options: SettingsPanelOptions) {
    const palette = SettingsPanel._palette(options.highContrast ?? false, options.colorblindMode ?? 'none');
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        padding: SPACING_TOKENS.panel.outerPadding,
        gap: SPACING_TOKENS.grid.x8,
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1.5,
        borderRadius: 12,
      },
      options.torsoAnchor,
      options.worldScene,
    );
    this.name = 'settings-panel';

    this.scale.setScalar(PANEL_WORLD_WIDTH / PANEL_WIDTH);

    this.onChange = options.onChange ?? (() => {});
    this._onExitVR = options.onExitVR ?? null;
    this.settings = this._loadSettings();

    this._telemetryCollector = options.telemetryCollector ?? null;
    this._performanceBudget = options.performanceBudget ?? null;
    this._traceExporter = options.traceExporter ?? null;
    this._dataset = options.dataset ?? null;
    this._datasetTopology = options.datasetTopology ?? '-';
    this._sessionDurationSeconds = options.sessionDurationSeconds ?? 0;
    this._userNotes = options.userNotes ?? '';
    this._exportPrivacyLevel = 'metadata';

    this._textScale = options.textScale ?? this.settings.textScale;
    this._highContrast = options.highContrast ?? this.settings.highContrast;
    this._colorblindMode = options.colorblindMode ?? this.settings.colorblindMode;
    this._budgetController = options.panelBudgetController ?? null;

    const pos = options.position ?? [0.65, 1.55, -1.1];
    this.defaultPosition = new THREE.Vector3(pos[0], pos[1], pos[2]);
    this.position.copy(this.defaultPosition);

    const header = new Text({
      text: '// SETTINGS',
      fontSize: 22 * this._textScale,
      color: palette.accent,
      fontWeight: 'bold',
    });
    this.add(header);
    this._headerText = header;

    this._contentContainer = new ScrollContainer({
      scrollHeight: PANEL_HEIGHT - 120,
      flexGrow: 1,
    });
    this.add(this._contentContainer);

    this._buildContent();
    this._buildFooter(palette);
  }

  static _palette(highContrast: boolean, colorblindMode: string): Palette {
    const theme = getTheme(highContrast);
    const accent = highContrast
      ? Number(theme.accentColor)
      : (remapColor(COLOR_TOKENS.interaction.focus, colorblindMode) as number);
    return {
      bg: Number(theme.backgroundColor),
      border: Number(theme.borderColor),
      text: Number(theme.textPrimary),
      textMuted: Number(theme.textMuted),
      accent,
      danger: Number(theme.dangerColor),
    };
  }

  /**
   * Governed development/Quest validation tracing is intentionally always on.
   * The privacy UI must reflect that effective policy instead of persisting an
   * impossible off-state while the recorder continues collecting evidence.
   */
  private _effectiveSetting<K extends keyof SettingsMap & string>(
    key: K,
    value: SettingsMap[K]
  ): SettingsMap[K] {
    if (key === 'prodTraceEnabled' && import.meta.env.DEV) {
      return true as SettingsMap[K];
    }
    return value;
  }

  private _loadSettings(): SettingsMap {
    try {
      const raw = localStorage.getItem(SettingsPanel.STORAGE_KEY);
      const loaded = raw
        ? { ...SettingsPanel.DEFAULTS, ...(JSON.parse(raw) as Partial<SettingsMap>) }
        : { ...SettingsPanel.DEFAULTS };
      if (import.meta.env.DEV) loaded.prodTraceEnabled = true;
      return loaded;
    } catch {
      const loaded = { ...SettingsPanel.DEFAULTS };
      if (import.meta.env.DEV) loaded.prodTraceEnabled = true;
      return loaded;
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
    const effectiveValue = this._effectiveSetting(key, value);
    this.settings[key] = effectiveValue;
    this._saveSettings();
    const control = this._controls.get(key);
    if (control) {
      if (control instanceof Toggle) control.value = Boolean(effectiveValue);
      else if (control instanceof Slider) control.value = Number(effectiveValue);
      else if (control instanceof SegmentedControl) control.value = String(effectiveValue);
    }
    this.onChange(key, effectiveValue);
  }

  getSetting<K extends keyof SettingsMap & string>(key: K): SettingsMap[K] {
    return this.settings[key];
  }

  getAllSettings(): SettingsMap {
    return { ...this.settings };
  }

  getSettingSections(): readonly string[] {
    const seen = new Set<string>();
    const sections: string[] = [];
    for (const desc of SETTINGS) {
      if (!seen.has(desc.section)) {
        seen.add(desc.section);
        sections.push(desc.section);
      }
    }
    return sections;
  }

  getSettingSection(key: string): string | undefined {
    return SETTINGS.find((d) => d.key === key)?.section;
  }

  show(): void {
    this._budgetController?.open(this, 'primary');
    this.visible = true;
    this.position.copy(this.defaultPosition);
    this.updateMatrixWorld();
  }

  hide(): void {
    this._budgetController?.close(this);
    this.visible = false;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  update(delta?: number): void {
    if (!this.visible) return;
    super.update(delta ?? 0);
    this.lookAt(0, 0, 0);
    this.rotation.x = -0.22;
  }

  applyAccessibility(options: AccessibilityOptions): void {
    const { textScale, highContrast, colorblindMode, reduceMotion } = options;
    let themeChanged = false;
    if (highContrast != null && this._highContrast !== highContrast) {
      this._highContrast = highContrast;
      themeChanged = true;
    }
    if (colorblindMode != null && this._colorblindMode !== String(colorblindMode)) {
      this._colorblindMode = String(colorblindMode);
      themeChanged = true;
    }
    if (textScale != null && this._textScale !== textScale) {
      this._textScale = textScale;
    }
    if (reduceMotion != null && this.settings.reducedMotion !== reduceMotion) {
      this.settings.reducedMotion = reduceMotion;
      this._saveSettings();
      const control = this._controls.get('reducedMotion');
      if (control instanceof Toggle) control.value = reduceMotion;
    }

    if (themeChanged) {
      this._rebuildForTheme();
    } else if (textScale != null) {
      this._applyTextScale();
    }
  }

  override dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._budgetController?.close(this);
    this._controls.clear();
    this._labelTexts = [];
    super.dispose();
  }

  private _buildContent(): void {
    this._contentContainer.clear();
    this._controls.clear();
    this._labelTexts = [];
    const palette = SettingsPanel._palette(this._highContrast, this._colorblindMode);

    let currentSection = '';
    for (const desc of SETTINGS) {
      if (desc.section !== currentSection) {
        currentSection = desc.section;
        const sectionHeader = new SectionHeader({ title: desc.section, color: palette.accent });
        this._contentContainer.add(sectionHeader);
      }

      const row = new Container({
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        gap: SPACING_TOKENS.grid.x12,
        paddingX: SPACING_TOKENS.grid.x4,
      });

      const label = new Text({
        text: desc.label,
        fontSize: 16 * this._textScale,
        color: palette.text,
      });
      this._labelTexts.push({ node: label, baseSize: 16 });
      row.add(label);
      row.add(this._buildControl(desc, palette));
      this._contentContainer.add(row);
    }

    this._labelTexts.push({ node: this._headerText, baseSize: 22 });
  }

  private _buildControl(desc: SettingDescriptor, _palette: Palette): Toggle | Slider | SegmentedControl {
    const value = this.settings[desc.key];

    if (desc.type === 'toggle') {
      const toggle = new Toggle({
        value: Boolean(value),
        onChange: (v) => this.setSetting(desc.key, v as SettingsMap[typeof desc.key]),
      });
      this._controls.set(desc.key, toggle);
      return toggle;
    }

    if (desc.type === 'stepper') {
      const slider = new Slider({
        value: Number(value),
        min: Number(desc.min),
        max: Number(desc.max),
        step: Number(desc.step),
        width: 160,
        formatValue: desc.format ?? ((v: number) => v.toFixed(2)),
        onChange: (v) => this.setSetting(desc.key, v as SettingsMap[typeof desc.key]),
      });
      this._controls.set(desc.key, slider);
      return slider;
    }

    const segmented = new SegmentedControl({
      options: desc.choices ?? [],
      value: String(value),
      onChange: (v) => this.setSetting(desc.key, v as SettingsMap[typeof desc.key]),
    });
    this._controls.set(desc.key, segmented);
    return segmented;
  }

  private _buildFooter(palette: Palette): void {
    const footer = new Container({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x8,
      paddingX: SPACING_TOKENS.grid.x4,
    });

    const exportRow = new Container({
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      gap: SPACING_TOKENS.grid.x12,
    });
    const privacyLabel = new Text({
      text: `Bundle: ${this._exportPrivacyLevel}`,
      fontSize: 14 * this._textScale,
      color: palette.textMuted,
    });
    this._labelTexts.push({ node: privacyLabel, baseSize: 14 });
    this._privacyToggle = new Toggle({
      value: this._exportPrivacyLevel === 'full-session',
      onChange: (v) => {
        this._exportPrivacyLevel = v ? 'full-session' : 'metadata';
        privacyLabel.setProperties({ text: `Bundle: ${this._exportPrivacyLevel}` });
      },
    });
    this._exportButton = new Button({
      label: 'EXPORT BUNDLE',
      variant: 'primary',
      onClick: () => this._exportReviewBundle(),
    });
    exportRow.add(privacyLabel);
    exportRow.add(this._privacyToggle);
    exportRow.add(this._exportButton);
    footer.add(exportRow);

    const traceRow = new Container({
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      gap: SPACING_TOKENS.grid.x12,
    });
    const traceLabel = new Text({
      text: 'Trace: local-only export',
      fontSize: 14 * this._textScale,
      color: palette.textMuted,
    });
    this._labelTexts.push({ node: traceLabel, baseSize: 14 });
    this._exportTraceButton = new Button({
      label: 'EXPORT TRACE',
      variant: 'primary',
      onClick: () => this._exportTrace(),
    });
    traceRow.add(traceLabel);
    traceRow.add(this._exportTraceButton);
    footer.add(traceRow);

    this._exitButton = new Button({
      label: 'EXIT IMMERSIVE VR',
      variant: 'danger',
      onClick: () => this._onExitVR?.(),
    });
    footer.add(this._exitButton);

    this.add(footer);
  }

  private _rebuildForTheme(): void {
    const palette = SettingsPanel._palette(this._highContrast, this._colorblindMode);
    this.setProperties({
      backgroundColor: palette.bg,
      borderColor: palette.border,
    });
    this._buildContent();
    if (this.children.length > 0) {
      const last = this.children[this.children.length - 1];
      if (last instanceof Container && !(last instanceof ScrollContainer)) {
        this.remove(last);
      }
    }
    this._buildFooter(palette);
  }

  private _applyTextScale(): void {
    for (const { node, baseSize } of this._labelTexts) {
      node.setProperties({ fontSize: baseSize * this._textScale });
    }
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
      () => {},
    );
  }

  /**
   * User-initiated trace export. The exporter closure returns locally
   * buffered JSON (or null when nothing is recorded); the download is the
   * only way trace data leaves memory. No network call is made here.
   */
  private _exportTrace(): void {
    let payload: string | null = null;
    try {
      payload = this._traceExporter?.() ?? null;
    } catch {
      payload = null;
    }
    if (!payload) return;
    downloadText(payload, 'nemosyne-ux-trace.json', 'application/json').catch(() => {});
  }
}
