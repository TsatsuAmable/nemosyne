import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { ArchiveEntry } from '../../session/VaultArchiveStore.ts';
import type { AccessibilityOptions } from '../coordinators/types.ts';

export interface VaultPanelOptions {
  onFreeze?: () => void;
  onRestore?: (archiveId: string) => void;
  onExport?: (archiveId: string) => void;
  onDelete?: (archiveId: string) => void;
  position?: [number, number, number];
  worldSize?: [number, number];
  textScale?: number;
  highContrast?: boolean;
  colorblindMode?: string;
}

const PANEL_WIDTH = 800;
const PANEL_HEIGHT = 480;
const PAGE_SIZE = 4;

/**
 * Evidence archive/recovery surface.
 *
 * UXR1 migrates this panel from MovablePanel/CanvasTexture to SpatialPanel +
 * UIKit while preserving VaultArchiveStore as the archive authority and
 * retaining the explicit destructive restore confirmation step.
 */
export class VaultPanel extends SpatialPanel {
  readonly title = 'EVIDENCE VAULT';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  archives: ArchiveEntry[] = [];
  selectedArchiveId: string | null = null;
  currentPage = 0;
  showConfirmRestore = false;

  onFreeze?: () => void;
  onRestore?: (archiveId: string) => void;
  onExport?: (archiveId: string) => void;
  onDelete?: (archiveId: string) => void;

  private readonly _summary: Text;
  private readonly _archiveList: Container;
  private readonly _pageText: Text;
  private readonly _actions: Container;
  private readonly _prevButton: Button;
  private readonly _nextButton: Button;
  private readonly _freezeButton: Button;
  private readonly _restoreButton: Button;
  private readonly _exportButton: Button;
  private readonly _deleteButton: Button;
  private readonly _confirmPanel: Container;
  private readonly _confirmText: Text;
  private readonly _confirmButton: Button;
  private readonly _cancelButton: Button;
  private _archiveButtons: Button[] = [];
  private _textScale: number;
  private _highContrast: boolean;

  constructor(analystAnchor: THREE.Object3D, options: VaultPanelOptions = {}) {
    const highContrast = options.highContrast ?? false;
    const theme = getTheme(highContrast);
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'row',
        gap: SPACING_TOKENS.grid.x12,
        padding: SPACING_TOKENS.grid.x16,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      analystAnchor,
      null
    );

    this.name = 'vault-panel';
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;
    this.onFreeze = options.onFreeze;
    this.onRestore = options.onRestore;
    this.onExport = options.onExport;
    this.onDelete = options.onDelete;

