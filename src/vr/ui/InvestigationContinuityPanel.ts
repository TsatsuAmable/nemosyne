import * as THREE from 'three';
import type { InvestigationContinuityController } from '../../app/investigation/InvestigationContinuityController.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import { MovablePanel } from './MovablePanel.ts';

type ContinuityAction = 'refresh' | 'save' | 'checkpoint' | 'restore' | 'recover' | 'export' | 'open';

interface ContinuityButton {
  id: ContinuityAction;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
}

function downloadPackage(bytes: Uint8Array): void {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: 'application/vnd.nemosyne+zip',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `nemosyne-investigation-${new Date().toISOString().slice(0, 10)}.nemosyne`;
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

/** XR presentation for the same PT5D continuity controller used by desktop. */
export class InvestigationContinuityPanel extends MovablePanel {
  private readonly continuity: InvestigationContinuityController;
  private busy = false;
  private checkpointCount = 0;
  private hasCheckpoint = false;
  private canRecoverAutosave: boolean | null = null;
  status = 'Ready';
  buttons: ContinuityButton[] = [];

  constructor(cameraGroup: THREE.Group, continuity: InvestigationContinuityController) {
    super(cameraGroup, {
      title: 'SAVE & RECOVER',
      width: 720,
      height: 700,
      position: [-0.7, 1.45, -1.05],
      worldSize: [0.86, 0.84],
      titleBarHeight: 44,
      contentPadding: 18,
    });
    this.continuity = continuity;
    this.registerButtons();
    this.render();
    void this.refreshContinuity();
  }

  async refreshContinuity(): Promise<void> {
    try {
      const summary = await this.continuity.summary();
      this.checkpointCount = summary.checkpointCount;
      this.hasCheckpoint = Boolean(summary.latestCheckpoint);
      this.canRecoverAutosave = summary.canRecoverAutosave;
      this.status = summary.latestCheckpoint
        ? `${summary.checkpointCount} saved ${summary.checkpointCount === 1 ? 'checkpoint' : 'checkpoints'} · latest ${summary.latestCheckpoint.label}`
        : 'No checkpoints yet';
    } catch (error) {
      this.status = error instanceof Error ? error.message : String(error);
    }
    this.registerButtons();
    this.render();
  }

  private registerButtons(): void {
    const x = 40;
    const w = 640;
    const h = 50;
    const gap = 10;
    let y = 140;
    const add = (id: ContinuityAction, label: string, enabled = true): void => {
      this.buttons.push({ id, label, x, y, w, h, enabled: enabled && !this.busy });
      y += h + gap;
    };
    this.buttons = [];
    add('refresh', 'Refresh save status');
    add('save', 'Save now');
    add('checkpoint', 'Create checkpoint');
    add('restore', 'Restore latest checkpoint', this.hasCheckpoint);
    add('recover', 'Recover autosave', this.canRecoverAutosave !== false);
    add('export', 'Export .nemosyne');
    add('open', 'Open .nemosyne');
    this.totalContentHeight = y + 30;
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
        return `Checkpoint created · ${entry.discoveryCount} discoveries`;
      });
      return;
    }
    if (id === 'restore') {
      await this.run(async () => {
        const entry = await this.continuity.restoreLatestCheckpoint();
        return `Checkpoint restored · ${entry.label}`;
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
        return `Portable investigation ready · ${bytes.byteLength} bytes`;
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

  renderContent(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'left';
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.primary);
    ctx.font = 'bold 22px monospace';
    ctx.fillText('INVESTIGATION CONTINUITY', 40, 42);
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.font = '16px monospace';
    ctx.fillText('Save, checkpoint, carry or recover your work', 40, 74, 640);
    ctx.fillText(this.status, 40, 104, 640);

    ctx.font = 'bold 17px monospace';
    for (const button of this.buttons) {
      ctx.fillStyle = button.enabled
        ? cssHex(COLOR_TOKENS.surface.raised)
        : 'rgba(70, 78, 88, 0.35)';
      ctx.fillRect(button.x, button.y, button.w, button.h);
      ctx.strokeStyle = button.enabled
        ? cssHex(COLOR_TOKENS.surface.border)
        : 'rgba(120, 128, 138, 0.3)';
      ctx.strokeRect(button.x, button.y, button.w, button.h);
      ctx.fillStyle = button.enabled
        ? cssHex(COLOR_TOKENS.text.primary)
        : cssHex(COLOR_TOKENS.text.muted);
      ctx.fillText(button.label, button.x + 14, button.y + 32, button.w - 28);
    }
  }

  handleContentClick(raycaster: THREE.Raycaster): boolean {
    this.mesh.updateMatrixWorld(true);
    const hits = raycaster.intersectObject(this.mesh, false);
    if (hits.length === 0 || !hits[0].uv) return false;
    const canvasX = hits[0].uv.x * this.width;
    const canvasY = (1 - hits[0].uv.y) * this.height;
    const contentY = canvasY + this.scrollOffset;
    for (const button of this.buttons) {
      if (
        button.enabled &&
        canvasX >= button.x &&
        canvasX <= button.x + button.w &&
        contentY >= button.y &&
        contentY <= button.y + button.h
      ) {
        void this.activate(button.id);
        return true;
      }
    }
    return false;
  }
}
