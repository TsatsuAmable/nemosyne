import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import { getGestureMeta } from '../../utils/GestureMapping.ts';
import type { MovablePanelOptions, UserMode } from '../coordinators/types.ts';

export interface InteractionCoachOptions extends MovablePanelOptions {
  userMode?: UserMode;
  maxEntries?: number;
}

interface GestureMeta {
  label?: string;
  icon?: string;
  controller?: string;
  hand?: string;
  action?: string;
}

interface CoachEntry {
  time: number;
  action: string;
  gesture: string | null;
  controller: string | null;
  result?: string;
}

/**
 * Running commentary panel that teaches gesture and controller navigation.
 *
 * Every significant interaction (gesture, controller action, wheel menu
 * selection, data operation, portal warp) is logged with:
 *   - a human-readable description
 * - the hand gesture that triggered it (if any)
 * - the Meta Quest controller equivalent
 * - a timestamp
 *
 * The panel is meant to sit beside the analyst so they can learn the
 * gesture/controller vocabulary by seeing the system react in real time.
 */
export class InteractionCoach extends MovablePanel {
  userMode: UserMode;
  private _requestedMaxEntries: number;
  maxEntries: number;
  entries: CoachEntry[];

  constructor(cameraGroup: THREE.Group, options: InteractionCoachOptions = {}) {
    super(cameraGroup, {
      title: 'INTERACTION COACH',
      width: 800,
      height: 700,
      position: options.position ?? [0.75, 1.45, -1.0],
      worldSize: options.worldSize ?? [0.8, 0.7],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
      parentGroup: options.parentGroup ?? null,
    });

    this.userMode = options.userMode ?? 'novice';
    this._requestedMaxEntries = options.maxEntries ?? 16;
    this.maxEntries = this._effectiveMaxEntries();
    this.entries = [];
    this.render();
  }

  private _effectiveMaxEntries(): number {
    if (this.userMode === 'expert') return 0;
    if (this.userMode === 'intermediate') return 1;
    return this._requestedMaxEntries;
  }

  setUserMode(mode: UserMode | string): void {
    const valid: UserMode = ['novice', 'intermediate', 'expert'].includes(mode) ? (mode as UserMode) : 'novice';
    if (this.userMode === valid) return;
    this.userMode = valid;
    this.maxEntries = this._effectiveMaxEntries();
    if (this.userMode === 'expert') {
      this.entries = [];
    } else {
      while (this.entries.length > this.maxEntries) {
        this.entries.pop();
      }
    }
    this.render();
  }

  /**
   * Log a general interaction event.
   * @param param
   * @param param.action - short action label, e.g. 'Filter'
   * @param param.gesture - gesture name from HandGestureRecognizer
   * @param param.controller - controller input description
   * @param param.result - outcome text, e.g. '12 rows'
   */
  log({ action, gesture, controller, result }: { action: string; gesture?: string; controller?: string; result?: string }): void {
    if (this.userMode === 'expert') return;

    const meta = gesture ? (getGestureMeta(gesture) as GestureMeta | null) : null;
    const controllerText = controller ?? meta?.controller ?? null;
    const gestureText = gesture ? `${meta?.icon ?? ''} ${meta?.label ?? gesture}`.trim() : null;

    this.entries.unshift({
      time: Date.now(),
      action,
      gesture: gestureText,
      controller: controllerText,
      result,
    });

    while (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }

    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const margin = 24;
    const lineHeight = 26;
    const rowPad = 10;
    const rowHeight = lineHeight * 2 + rowPad * 2;
    let y = margin;

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.textAlign = 'left';

    if (this.userMode === 'expert') {
      ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.primary) : cssHex(COLOR_TOKENS.interaction.focus);
      ctx.fillText('Expert mode', margin, y + lineHeight / 2);
      y += lineHeight + margin;
      ctx.font = this._scaleFont('16px monospace');
      ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.muted) : cssHex(COLOR_TOKENS.text.muted);
      ctx.fillText(
        'Gesture and controller help are disabled. Open this panel from the wheel menu to re-enable.',
        margin,
        y + lineHeight / 2
      );
      return;
    }

    ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.primary) : cssHex(COLOR_TOKENS.interaction.focus);
    const header =
      this.userMode === 'intermediate'
        ? 'Recent interaction (last only)'
        : 'Recent interactions (newest first)';
    ctx.fillText(header, margin, y + lineHeight / 2);
    y += lineHeight + margin;

    if (this.entries.length === 0) {
      ctx.font = this._scaleFont('16px monospace');
      ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.muted) : cssHex(COLOR_TOKENS.text.muted);
      ctx.fillText(
        'Perform a gesture, controller action, or menu selection to see it here.',
        margin,
        y + lineHeight / 2
      );
      return;
    }

    for (const entry of this.entries) {
      if (y + rowHeight > contentH - margin) break;

      // Row background.
      ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus) + '10';
      ctx.fillRect(margin, y, w - margin * 2, rowHeight);
      ctx.strokeStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.primary) : cssHex(COLOR_TOKENS.interaction.focus) + '40';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, w - margin * 2, rowHeight);

      // Action + result.
      ctx.font = this._scaleFont('bold 16px monospace');
      ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.primary) : cssHex(COLOR_TOKENS.text.secondary);
      const resultText = entry.result ? ` → ${entry.result}` : '';
      ctx.fillText(`${entry.action}${resultText}`, margin + 10, y + lineHeight);

      // Input source line.
      ctx.font = this._scaleFont('14px monospace');
      ctx.fillStyle = this.highContrast ? cssHex(COLOR_TOKENS.text.secondary) : cssHex(COLOR_TOKENS.text.secondary);
      const inputParts: string[] = [];
      if (entry.gesture) inputParts.push(entry.gesture);
      if (entry.controller) inputParts.push(entry.controller);
      const inputText = inputParts.length ? inputParts.join('  |  ') : 'Wheel menu / panel';
      ctx.fillText(inputText, margin + 10, y + lineHeight * 2);

      y += rowHeight + 6;
    }
  }
}
