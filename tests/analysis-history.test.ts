// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { AnalysisHistory } from '../src/data/AnalysisHistory.ts';

function makeDataset(name, rows) {
  const columns = [
    { name: 'id', type: ColumnType.NUMERIC },
    { name: 'value', type: ColumnType.NUMERIC },
  ];
  return new Dataset(name, columns, rows);
}

describe('AnalysisHistory', () => {
  it('records an operation and exposes canUndo/canRedo', () => {
    const history = new AnalysisHistory();
    const before = makeDataset('before', [{ id: 1, value: 10 }]);
    const after = makeDataset('after', [{ id: 1, value: 20 }]);

    history.push('filter', before, after, { threshold: 15 });

    expect(history.length).toBe(1);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(history.current().operation).toBe('filter');
    expect(history.current().parameters.threshold).toBe(15);
  });

  it('undo restores the dataset before the operation', () => {
    const history = new AnalysisHistory();
    const before = makeDataset('before', [{ id: 1, value: 10 }]);
    const after = makeDataset('after', [{ id: 1, value: 20 }]);

    history.push('filter', before, after);
    const undone = history.undo();

    expect(undone).not.toBeNull();
    expect(undone.operation).toBe('filter');
    expect(undone.dataset.name).toBe('before');
    expect(undone.dataset.rows[0].value).toBe(10);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });

  it('redo restores the dataset after the operation', () => {
    const history = new AnalysisHistory();
    const before = makeDataset('before', [{ id: 1, value: 10 }]);
    const after = makeDataset('after', [{ id: 1, value: 20 }]);

    history.push('filter', before, after);
    history.undo();
    const redone = history.redo();

    expect(redone).not.toBeNull();
    expect(redone.operation).toBe('filter');
    expect(redone.dataset.name).toBe('after');
    expect(redone.dataset.rows[0].value).toBe(20);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('returns null for undo/redo when the stack is empty', () => {
    const history = new AnalysisHistory();
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
    expect(history.current()).toBeNull();
  });

  it('pushing a new operation after undo discards the redo branch', () => {
    const history = new AnalysisHistory();
    const ds1 = makeDataset('ds1', [{ id: 1, value: 1 }]);
    const ds2 = makeDataset('ds2', [{ id: 1, value: 2 }]);
    const ds3 = makeDataset('ds3', [{ id: 1, value: 3 }]);

    history.push('op-a', ds1, ds2);
    history.push('op-b', ds2, ds3);
    history.undo();

    const ds4 = makeDataset('ds4', [{ id: 1, value: 4 }]);
    history.push('op-c', ds2, ds4);

    expect(history.length).toBe(2);
    expect(history.canRedo).toBe(false);
    expect(history.current().operation).toBe('op-c');
  });

  it('clones returned datasets so the stack remains immutable', () => {
    const history = new AnalysisHistory();
    const before = makeDataset('before', [{ id: 1, value: 10 }]);
    const after = makeDataset('after', [{ id: 1, value: 20 }]);

    history.push('filter', before, after);
    const undone = history.undo();
    undone.dataset.rows[0].value = 999;

    expect(history._stack[0].datasetBefore.rows[0].value).toBe(10);
  });

  it('caps the frame count to maxFrames', () => {
    const history = new AnalysisHistory({ maxFrames: 3 });
    const ds = makeDataset('ds', [{ id: 1, value: 0 }]);

    history.push('op1', ds, makeDataset('ds1', [{ id: 1, value: 1 }]));
    history.push('op2', ds, makeDataset('ds2', [{ id: 1, value: 2 }]));
    history.push('op3', ds, makeDataset('ds3', [{ id: 1, value: 3 }]));
    history.push('op4', ds, makeDataset('ds4', [{ id: 1, value: 4 }]));

    expect(history.length).toBe(3);
    expect(history.current().operation).toBe('op4');
  });

  it('exposes frames() for inspection', () => {
    const history = new AnalysisHistory();
    const ds = makeDataset('ds', [{ id: 1, value: 0 }]);
    history.push('sort', ds, ds);
    history.push('filter', ds, ds);

    const frames = history.frames();
    expect(frames.map((f) => f.operation)).toEqual(['sort', 'filter']);
  });

  it('clear resets the stack', () => {
    const history = new AnalysisHistory();
    const ds = makeDataset('ds', [{ id: 1, value: 0 }]);
    history.push('sort', ds, ds);

    history.clear();
    expect(history.length).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.current()).toBeNull();
  });

  it('serializes and deserializes preserving frames and index', () => {
    const history = new AnalysisHistory();
    const ds1 = makeDataset('ds1', [{ id: 1, value: 1 }]);
    const ds2 = makeDataset('ds2', [{ id: 1, value: 2 }]);
    const ds3 = makeDataset('ds3', [{ id: 1, value: 3 }]);

    history.push('filter', ds1, ds2, { threshold: 10 });
    history.push('sort', ds2, ds3);
    history.undo();

    const restored = AnalysisHistory.fromJSON(history.toJSON());
    expect(restored.length).toBe(history.length);
    expect(restored.canUndo).toBe(true);
    expect(restored.canRedo).toBe(true);
    expect(restored.current().operation).toBe('filter');

    const redone = restored.redo();
    expect(redone.operation).toBe('sort');
    expect(redone.dataset.rows[0].value).toBe(3);
  });

  it('round-trips dataset frames through JSON', () => {
    const history = new AnalysisHistory();
    const before = makeDataset('before', [{ id: 1, value: 10 }]);
    const after = makeDataset('after', [{ id: 1, value: 20 }]);

    history.push('aggregate', before, after);
    const restored = AnalysisHistory.fromJSON(history.toJSON());
    const undone = restored.undo();

    expect(undone.dataset.rows[0].value).toBe(10);
    expect(undone.dataset.name).toBe('before');
  });
});
