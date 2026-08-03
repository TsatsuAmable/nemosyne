import { MovablePanel } from './MovablePanel.js';
import { getGestureMeta } from '../../utils/GestureMapping.js';

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
  constructor(cameraGroup, options = {}) {
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
    });

    this.maxEntries = options.maxEntries ?? 16;
    this.entries = [];
    this.render();
  }

  /**
   * Log a general interaction event.
   * @param {Object} param
   * @param {string} param.action - short action label, e.g. 'Filter'
   * @param {string} [param.gesture] - gesture name from HandGestureRecognizer
   * @param {string} [param.controller] - controller input description
   * @param {string} [param.result] - outcome text, e.g. '12 rows'
   */
  log({ action, gesture, controller, result }) {
    const meta = gesture ? getGestureMeta(gesture) : null;
    const controllerText = controller ?? meta?.controller ?? null;
    const gestureText = gesture ? `${meta?.icon ?? ''} ${meta?.label ?? gesture}` : null;

    this.entries.unshift({
      time: Date.now(),
      action,
      gesture: gestureText,
      controller: controllerText,
      result,
    });

    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }

    this.render();
  }

  renderContent(ctx, w, contentH) {
    const margin = 24;
    const lineHeight = 26;
    const rowPad = 10;
    const rowHeight = lineHeight * 2 + rowPad * 2;
    let y = margin;

    ctx.font = this._scaleFont('bold 18px monospace');
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#00ffff';
    ctx.textAlign = 'left';
    ctx.fillText('Recent interactions (newest first)', margin, y + lineHeight / 2);
    y += lineHeight + margin;

    if (this.entries.length === 0) {
      ctx.font = this._scaleFont('16px monospace');
      ctx.fillStyle = this.highContrast ? '#aaaaaa' : '#778899';
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
      ctx.fillStyle = 'rgba(0, 255, 204, 0.06)';
      ctx.fillRect(margin, y, w - margin * 2, rowHeight);
      ctx.strokeStyle = this.highContrast ? '#ffffff' : 'rgba(0, 255, 204, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, w - margin * 2, rowHeight);

      // Action + result.
      ctx.font = this._scaleFont('bold 16px monospace');
      ctx.fillStyle = this.highContrast ? '#ffffff' : '#ccffff';
      const resultText = entry.result ? ` → ${entry.result}` : '';
      ctx.fillText(`${entry.action}${resultText}`, margin + 10, y + lineHeight);

      // Input source line.
      ctx.font = this._scaleFont('14px monospace');
      ctx.fillStyle = this.highContrast ? '#cccccc' : '#88ccaa';
      const inputParts = [];
      if (entry.gesture) inputParts.push(entry.gesture);
      if (entry.controller) inputParts.push(entry.controller);
      const inputText = inputParts.length ? inputParts.join('  |  ') : 'Wheel menu / panel';
      ctx.fillText(inputText, margin + 10, y + lineHeight * 2);

      y += rowHeight + 6;
    }
  }
}
