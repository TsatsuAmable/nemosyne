import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.js';

/**
 * In-VR settings panel for gesture, statistical-lens, feedback, telemetry,
 * and accessibility customization. Settings are persisted to localStorage and
 * synced with the World through an `onChange` callback.
 *
 * The panel renders large, high-contrast toggle rows so they are readable and
 * clickable with a hand pointer in the Meta Quest 3S.
 */
export class SettingsPanel extends MovablePanel {
  static STORAGE_KEY = 'nemosyne-vr-settings';

  static DEFAULTS = {
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
    strictBudget: false,
    collabEnabled: false,
    collabRoom: 'default',
    collabName: 'Analyst',
    userMode: 'novice',
  };

  constructor(cameraGroup, options = {}) {
    super(cameraGroup, {
      title: 'SETTINGS',
      width: 900,
      height: 820,
      position: options.position ?? [0.65, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.9, 0.82],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });

    this.onChange = options.onChange ?? (() => {});
    this.settings = this._loadSettings();

    this._buttons = [];
    this._buildButtons();
    this.render();
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(SettingsPanel.STORAGE_KEY);
      return raw
        ? { ...SettingsPanel.DEFAULTS, ...JSON.parse(raw) }
        : { ...SettingsPanel.DEFAULTS };
    } catch {
      return { ...SettingsPanel.DEFAULTS };
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem(SettingsPanel.STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Storage may be unavailable in private mode or test environments.
    }
  }

  setSetting(key, value) {
    if (!(key in this.settings)) return;
    this.settings[key] = value;
    this._saveSettings();
    this.onChange(key, value);
    this.render();
  }

  getSetting(key) {
    return this.settings[key];
  }

  getAllSettings() {
    return { ...this.settings };
  }

  _buildButtons() {
    const labels = [
      {
        key: 'userMode',
        label: 'User Mode',
        section: 'USER MODE',
        type: 'choice',
        choices: ['novice', 'intermediate', 'expert'],
      },
      { key: 'lensTDA', label: 'TDA Summary Lens', section: 'STATISTICAL LENS' },
      { key: 'lensCorrelation', label: 'Correlation Matrix', section: 'STATISTICAL LENS' },
      { key: 'feedbackAudio', label: 'Audio Feedback', section: 'FEEDBACK' },
      { key: 'feedbackHaptic', label: 'Haptic Feedback', section: 'FEEDBACK' },
      { key: 'feedbackVisual', label: 'Visual Feedback', section: 'FEEDBACK' },
      { key: 'gesturesEnabled', label: 'Hand Gestures', section: 'GESTURES' },
      { key: 'telemetryEnabled', label: 'Telemetry Opt-in', section: 'PRIVACY' },
      { key: 'highContrast', label: 'High Contrast', section: 'ACCESSIBILITY' },
      { key: 'dwellSelection', label: 'Dwell Select', section: 'ACCESSIBILITY' },
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
    let currentSection = null;

    for (const item of labels) {
      if (item.section !== currentSection) {
        currentSection = item.section;
        y += 24; // section gap
      }

      const type = item.type || 'toggle';
      let bounds;
      let stepperBounds = null;
      let choiceBounds = null;

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
      } else if (type === 'choice') {
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

  renderContent(ctx, w, contentH) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let currentSection = null;
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
        this._renderStepper(ctx, x, y, bw, h, this.settings[btn.key], btn.stepperBounds);
      } else if (btn.type === 'choice') {
        this._renderChoice(ctx, x, y, bw, h, this.settings[btn.key], btn.choices, btn.choiceBounds);
      }
    }
  }

  _renderToggle(ctx, x, y, w, h, on) {
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

  _renderStepper(ctx, x, y, w, h, value, bounds) {
    ctx.fillStyle = 'rgba(60, 60, 80, 0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = this.highContrast ? '#ffffff' : '#778899';
    ctx.lineWidth = this.highContrast ? 4 : 3;
    ctx.strokeRect(x, y, w, h);

    // Decrement arrow.
    const decActive = value > this._buttons.find((b) => b.stepperBounds === bounds)?.min;
    ctx.fillStyle = decActive
      ? `#${this.remapColor(0x00ffcc).toString(16).padStart(6, '0')}`
      : '#445566';
    ctx.fillRect(bounds.dec.x, bounds.dec.y, bounds.dec.w, bounds.dec.h);
    ctx.strokeRect(bounds.dec.x, bounds.dec.y, bounds.dec.w, bounds.dec.h);

    // Increment arrow.
    const incActive = value < this._buttons.find((b) => b.stepperBounds === bounds)?.max;
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

  _renderChoice(ctx, x, y, w, h, value, choices, bounds) {
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

  handleContentClick(worldRaycaster) {
    const hits = worldRaycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return false;

    const uv = hits[0].uv;
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
        const dec = btn.stepperBounds.dec;
        const inc = btn.stepperBounds.inc;
        const current = Number(this.settings[btn.key]);
        if (cx >= dec.x && cx <= dec.x + dec.w && cy >= dec.y && cy <= dec.y + dec.h) {
          this.setSetting(btn.key, Math.max(btn.min, current - btn.step));
          return true;
        }
        if (cx >= inc.x && cx <= inc.x + inc.w && cy >= inc.y && cy <= inc.y + inc.h) {
          this.setSetting(btn.key, Math.min(btn.max, current + btn.step));
          return true;
        }
      } else if (btn.type === 'choice') {
        const prev = btn.choiceBounds.prev;
        const next = btn.choiceBounds.next;
        const choices = btn.choices;
        const idx = choices.indexOf(this.settings[btn.key]);
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
    return false;
  }
}
