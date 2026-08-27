import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { PanelChrome } from '../ui-system/components/PanelChrome.ts';
import { ScrollContainer } from '../ui-system/components/ScrollContainer.ts';
import { SegmentedControl } from '../ui-system/components/SegmentedControl.ts';
import { ConfirmButton } from '../ui-system/components/ConfirmButton.ts';
import { COLOR_TOKENS, SPACING_TOKENS, TYPOGRAPHY_TOKENS } from '../ui-system/tokens.ts';
import type { PanelBudgetController } from '../ui-system/PanelBudgetController.ts';
import { Dataset, ColumnType } from '../../data/Dataset.ts';
import type { ColumnSchema, ColumnTypeValue } from '../../data/types.ts';

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 640;
const PANEL_WORLD_WIDTH = 0.95;

const TYPE_OPTIONS: ColumnTypeValue[] = [
  ColumnType.NUMERIC,
  ColumnType.CATEGORICAL,
  ColumnType.TEMPORAL,
];

export interface SchemaMappingPanelOptions {
  torsoAnchor: THREE.Object3D;
  worldScene: THREE.Object3D;
  dataset: Dataset;
  /** Fires with the rebuilt `Dataset` once the user explicitly confirms. */
  onApplyMapping?: (updatedDataset: Dataset) => void;
  /** Live dataset accessor; called on each `show()` to refresh the working
   * copy so the panel never shows a stale schema after a reload. */
  getDataset?: () => Dataset | null;
  panelBudgetController?: PanelBudgetController;
  position?: [number, number, number];
}

/**
 * Schema & column-field mapping surface, migrated to the `SpatialPanel` +
 * uikit substrate (P1-U3). Each column is a row of name + `SegmentedControl`
 * (`NUMERIC` / `CATEGORICAL` / `TEMPORAL`); applying is a two-step
 * `ConfirmButton` because the apply reloads the dataset and resets the
 * evidence ledger / analysis history.
 *
 * Migration note: the previous `MovablePanel` / Canvas2D hit-test model is
 * replaced by uikit components. The public data contract — `dataset`,
 * `workingColumns`, `toggleColumnType`, `applyMapping`, `onApplyMapping` — is
 * preserved for downstream consumers. Pointer routing is via `engine.input`
 * (the SpatialPanel fallback path); the panel is NOT registered with the
 * MovablePanel-only `PanelManager`. Workspace coexistence is mediated by the
 * `PanelBudgetController` (`reference` role), mirroring `SettingsPanel`.
 */
export class SchemaMappingPanel extends SpatialPanel {
  dataset: Dataset;
  workingColumns: ColumnSchema[];
  onApplyMapping?: (updatedDataset: Dataset) => void;

  private _getDataset: (() => Dataset | null) | undefined;
  private _budgetController: PanelBudgetController | null;
  private _chrome: PanelChrome;
  private _rowsContainer: ScrollContainer;
  private _applyButton: ConfirmButton;

