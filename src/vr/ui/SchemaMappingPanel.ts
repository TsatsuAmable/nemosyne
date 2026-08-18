import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { Dataset, ColumnType } from '../../data/Dataset.ts';
import type { ColumnSchema } from '../../data/types.ts';

export interface SchemaMappingPanelOptions {
  dataset: Dataset;
  onApplyMapping?: (updatedDataset: Dataset) => void;
  position?: [number, number, number];
}

export class SchemaMappingPanel extends MovablePanel {
  dataset: Dataset;
  workingColumns: ColumnSchema[];
  onApplyMapping?: (updatedDataset: Dataset) => void;
  private _clickCooldownMs = 300;
  private _lastClickAt = -300;

  constructor(
    cameraGroup: THREE.Group,
    { dataset, onApplyMapping, position = [-0.7, 1.4, -1.2] }: SchemaMappingPanelOptions
  ) {
    super(cameraGroup, {
      title: 'SCHEMA & COLUMN FIELD MAPPING',
      width: 950,
      height: 700,
      position,
      worldSize: [1.1, 0.8],
      titleBarHeight: 48,
      contentPadding: 16,
    });

    this.dataset = dataset;
    this.workingColumns = dataset.columns.map((c) => ({ ...c }));
    this.onApplyMapping = onApplyMapping;

    this.render();
  }

  toggleColumnType(colName: string): void {
    const col = this.workingColumns.find((c) => c.name === colName);
    if (!col) return;

    if (col.type === ColumnType.NUMERIC) {
      col.type = ColumnType.CATEGORICAL;
    } else if (col.type === ColumnType.CATEGORICAL) {
      col.type = ColumnType.TEMPORAL;
    } else {
      col.type = ColumnType.NUMERIC;
    }

    this.render();
  }

  applyMapping(): Dataset {
    const updated = new Dataset(
      this.dataset.name,
      this.workingColumns,
      this.dataset.rows,
      this.dataset.edges
    );

    if (this.onApplyMapping) {
      this.onApplyMapping(updated);
    }
    return updated;
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    this.totalContentHeight = 140 + this.workingColumns.length * 55 + 80;

    ctx.fillStyle = 'rgba(12, 24, 40, 0.85)';
    ctx.fillRect(10, 10, w - 20, contentH - 20);

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#88ccff';
    ctx.fillText('COLUMN FIELD NAME', 30, 45);
    ctx.fillText('INFERRED TYPE', 450, 45);
    ctx.fillText('ACTION', 750, 45);

    let y = 80;
    for (const col of this.workingColumns) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.textAlign = 'left';
      ctx.fillText(col.name.toUpperCase(), 30, y + 20, 380);

      // Type Badge
      ctx.fillStyle = col.type === ColumnType.NUMERIC ? 'rgba(0, 255, 100, 0.2)' : col.type === ColumnType.TEMPORAL ? 'rgba(255, 170, 0, 0.2)' : 'rgba(0, 180, 255, 0.2)';
      ctx.fillRect(445, y, 180, 30);
      ctx.strokeStyle = col.type === ColumnType.NUMERIC ? '#00ff66' : col.type === ColumnType.TEMPORAL ? '#ffaa00' : '#00b4ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(445, y, 180, 30);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(col.type), 535, y + 21);

      // Toggle Type Button
      ctx.fillStyle = '#00ffcc';
      ctx.fillRect(740, y, 140, 30);
      ctx.fillStyle = '#0a1828';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('CYCLE TYPE', 810, y + 20);

      y += 55;
    }

    // Apply Button at bottom
    ctx.fillStyle = '#00ff66';
    ctx.fillRect(300, y + 20, 350, 45);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('APPLY FIELD MAPPING', 475, y + 49);
  }
}