    const worldWidth = options.worldSize?.[0] ?? 0.8;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [-0.65, 1.55, -1.1]));
    this.position.copy(this.defaultPosition);

    const left = new Container({
      width: 440,
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x8,
    });
    this._summary = new Text({
      text: 'FROZEN ARCHIVES',
      fontSize: 16 * this._textScale,
      fontWeight: 'bold',
      color: Number(theme.textPrimary),
    });
    this._archiveList = new Container({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x4,
    });
    this._pageText = new Text({
      text: '',
      fontSize: 13 * this._textScale,
      color: Number(theme.textMuted),
    });
    const pagination = new Container({
      flexDirection: 'row',
      gap: SPACING_TOKENS.grid.x4,
    });
    this._prevButton = new Button({ label: '◀ PREV', onClick: () => this.previousPage() });
    this._nextButton = new Button({ label: 'NEXT ▶', onClick: () => this.nextPage() });
    pagination.add(this._prevButton, this._nextButton);
    left.add(this._summary, this._archiveList, this._pageText, pagination);

    this._actions = new Container({
      width: 300,
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x8,
    });
    this._freezeButton = new Button({
      label: 'FREEZE SNAPSHOT',
      variant: 'primary',
      onClick: () => this.onFreeze?.(),
    });
    this._restoreButton = new Button({
      label: 'RESTORE SELECTED',
      onClick: () => this.requestRestore(),
    });
    this._exportButton = new Button({
      label: 'EXPORT PACKAGE',
      onClick: () => this.exportSelected(),
    });
    this._deleteButton = new Button({
      label: 'DELETE ARCHIVE',
      variant: 'danger',
      onClick: () => this.deleteSelected(),
    });

    this._confirmText = new Text({
      text: 'OVERWRITE ACTIVE SESSION?\nUnsaved progress will be lost.',
      fontSize: 12 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._confirmButton = new Button({
      label: 'CONFIRM RESTORE',
      variant: 'danger',
      onClick: () => this.confirmRestore(),
    });
    this._cancelButton = new Button({
      label: 'CANCEL',
      onClick: () => this.cancelRestore(),
    });
    this._confirmPanel = new Container({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x4,
      borderWidth: 1,
      borderColor: Number(theme.borderColor),
      padding: SPACING_TOKENS.grid.x8,
    });
    this._confirmPanel.add(this._confirmText, this._confirmButton, this._cancelButton);

    this._actions.add(
      new Text({
        text: 'OPERATIONS',
        fontSize: 16 * this._textScale,
        fontWeight: 'bold',
        color: Number(theme.textPrimary),
      }),
      this._freezeButton,
      this._restoreButton,
      this._exportButton,
      this._deleteButton
    );

    this.add(left, this._actions);
    this._syncPresentation();
  }

  setArchives(archives: ArchiveEntry[]): void {
    this.archives = [...archives];
    if (this.selectedArchiveId && !archives.some((a) => a.archiveId === this.selectedArchiveId)) {
      this.selectedArchiveId = null;
      this.showConfirmRestore = false;
    }
    const maxPage = Math.max(0, Math.ceil(this.archives.length / PAGE_SIZE) - 1);
    if (this.currentPage > maxPage) this.currentPage = maxPage;
    this._syncPresentation();
  }

  selectArchive(archiveId: string): void {
    if (!this.archives.some((archive) => archive.archiveId === archiveId)) return;
    this.selectedArchiveId = archiveId;
    this.showConfirmRestore = false;
    this._syncPresentation();
  }

  previousPage(): void {
    if (this.currentPage <= 0) return;
    this.currentPage--;
    this.showConfirmRestore = false;
    this._syncPresentation();
  }

  nextPage(): void {
    const maxPage = Math.max(0, Math.ceil(this.archives.length / PAGE_SIZE) - 1);
    if (this.currentPage >= maxPage) return;
    this.currentPage++;
    this.showConfirmRestore = false;
    this._syncPresentation();
  }

  requestRestore(): void {
    if (!this.selectedArchiveId) return;
    this.showConfirmRestore = true;
    this._syncPresentation();
  }

  confirmRestore(): void {
    if (!this.showConfirmRestore || !this.selectedArchiveId) return;
    this.onRestore?.(this.selectedArchiveId);
    this.showConfirmRestore = false;
    this._syncPresentation();
  }

  cancelRestore(): void {
    if (!this.showConfirmRestore) return;
    this.showConfirmRestore = false;
    this._syncPresentation();
  }

  exportSelected(): void {
    if (this.selectedArchiveId) this.onExport?.(this.selectedArchiveId);
  }

  deleteSelected(): void {
    if (this.selectedArchiveId) this.onDelete?.(this.selectedArchiveId);
  }

  applyAccessibility(options: AccessibilityOptions): void {
    this._textScale = options.textScale;
    this._highContrast = options.highContrast;
    const theme = getTheme(this._highContrast);
    this.setProperties({
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
    });
    this._summary.setProperties({
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._pageText.setProperties({
      fontSize: 13 * this._textScale,
      color: Number(theme.textMuted),
    });
    this._confirmText.setProperties({
      fontSize: 12 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._syncPresentation();
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
    this._syncPresentation();
  }

  private _syncPresentation(): void {
    for (const button of this._archiveButtons) {
      this._archiveList.remove(button);
      button.dispose();
    }
    this._archiveButtons = [];

    const start = this.currentPage * PAGE_SIZE;
    const pageArchives = this.archives.slice(start, start + PAGE_SIZE);
    if (pageArchives.length === 0) {
      const empty = new Button({
        label: 'No frozen archives found',
        disabled: true,
      });
      this._archiveButtons.push(empty);
      this._archiveList.add(empty);
    } else {
      for (const archive of pageArchives) {
        const selected = archive.archiveId === this.selectedArchiveId;
        const date = new Date(archive.frozenAt).toLocaleString();
        const button = new Button({
          label:
            (selected ? '✓ ' : '') +
            archive.label +
            '\n' +
            date +
            '\nEvents: ' +
            archive.eventCount +
            ' · Discoveries: ' +
            archive.discoveryCount,
          variant: selected ? 'primary' : 'secondary',
          onClick: () => this.selectArchive(archive.archiveId),
        });
        this._archiveButtons.push(button);
        this._archiveList.add(button);
      }
    }

    const totalPages = Math.max(1, Math.ceil(this.archives.length / PAGE_SIZE));
    this._pageText.setProperties({
      text: 'Page ' + (this.currentPage + 1) + ' of ' + totalPages,
    });
    this._prevButton.disabled = this.currentPage <= 0;
    this._nextButton.disabled = this.currentPage >= totalPages - 1;

    const hasSelection = this.selectedArchiveId !== null;
    this._restoreButton.disabled = !hasSelection;
    this._exportButton.disabled = !hasSelection;
    this._deleteButton.disabled = !hasSelection;

    const confirmAttached = this._confirmPanel.parent === this._actions;
    if (this.showConfirmRestore && !confirmAttached) {
      this._actions.add(this._confirmPanel);
    } else if (!this.showConfirmRestore && confirmAttached) {
      this._actions.remove(this._confirmPanel);
    }
  }
}