  constructor(options: SchemaMappingPanelOptions) {
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        padding: SPACING_TOKENS.panel.outerPadding,
        gap: SPACING_TOKENS.grid.x8,
      },
      options.torsoAnchor,
      options.worldScene,
    );
    this.name = 'schema-mapping-panel';
    this.scale.setScalar(PANEL_WORLD_WIDTH / PANEL_WIDTH);

    this.dataset = options.dataset;
    this.workingColumns = options.dataset.columns.map((c) => ({ ...c }));
    this.onApplyMapping = options.onApplyMapping;
    this._getDataset = options.getDataset;
    this._budgetController = options.panelBudgetController ?? null;

    const pos = options.position ?? [0, 1.6, -1.1];
    this.position.set(pos[0], pos[1], pos[2]);

    // Hidden until explicitly shown (mirrors HolographicInspector). The budget
    // controller tracks visibility on show/hide; the SpatialPanel fallback
    // path only routes to panels present in `engine.input`, and a hidden
    // panel's component tree is not interactable until `show()`.
    this.visible = false;

    this._chrome = new PanelChrome({
      title: 'SCHEMA & COLUMN MAPPING',
      onPinToggle: () => this._togglePin(),
      onClose: () => this.hide(),
    });
    this.add(this._chrome);

    this._rowsContainer = new ScrollContainer({ scrollHeight: 460 });
    this.add(this._rowsContainer);

    this._applyButton = new ConfirmButton({
      label: 'APPLY FIELD MAPPING',
      variant: 'primary',
      confirmMessage:
        'Apply reloads the dataset from its original rows with the new column types. This discards any current data operation (filter/cluster/etc.) and resets the evidence ledger + analysis history.',
      onConfirm: () => this.applyMapping(),
    });
    this.add(this._applyButton);

    this._buildRows();
  }

  // --- Lifecycle ---

  show(): void {
    this._budgetController?.open(this, 'reference');
    this.visible = true;
    // Refresh the working copy from the live dataset on every open so the panel
    // never shows a stale schema after a reload / schema apply.
    this._refreshFromDataset();
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

  private _togglePin(): void {
    if (!this._budgetController) return;
    if (this._chrome.isPinned) this._budgetController.pin(this);
    else this._budgetController.unpin(this);
  }

  // --- Schema editing ---

  /**
   * Cycle a column's type NUMERIC → CATEGORICAL → TEMPORAL → NUMERIC. Kept for
   * compatibility; the `SegmentedControl` drives edits directly via
   * `setColumnType`, but programmatic callers (and tests) may still cycle.
   */
  toggleColumnType(colName: string): void {
    const col = this.workingColumns.find((c) => c.name === colName);
    if (!col) return;
    if (col.type === ColumnType.NUMERIC) col.type = ColumnType.CATEGORICAL;
    else if (col.type === ColumnType.CATEGORICAL) col.type = ColumnType.TEMPORAL;
    else col.type = ColumnType.NUMERIC;
    this._buildRows();
  }

  /** Set a column's type to an explicit value (used by the SegmentedControl). */
  setColumnType(colName: string, type: ColumnTypeValue): void {
    const col = this.workingColumns.find((c) => c.name === colName);
    if (!col) return;
    col.type = type;
  }

  applyMapping(): Dataset {
    const updated = new Dataset(
      this.dataset.name,
      this.workingColumns,
      this.dataset.rows,
      this.dataset.edges,
    );
    this.onApplyMapping?.(updated);
    return updated;
  }

  private _refreshFromDataset(): void {
    const live = this._getDataset?.();
    if (live) {
      this.dataset = live;
      this.workingColumns = live.columns.map((c) => ({ ...c }));
    }
    this._buildRows();
  }

  private _buildRows(): void {
    this._rowsContainer.clear();

    if (this.workingColumns.length === 0) {
      this._rowsContainer.add(
        new Text({
          text: 'No columns available. Load a dataset to map its schema.',
          fontSize: TYPOGRAPHY_TOKENS.scale.body,
          color: COLOR_TOKENS.text.muted,
        }),
      );
      return;
    }

    for (const col of this.workingColumns) {
      const row = new Container({
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING_TOKENS.grid.x12,
        width: '100%',
      });

      const nameLabel = new Text({
        text: col.name,
        fontSize: TYPOGRAPHY_TOKENS.scale.body,
        color: COLOR_TOKENS.text.primary,
        flexGrow: 1,
      });
      row.add(nameLabel);

      const segValue = TYPE_OPTIONS.includes(col.type) ? col.type : TYPE_OPTIONS[0];
      const segmented = new SegmentedControl({
        options: TYPE_OPTIONS,
        value: segValue,
        onChange: (next) => this.setColumnType(col.name, next as ColumnTypeValue),
      });
      row.add(segmented);

      this._rowsContainer.add(row);
    }
  }
}