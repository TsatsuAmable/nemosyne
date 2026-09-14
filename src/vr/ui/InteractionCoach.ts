import * as THREE from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import { getGestureMeta } from '../../utils/GestureMapping.ts';
import type { AccessibilityOptions, MovablePanelOptions, UserMode } from '../coordinators/types.ts';

export interface InteractionCoachOptions extends MovablePanelOptions {
  userMode?: UserMode;
  maxEntries?: number;
}

interface GestureMeta {
  label?: string;
  icon?: string;
  controller?: string;
}

interface CoachEntry {
  time: number;
  action: string;
  gesture: string | null;
  controller: string | null;
  result?: string;
}

const PANEL_WIDTH = 800;
const PANEL_HEIGHT = 700;

export class InteractionCoach extends SpatialPanel {
  readonly title = 'INTERACTION COACH';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  userMode: UserMode;
  private _requestedMaxEntries: number;
  maxEntries: number;
  entries: CoachEntry[];
  private readonly _content: Text;
  private _textScale: number;
  private _highContrast: boolean;

  constructor(analystAnchor: THREE.Object3D, options: InteractionCoachOptions = {}) {
    const highContrast = options.highContrast ?? false;
    const theme = getTheme(highContrast);
    super({
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x8,
      padding: SPACING_TOKENS.grid.x16,
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
      borderWidth: 2,
      borderRadius: 8,
    }, options.parentGroup ?? analystAnchor, null);

    this.name = 'interaction-coach';
    this.userMode = options.userMode ?? 'novice';
    this._requestedMaxEntries = options.maxEntries ?? 16;
    this.maxEntries = this._effectiveMaxEntries();
    this.entries = [];
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;

    const worldWidth = options.worldSize?.[0] ?? 0.8;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [0.75, 1.45, -1.0]));
    this.position.copy(this.defaultPosition);

    this._content = new Text({
      text: '',
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this.add(this._content);
    this.render();
  }

  private _effectiveMaxEntries(): number {
    if (this.userMode === 'expert') return 0;
    if (this.userMode === 'intermediate') return 1;
    return this._requestedMaxEntries;
  }

  setUserMode(mode: UserMode | string): void {
    const valid: UserMode = ['novice', 'intermediate', 'expert'].includes(mode)
      ? (mode as UserMode)
      : 'novice';
    if (this.userMode === valid) return;

    this.userMode = valid;
    this.maxEntries = this._effectiveMaxEntries();
    if (this.userMode === 'expert') {
      this.entries = [];
    } else if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }
    this.render();
  }

  log({ action, gesture, controller, result }: {
    action: string;
    gesture?: string;
    controller?: string;
    result?: string;
  }): void {
    if (this.userMode === 'expert') return;

    const meta = gesture ? (getGestureMeta(gesture) as GestureMeta | null) : null;
    const controllerText = controller ?? meta?.controller ?? null;
    const gestureText = gesture ? ((meta?.icon ?? '') + ' ' + (meta?.label ?? gesture)).trim() : null;

    this.entries.unshift({
      time: Date.now(),
      action,
      gesture: gestureText,
      controller: controllerText,
      result,
    });
    if (this.entries.length > this.maxEntries) this.entries.length = this.maxEntries;
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
      text: this._formatContent(),
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });
  }

  private _formatContent(): string {
    if (this.userMode === 'expert') {
      return [
        'Expert mode',
        '',
        'Gesture and controller help are disabled.',
        'Open this panel from the wheel menu to re-enable.',
      ].join('\n');
    }

    const lines = [
      this.userMode === 'intermediate'
        ? 'Recent interaction (last only)'
        : 'Recent interactions (newest first)',
      '',
    ];

    if (this.entries.length === 0) {
      lines.push('Perform a gesture, controller action, or menu selection to see it here.');
      return lines.join('\n');
    }

    for (const entry of this.entries) {
      const resultText = entry.result ? ' -> ' + entry.result : '';
      lines.push(entry.action + resultText);
      const inputs: string[] = [];
      if (entry.gesture) inputs.push(entry.gesture);
      if (entry.controller) inputs.push(entry.controller);
      lines.push(inputs.length ? inputs.join('  |  ') : 'Wheel menu / panel', '');
    }
    return lines.join('\n').trimEnd();
  }
}
