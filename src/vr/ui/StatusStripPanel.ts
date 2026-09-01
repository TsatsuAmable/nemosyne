import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import type { MovablePanelOptions } from '../coordinators/types.ts';
import { StatusStripController } from './StatusStripController.ts';
import { COLOR_TOKENS, SPACING_TOKENS, TYPOGRAPHY_TOKENS, cssHex } from '../ui-system/tokens.ts';

interface StatusStripPanelOptions extends MovablePanelOptions {
  statusStrip: StatusStripController;
}

/**
 * Persistent, analyst-anchored investigation grounding surface.
 *
 * C2 deliberately keeps this compact and non-interactive: it projects state
 * that is acted upon through the existing contextual and precision surfaces.
 */
export class StatusStripPanel extends MovablePanel {
  private readonly _statusStrip: StatusStripController;
  private _lastText: string = '';
  private _dirty = true;

  constructor(cameraGroup: THREE.Group, options: StatusStripPanelOptions) {
    // WorldUIManager historically passed the one-line 0.72 × 0.08 metre size.
    // Upgrade exactly that legacy footprint for C2's four calm rows while still
    // respecting any explicit non-legacy override supplied by tests/consumers.
    const requestedWorldSize = options.worldSize;
    const worldSize: [number, number] =
      !requestedWorldSize ||
      (requestedWorldSize[0] === 0.72 && requestedWorldSize[1] === 0.08)
        ? [0.9, 0.156]
        : requestedWorldSize;

    super(cameraGroup, {
      title: 'STATUS',
      width: options.width ?? 900,
      height: options.height ?? 156,
      position: options.position ?? [0, 1.8, -1.2],
      worldSize,
      titleBarHeight: 0,
      tilt: 0,
      parentGroup: options.parentGroup,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });
    this._statusStrip = options.statusStrip;
    this.render();
  }

  update(): void {
    const text = this._statusStrip.formatInvestigationLines().join('\n');
    if (text !== this._lastText) {
      this._lastText = text;
      this._dirty = true;
    }
    if (this._dirty) {
      this._dirty = false;
      this.render();
    }
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const pad = SPACING_TOKENS.grid.x16;
    const lines = this._statusStrip.formatInvestigationLines();
    const lineHeight = 31;
    const firstY = 28;

    ctx.fillStyle = 'rgba(11, 17, 25, 0.90)';
    ctx.fillRect(0, 0, w, contentH);

    ctx.strokeStyle = cssHex(COLOR_TOKENS.surface.border);
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, contentH - 4);

    ctx.font = this._scaleFont(`600 ${TYPOGRAPHY_TOKENS.scale.label}px ${TYPOGRAPHY_TOKENS.fontFamily}`);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    lines.forEach((line, index) => {
      ctx.fillStyle = index === 0
        ? cssHex(COLOR_TOKENS.text.primary)
        : index === 1
          ? cssHex(COLOR_TOKENS.interaction.focus)
          : cssHex(COLOR_TOKENS.text.secondary);
      ctx.fillText(line, pad, firstY + index * lineHeight, w - pad * 2);
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}
