// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  ImportError,
  ImportWarning,
  ImportErrorCode,
  validateImport,
  formatValidationResult,
} from '../src/data/ImportError.js';

function makeDataset(columns, rows) {
  return new Dataset('test', columns, rows);
}

describe('validateImport', () => {
  it('passes for a valid dataset', () => {
    const ds = makeDataset(
      [
        { name: 'category', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [{ category: 'A', value: 1 }]
    );
    const result = validateImport(ds);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('flags no columns as fatal', () => {
    const ds = makeDataset([], []);
    const result = validateImport(ds);
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe(ImportErrorCode.NO_COLUMNS);
  });

  it('flags no rows as fatal', () => {
    const ds = makeDataset([{ name: 'a', type: ColumnType.NUMERIC }], []);
    const result = validateImport(ds);
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe(ImportErrorCode.NO_ROWS);
  });

  it('warns when all columns are text', () => {
    const ds = makeDataset(
      [
        { name: 'a', type: ColumnType.TEXT },
        { name: 'b', type: ColumnType.TEXT },
      ],
      [{ a: 'x', b: 'y' }]
    );
    const result = validateImport(ds);
    expect(result.ok).toBe(true);
    expect(result.warnings[0].code).toBe(ImportErrorCode.ALL_TEXT_COLUMNS);
  });

  it('flags max rows exceeded', () => {
    const ds = makeDataset([{ name: 'a', type: ColumnType.NUMERIC }], [{ a: 1 }, { a: 2 }]);
    const result = validateImport(ds, { maxRows: 1 });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe(ImportErrorCode.MAX_ROWS_EXCEEDED);
  });

  it('flags max columns exceeded', () => {
    const ds = makeDataset(
      [
        { name: 'a', type: ColumnType.NUMERIC },
        { name: 'b', type: ColumnType.NUMERIC },
      ],
      [{ a: 1, b: 2 }]
    );
    const result = validateImport(ds, { maxColumns: 1 });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe(ImportErrorCode.MAX_COLUMNS_EXCEEDED);
  });

  it('flags row length mismatch above tolerance', () => {
    const ds = makeDataset(
      [
        { name: 'a', type: ColumnType.NUMERIC },
        { name: 'b', type: ColumnType.NUMERIC },
      ],
      [{ a: 1, b: 2 }, { a: 3 }]
    );
    const result = validateImport(ds, { rowLengthMismatchTolerance: 0 });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe(ImportErrorCode.ROW_LENGTH_MISMATCH);
  });

  it('warns on minor row length mismatch', () => {
    const ds = makeDataset(
      [
        { name: 'a', type: ColumnType.NUMERIC },
        { name: 'b', type: ColumnType.NUMERIC },
      ],
      [{ a: 1, b: 2 }, { a: 3, b: 4 }, { a: 5 }]
    );
    const result = validateImport(ds, { rowLengthMismatchTolerance: 0.4 });
    expect(result.ok).toBe(true);
    expect(result.warnings[0].code).toBe(ImportErrorCode.ROW_LENGTH_MISMATCH);
  });
});

describe('formatValidationResult', () => {
  it('returns null for a clean load', () => {
    const result = { ok: true, errors: [], warnings: [] };
    expect(formatValidationResult(result)).toBeNull();
  });

  it('returns the first error message when not ok', () => {
    const result = {
      ok: false,
      errors: [new ImportError(ImportErrorCode.NO_ROWS, 'No rows.')],
      warnings: [],
    };
    expect(formatValidationResult(result)).toBe('Error: No rows.');
  });

  it('returns a warning summary when warnings exist', () => {
    const result = {
      ok: true,
      errors: [],
      warnings: [new ImportWarning(ImportErrorCode.ALL_TEXT_COLUMNS, 'All text.')],
    };
    expect(formatValidationResult(result)).toContain('1 warning');
    expect(formatValidationResult(result)).toContain('All text.');
  });
});
