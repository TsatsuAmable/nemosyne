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

const TYPE_CHOICES: ReadonlyArray<{ value: ColumnTypeValue; label: string }> = [
  { value: ColumnType.NUMERIC, label: 'Number' },
  { value: ColumnType.CATEGORICAL, label: 'Category' },
  { value: ColumnType.TEMPORAL, label: 'Date & time' },
];

export interface SchemaMappingPanelOptions {
  torsoAnchor: THREE.Object3D;
  worldScene: THREE.Object3D;
  dataset: Dataset;
  onApplyMapping?: (updatedDataset: Dataset) => void;
  getDataset?: () => Dataset | null;
  panelBudgetController?: PanelBudgetController;
  position?: [number, number, number];
}

/** In-headset column review and correction surface. */
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
    this.visible = false;

    this._chrome = new PanelChrome({
      title: 'REVIEW COLUMNS',
      onPinToggle: () => this._togglePin(),
      onClose: () => this.hide(),
    });
    this.add(this._chrome);

    this._rowsContainer = new ScrollContainer({ scrollHeight: 460 });
    this.add(this._rowsContainer);

    this._applyButton = new ConfirmButton({
      label: 'APPLY COLUMN TYPES',
      variant: 'primary',
      confirmMessage:
        'Apply these column types? Nemosyne will reload the original rows, clear current filters or clusters, and restart the analysis history for this dataset.',
      onConfirm: () => this.applyMapping(),
    });
    this.add(this._applyButton);

    this._buildRows();
  }

  show(): void {
    this._budgetController?.open(this, 'reference');
    this.visible = true;
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

  toggleColumnType(colName: string): void {
    const col = this.workingColumns.find((c) => c.name === colName);
    if (!col) return;
    if (col.type === ColumnType.NUMERIC) col.type = ColumnType.CATEGORICAL;
    else if (col.type === ColumnType.CATEGORICAL) col.type = ColumnType.TEMPORAL;
    else col.type = ColumnType.NUMERIC;
    this._buildRows();
  }

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
          text: 'Load a dataset to review its columns.',
          fontSize: TYPOGRAPHY_TOKENS.scale.body,
          color: COLOR_TOKENS.text.muted,
        }),
      );
      return;
    }

    this._rowsContainer.add(
      new Text({
        text: 'Tell Nemosyne what each column means. Use Number for measured values, Category for groups or labels, and Date & time for timestamps.',
        fontSize: TYPOGRAPHY_TOKENS.scale.body,
        color: COLOR_TOKENS.text.secondary,
        maxWidth: 510,
      }),
    );

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

      const selected = TYPE_CHOICES.find((choice) => choice.value === col.type) ?? TYPE_CHOICES[0];
      const segmented = new SegmentedControl({
        options: TYPE_CHOICES.map((choice) => choice.label),
        value: selected.label,
        onChange: (next) => {
          const choice = TYPE_CHOICES.find((candidate) => candidate.label === next);
          if (choice) this.setColumnType(col.name, choice.value);
        },
      });
      row.add(segmented);

      this._rowsContainer.add(row);
    }
  }
}
