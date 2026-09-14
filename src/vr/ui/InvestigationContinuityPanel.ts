import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import type { InvestigationContinuityController } from '../../app/investigation/InvestigationContinuityController.ts';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { AccessibilityOptions } from '../coordinators/types.ts';

type ContinuityAction = 'refresh' | 'save' | 'checkpoint' | 'restore' | 'recover' | 'export' | 'open';

interface ContinuityButton {
  id: ContinuityAction;
  label: string;
  enabled: boolean;
}

function downloadPackage(bytes: Uint8Array): void {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: 'application/vnd.nemosyne+zip',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'nemosyne-investigation-' + new Date().toISOString().slice(0, 10) + '.nemosyne';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function choosePackage(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.nemosyne,application/vnd.nemosyne+zip,application/zip';
    input.hidden = true;
    document.body.appendChild(input);
    let settled = false;
    const finish = (value: Uint8Array | null): void => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      void file.arrayBuffer()
        .then((buffer) => finish(new Uint8Array(buffer)))
        .catch(() => finish(null));
    }, { once: true });
    input.click();
  });
}

const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 700;

export class InvestigationContinuityPanel extends SpatialPanel {
  readonly title = 'SAVE & RECOVER';
  readonly defaultPosition = new THREE.Vector3(-0.7, 1.45, -1.05);
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  private readonly continuity: InvestigationContinuityController;
  private busy = false;
  private hasCheckpoint = false;
  private canRecoverAutosave: boolean | null = null;
  status = 'Ready';
  buttons: ContinuityButton[] = [];

  private readonly _statusText: Text;
  private readonly _actions: Container;
  private _actionButtons: Button[] = [];
  private _textScale = 1;
  private _highContrast = false;

  constructor(analystAnchor: THREE.Object3D, continuity: InvestigationContinuityController) {
    const theme = getTheme(false);
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
    }, analystAnchor, null);

    this.name = 'investigation-continuity-panel';
    this.continuity = continuity;
    this.scale.setScalar(0.86 / PANEL_WIDTH);
    this.position.copy(this.defaultPosition);

    this._statusText = new Text({
      text: '',
      fontSize: 16,
      color: Number(theme.textPrimary),
    });
    this._actions = new Container({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x8,
    });
    this.add(this._statusText, this._actions);

    this.registerButtons();
    this.render();
    void this.refreshContinuity();
  }

  async refreshContinuity(): Promise<void> {
    try {
      const summary = await this.continuity.summary();
      this.hasCheckpoint = Boolean(summary.latestCheckpoint);
      this.canRecoverAutosave = summary.canRecoverAutosave;
      this.status = summary.latestCheckpoint
        ? String(summary.checkpointCount) + ' saved ' +
          (summary.checkpointCount === 1 ? 'checkpoint' : 'checkpoints') +
          ' · latest ' + summary.latestCheckpoint.label
        : 'No checkpoints yet';
    } catch (error) {
      this.status = error instanceof Error ? error.message : String(error);
    }
    this.registerButtons();
    this.render();
  }

  private registerButtons(): void {
    const add = (id: ContinuityAction, label: string, enabled = true): void => {
      this.buttons.push({ id, label, enabled: enabled && !this.busy });
    };
    this.buttons = [];
    add('refresh', 'Refresh save status');
    add('save', 'Save now');
    add('checkpoint', 'Create checkpoint');
    add('restore', 'Restore latest checkpoint', this.hasCheckpoint);
    add('recover', 'Recover autosave', this.canRecoverAutosave !== false);
    add('export', 'Export .nemosyne');
    add('open', 'Open .nemosyne');
  }

  private async run(action: () => Promise<string>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.registerButtons();
    this.render();
    try {
      this.status = await action();
    } catch (error) {
      this.status = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.registerButtons();
      this.render();
    }
  }

  async activate(id: ContinuityAction): Promise<void> {
    const button = this.buttons.find((candidate) => candidate.id === id);
    if (!button?.enabled) return;

    if (id === 'refresh') {
      await this.refreshContinuity();
      return;
    }
    if (id === 'save') {
      await this.run(async () => {
        await this.continuity.saveNow();
        return 'Investigation saved locally';
      });
      return;
    }
    if (id === 'checkpoint') {
      await this.run(async () => {
        const entry = await this.continuity.createCheckpoint();
        await this.refreshContinuity();
        return 'Checkpoint created · ' + entry.discoveryCount + ' discoveries';
      });
      return;
    }
    if (id === 'restore') {
      await this.run(async () => {
        const entry = await this.continuity.restoreLatestCheckpoint();
        return 'Checkpoint restored · ' + entry.label;
      });
      return;
    }
    if (id === 'recover') {
      await this.run(async () => {
        const restored = await this.continuity.recoverAutosave();
        return restored ? 'Autosave recovered' : 'No recoverable autosave was found';
      });
      return;
    }
    if (id === 'export') {
      await this.run(async () => {
        const bytes = await this.continuity.exportCurrent();
        downloadPackage(bytes);
        return 'Portable investigation ready · ' + bytes.byteLength + ' bytes';
      });
      return;
    }
    if (id === 'open') {
      const bytes = await choosePackage();
      if (!bytes) {
        this.status = 'Open cancelled · current investigation unchanged';
        this.render();
        return;
      }
      await this.run(async () => {
        const result = await this.continuity.openPortable(bytes);
        return result.message;
      });
    }
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
    this._statusText.setProperties({
      text: 'INVESTIGATION CONTINUITY\nSave, checkpoint, carry or recover your work\n\n' + this.status,
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });

    for (const button of this._actionButtons) {
      this._actions.remove(button);
      button.dispose();
    }
    this._actionButtons = [];

    for (const action of this.buttons) {
      const button = new Button({
        label: action.label,
        variant: action.id === 'restore' || action.id === 'recover' ? 'secondary' : 'primary',
        disabled: !action.enabled,
        onClick: () => {
          void this.activate(action.id);
        },
      });
      this._actionButtons.push(button);
      this._actions.add(button);
    }
  }
}
