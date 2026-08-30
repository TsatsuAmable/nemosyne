import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import type { ArchiveEntry } from '../../session/VaultArchiveStore.ts';
import type { MovablePanelOptions } from '../coordinators/types.ts';

export interface VaultPanelOptions extends MovablePanelOptions {
  onFreeze?: () => void;
  onRestore?: (archiveId: string) => void;
  onExport?: (archiveId: string) => void;
  onDelete?: (archiveId: string) => void;
}

function rgba(token: number, alpha: number): string {
  const r = (token >> 16) & 0xff;
  const g = (token >> 8) & 0xff;
  const b = token & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class VaultPanel extends MovablePanel {
  archives: ArchiveEntry[] = [];
  selectedArchiveId: string | null = null;
  currentPage: number = 0;
  showConfirmRestore: boolean = false;

  onFreeze?: () => void;
  onRestore?: (archiveId: string) => void;
  onExport?: (archiveId: string) => void;
  onDelete?: (archiveId: string) => void;

  constructor(cameraGroup: THREE.Group, options: VaultPanelOptions = {}) {
    super(cameraGroup, {
      title: 'EVIDENCE VAULT',
      width: 800,
      height: 480,
      position: options.position ?? [-0.65, 1.55, -1.1],
      worldSize: options.worldSize ?? [0.8, 0.48],
      titleBarHeight: 44,
      tilt: 0.22,
      textScale: options.textScale ?? 1,
      highContrast: options.highContrast ?? false,
      colorblindMode: options.colorblindMode ?? 'none',
    });

    this.onFreeze = options.onFreeze;
    this.onRestore = options.onRestore;
    this.onExport = options.onExport;
    this.onDelete = options.onDelete;

    this.render();
  }

  setArchives(archives: ArchiveEntry[]): void {
    this.archives = archives;
    if (this.selectedArchiveId && !archives.some((a) => a.archiveId === this.selectedArchiveId)) {
      this.selectedArchiveId = null;
    }
    const maxPage = Math.max(0, Math.ceil(this.archives.length / 4) - 1);
    if (this.currentPage > maxPage) this.currentPage = maxPage;
    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const dividerX = 460;

    ctx.strokeStyle = this.highContrast ? '#ffffff' : cssHex(COLOR_TOKENS.surface.border);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dividerX, 10);
    ctx.lineTo(dividerX, contentH - 10);
    ctx.stroke();

    this._renderLeftPane(ctx, dividerX, contentH);
    this._renderRightPane(ctx, dividerX, w, contentH);
  }

  private _renderLeftPane(ctx: CanvasRenderingContext2D, paneW: number, _h: number): void {
    const pad = 24;
    ctx.fillStyle = this.highContrast ? '#ffffff' : cssHex(COLOR_TOKENS.text.primary);
    ctx.font = this._scaleFont('bold 16px monospace');
    ctx.fillText('FROZEN ARCHIVES', pad, 30);

    const startIndex = this.currentPage * 4;
    const pageArchives = this.archives.slice(startIndex, startIndex + 4);

    if (this.archives.length === 0) {
      ctx.fillStyle = this.highContrast ? '#aaaaaa' : cssHex(COLOR_TOKENS.text.muted);
      ctx.font = this._scaleFont('14px monospace');
      ctx.fillText('No frozen archives found.', pad, 90);
      return;
    }

    pageArchives.forEach((archive, i) => {
      const y = 60 + i * 80;
      const isSelected = archive.archiveId === this.selectedArchiveId;

      ctx.fillStyle = isSelected
        ? this.highContrast
          ? '#333333'
          : rgba(COLOR_TOKENS.interaction.focus, 0.15)
        : rgba(COLOR_TOKENS.surface.raised, 0.35);
      ctx.fillRect(pad, y, paneW - pad * 2, 70);

      ctx.strokeStyle = isSelected
        ? this.highContrast
          ? '#ffffff'
          : cssHex(COLOR_TOKENS.interaction.focus)
        : this.highContrast
          ? '#444444'
          : cssHex(COLOR_TOKENS.surface.border);
      ctx.strokeRect(pad, y, paneW - pad * 2, 70);

      ctx.fillStyle = this.highContrast ? '#ffffff' : cssHex(COLOR_TOKENS.text.primary);
      ctx.font = this._scaleFont('bold 14px monospace');
      ctx.fillText(archive.label, pad + 12, y + 22);

      ctx.fillStyle = this.highContrast ? '#aaaaaa' : cssHex(COLOR_TOKENS.text.secondary);
      ctx.font = this._scaleFont('11px monospace');
      const dateStr = new Date(archive.frozenAt).toLocaleString();
      ctx.fillText(dateStr, pad + 12, y + 42);

      ctx.fillStyle = this.highContrast ? '#ffffff' : cssHex(COLOR_TOKENS.interaction.commit);
      ctx.fillText(
        `Events: ${archive.eventCount} | Discoveries: ${archive.discoveryCount}`,
        pad + 12,
        y + 58
      );
    });

    const totalPages = Math.ceil(this.archives.length / 4);
    if (totalPages > 1) {
      ctx.fillStyle = this.highContrast ? '#ffffff' : cssHex(COLOR_TOKENS.text.primary);
      ctx.font = this._scaleFont('14px monospace');
      ctx.textAlign = 'center';
      ctx.fillText(`Page ${this.currentPage + 1} of ${totalPages}`, paneW / 2, 395);
      ctx.textAlign = 'left';

      ctx.fillStyle =
        this.currentPage > 0
          ? this.highContrast
            ? '#ffffff'
            : cssHex(COLOR_TOKENS.interaction.focus)
          : cssHex(COLOR_TOKENS.text.muted);
      ctx.strokeRect(pad, 375, 80, 32);
      ctx.font = this._scaleFont('bold 12px monospace');
      ctx.fillText('◀ PREV', pad + 18, 395);

      ctx.fillStyle =
        this.currentPage < totalPages - 1
          ? this.highContrast
            ? '#ffffff'
            : cssHex(COLOR_TOKENS.interaction.focus)
          : cssHex(COLOR_TOKENS.text.muted);
      ctx.strokeRect(paneW - pad - 80, 375, 80, 32);
      ctx.fillText('NEXT ▶', paneW - pad - 80 + 18, 395);
    }
  }

  private _renderRightPane(
    ctx: CanvasRenderingContext2D,
    paneX: number,
    totalW: number,
    _h: number
  ): void {
    const pad = 24;
    const btnW = totalW - paneX - pad * 2;
    const startX = paneX + pad;

    ctx.fillStyle = this.highContrast ? '#ffffff' : cssHex(COLOR_TOKENS.text.primary);
    ctx.font = this._scaleFont('bold 16px monospace');
    ctx.fillText('OPERATIONS', startX, 30);

    const hasSelection = this.selectedArchiveId !== null;

    this._drawButton(ctx, 'FREEZE SNAPSHOT', startX, 60, btnW, 40, true, false);
    this._drawButton(ctx, 'RESTORE SELECTED', startX, 115, btnW, 40, hasSelection, false);
    this._drawButton(ctx, 'EXPORT PACKAGE', startX, 170, btnW, 40, hasSelection, false);
    this._drawButton(ctx, 'DELETE ARCHIVE', startX, 225, btnW, 40, hasSelection, true);

    if (this.showConfirmRestore) {
      ctx.fillStyle = rgba(COLOR_TOKENS.space.void, 0.94);
      ctx.fillRect(startX, 280, btnW, 140);
      ctx.strokeStyle = this.highContrast
        ? '#ffffff'
        : cssHex(COLOR_TOKENS.epistemic.contradiction);
      ctx.strokeRect(startX, 280, btnW, 140);

      ctx.fillStyle = this.highContrast
        ? '#ffffff'
        : cssHex(COLOR_TOKENS.epistemic.contradiction);
      ctx.font = this._scaleFont('bold 12px monospace');
      ctx.fillText('OVERWRITE ACTIVE SESSION?', startX + 12, 310);
      ctx.fillStyle = this.highContrast ? '#ffffff' : cssHex(COLOR_TOKENS.text.secondary);
      ctx.font = this._scaleFont('10px monospace');
      ctx.fillText('Unsaved progress will be lost.', startX + 12, 330);

      this._drawButton(ctx, 'CONFIRM', startX + 12, 360, 100, 32, true, false);
      this._drawButton(ctx, 'CANCEL', startX + 130, 360, 100, 32, true, false);
    }
  }

  private _drawButton(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    enabled: boolean,
    isDanger: boolean
  ): void {
    const activeToken = isDanger
      ? COLOR_TOKENS.danger.destructive
      : COLOR_TOKENS.interaction.focus;
    ctx.fillStyle = enabled
      ? rgba(activeToken, 0.12)
      : rgba(COLOR_TOKENS.surface.raised, 0.25);
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = enabled
      ? cssHex(activeToken)
      : cssHex(COLOR_TOKENS.surface.border);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = enabled ? cssHex(activeToken) : cssHex(COLOR_TOKENS.text.muted);
    ctx.font = this._scaleFont(`bold ${h > 35 ? '12' : '10'}px monospace`);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  handleContentClick(worldRaycaster: THREE.Raycaster): void {
    const hits = worldRaycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return;

    const uv = hits[0].uv;
    if (!uv) return;
    const cx = uv.x * this.width;
    const cy = (1 - uv.y) * this.height;

    const contentY = cy - (this.titleBarHeight + 4);
    const paneDivider = 460;
    const pad = 24;

    if (cx < paneDivider) {
      this._handleLeftPaneClick(cx, contentY, paneDivider, pad);
    } else {
      this._handleRightPaneClick(cx, contentY, paneDivider, pad);
    }
  }

  private _handleLeftPaneClick(cx: number, cy: number, paneW: number, pad: number): void {
    const startIndex = this.currentPage * 4;
    const pageArchives = this.archives.slice(startIndex, startIndex + 4);

    for (let i = 0; i < pageArchives.length; i++) {
      const y = 60 + i * 80;
      if (cx >= pad && cx <= paneW - pad && cy >= y && cy <= y + 70) {
        this.selectedArchiveId = pageArchives[i].archiveId;
        this.showConfirmRestore = false;
        this.render();
        return;
      }
    }

    const totalPages = Math.ceil(this.archives.length / 4);
    if (totalPages > 1) {
      if (
        this.currentPage > 0 &&
        cx >= pad &&
        cx <= pad + 80 &&
        cy >= 375 &&
        cy <= 375 + 32
      ) {
        this.currentPage--;
        this.render();
        return;
      }
      if (
        this.currentPage < totalPages - 1 &&
        cx >= paneW - pad - 80 &&
        cx <= paneW - pad &&
        cy >= 375 &&
        cy <= 375 + 32
      ) {
        this.currentPage++;
        this.render();
      }
    }
  }

  private _handleRightPaneClick(cx: number, cy: number, paneX: number, pad: number): void {
    const btnW = this.width - paneX - pad * 2;
    const startX = paneX + pad;
    const hasSelection = this.selectedArchiveId !== null;

    if (this.showConfirmRestore) {
      if (
        cx >= startX + 12 &&
        cx <= startX + 112 &&
        cy >= 360 &&
        cy <= 360 + 32
      ) {
        if (this.selectedArchiveId && this.onRestore) this.onRestore(this.selectedArchiveId);
        this.showConfirmRestore = false;
        this.render();
        return;
      }

      if (
        cx >= startX + 130 &&
        cx <= startX + 230 &&
        cy >= 360 &&
        cy <= 360 + 32
      ) {
        this.showConfirmRestore = false;
        this.render();
        return;
      }
    }

    if (cx >= startX && cx <= startX + btnW && cy >= 60 && cy <= 100) {
      this.onFreeze?.();
      return;
    }

    if (hasSelection && cx >= startX && cx <= startX + btnW && cy >= 115 && cy <= 155) {
      this.showConfirmRestore = true;
      this.render();
      return;
    }

    if (hasSelection && cx >= startX && cx <= startX + btnW && cy >= 170 && cy <= 210) {
      if (this.selectedArchiveId && this.onExport) this.onExport(this.selectedArchiveId);
      return;
    }

    if (hasSelection && cx >= startX && cx <= startX + btnW && cy >= 225 && cy <= 265) {
      if (this.selectedArchiveId && this.onDelete) this.onDelete(this.selectedArchiveId);
    }
  }
}
