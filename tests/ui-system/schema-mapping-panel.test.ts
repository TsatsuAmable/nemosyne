// @ts-nocheck
// @vitest-environment jsdom
//
// SchemaMappingPanel — SpatialPanel migration. Verifies the staleness fix
// (working copy refreshed from getDataset on show), column-type editing via
// the shared SegmentedControl, applyMapping contract, and that the APPLY
// control is a two-step ConfirmButton (no destructive single-click apply).

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SchemaMappingPanel } from '../../src/vr/ui/SchemaMappingPanel.ts';
import { Dataset, ColumnType } from '../../src/data/Dataset.ts';
import type { ColumnSchema } from '../../src/data/types.ts';

function makeAnchor(): THREE.Object3D {
  return new THREE.Group();
}

function makeDataset(columns: ColumnSchema[], rows: Record<string, unknown>[] = []): Dataset {
  return new Dataset('test', columns, rows);
}

describe('SchemaMappingPanel', () => {
  it('constructs with a working copy of the dataset columns', () => {
    const ds = makeDataset([
      { name: 'x', type: ColumnType.NUMERIC },
      { name: 'y', type: ColumnType.CATEGORICAL },
    ]);
    const panel = new SchemaMappingPanel({
      torsoAnchor: makeAnchor(),
      worldScene: makeAnchor(),
      dataset: ds,
    });
    expect(panel.workingColumns).toHaveLength(2);
    expect(panel.workingColumns[0]).toEqual({ name: 'x', type: 'NUMERIC' });
    // Working copy is independent of the source columns.
    panel.workingColumns[0].type = ColumnType.TEMPORAL;
    expect(ds.columns[0].type).toBe('NUMERIC');
  });

  it('refreshes the working copy from getDataset on show (no staleness)', () => {
    const dsA = makeDataset([{ name: 'x', type: ColumnType.NUMERIC }]);
    const dsB = makeDataset([
      { name: 'x', type: ColumnType.CATEGORICAL },
      { name: 'y', type: ColumnType.TEMPORAL },
    ]);
    const panel = new SchemaMappingPanel({
      torsoAnchor: makeAnchor(),
      worldScene: makeAnchor(),
      dataset: dsA,
      getDataset: () => dsB,
    });
    expect(panel.workingColumns).toHaveLength(1);

    panel.show();
    // After show, the live dataset (dsB) wins — the panel does not show a
    // stale schema from the original dsA.
    expect(panel.dataset).toBe(dsB);
    expect(panel.workingColumns).toHaveLength(2);
    expect(panel.workingColumns[1].type).toBe('TEMPORAL');
  });

  it('setColumnType updates the working copy', () => {
    const ds = makeDataset([{ name: 'x', type: ColumnType.NUMERIC }]);
    const panel = new SchemaMappingPanel({
      torsoAnchor: makeAnchor(),
      worldScene: makeAnchor(),
      dataset: ds,
    });
    panel.setColumnType('x', ColumnType.TEMPORAL);
    expect(panel.workingColumns[0].type).toBe('TEMPORAL');
  });

  it('toggleColumnType cycles NUMERIC → CATEGORICAL → TEMPORAL (compat)', () => {
    const ds = makeDataset([{ name: 'x', type: ColumnType.NUMERIC }]);
    const panel = new SchemaMappingPanel({
      torsoAnchor: makeAnchor(),
      worldScene: makeAnchor(),
      dataset: ds,
    });
    panel.toggleColumnType('x');
    expect(panel.workingColumns[0].type).toBe('CATEGORICAL');
    panel.toggleColumnType('x');
    expect(panel.workingColumns[0].type).toBe('TEMPORAL');
    panel.toggleColumnType('x');
    expect(panel.workingColumns[0].type).toBe('NUMERIC');
  });

  it('applyMapping builds a Dataset with the working columns and fires onApplyMapping', () => {
    const onApplyMapping = vi.fn();
    const ds = makeDataset(
      [{ name: 'x', type: ColumnType.NUMERIC }],
      [{ x: 1 }, { x: 2 }]
    );
    const panel = new SchemaMappingPanel({
      torsoAnchor: makeAnchor(),
      worldScene: makeAnchor(),
      dataset: ds,
      onApplyMapping,
    });
    panel.setColumnType('x', ColumnType.CATEGORICAL);
    const updated = panel.applyMapping();

    expect(updated.columns[0].type).toBe('CATEGORICAL');
    expect(updated.rows).toHaveLength(2);
    expect(onApplyMapping).toHaveBeenCalledWith(updated);
  });

  it('APPLY is a two-step ConfirmButton: arm does not apply, confirm does', () => {
    const onApplyMapping = vi.fn();
    const ds = makeDataset([{ name: 'x', type: ColumnType.NUMERIC }]);
    const panel = new SchemaMappingPanel({
      torsoAnchor: makeAnchor(),
      worldScene: makeAnchor(),
      dataset: ds,
      onApplyMapping,
    });
    const apply = panel._applyButton;

    // First click arms; applyMapping must NOT run on the first click.
    apply._actionButton.dispatchEvent({ type: 'click' });
    expect(apply.isArmed).toBe(true);
    expect(onApplyMapping).not.toHaveBeenCalled();

    // Confirm click fires the apply.
    apply._confirmButton.dispatchEvent({ type: 'click' });
    expect(onApplyMapping).toHaveBeenCalledOnce();
    expect(apply.isArmed).toBe(false);
  });
});