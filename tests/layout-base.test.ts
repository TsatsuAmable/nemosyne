// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { LayoutBase } from '../src/moneta/layouts/LayoutBase.ts';

describe('LayoutBase', () => {
  it('requires subclasses to implement compute()', () => {
    expect(() => LayoutBase.compute()).toThrow('Layout subclasses must implement compute()');
  });

  it('numericValue returns a normalized value for numeric columns', () => {
    const dataset = {
      getColumn: vi.fn((field) => (field === 'value' ? { type: 'NUMERIC' } : null)),
      rangeOf: vi.fn(() => ({ min: 0, max: 100 })),
    };
    expect(LayoutBase.numericValue({ value: 50 }, dataset, 'value')).toBe(0.5);
  });

  it('numericValue returns fallback when field is missing', () => {
    const dataset = {
      getColumn: vi.fn((field) => (field === 'value' ? { type: 'NUMERIC' } : null)),
      rangeOf: vi.fn(() => ({ min: 0, max: 100 })),
    };
    expect(LayoutBase.numericValue({}, dataset, 'value', -1)).toBe(-1);
  });

  it('numericValue returns fallback for non-numeric columns', () => {
    const dataset = {
      getColumn: vi.fn((field) => (field === 'name' ? { type: 'STRING' } : null)),
      rangeOf: vi.fn(() => ({ min: 0, max: 1 })),
    };
    expect(LayoutBase.numericValue({ name: 'x' }, dataset, 'name')).toBe(0);
  });

  it('numericValue returns fallback for non-finite values', () => {
    const dataset = {
      getColumn: vi.fn(() => ({ type: 'NUMERIC' })),
      rangeOf: vi.fn(() => ({ min: 0, max: 100 })),
    };
    expect(LayoutBase.numericValue({ value: NaN }, dataset, 'value', -2)).toBe(-2);
  });

  it('numericValue returns fallback when dataset is missing', () => {
    expect(LayoutBase.numericValue({ value: 1 }, null, 'value', -3)).toBe(-3);
  });

  it('rowId prefers id, then name, then label, then _index', () => {
    expect(LayoutBase.rowId({ id: 'a', name: 'b', label: 'c', _index: 0 })).toBe('a');
    expect(LayoutBase.rowId({ name: 'b', label: 'c', _index: 0 })).toBe('b');
    expect(LayoutBase.rowId({ label: 'c', _index: 0 })).toBe('c');
    expect(LayoutBase.rowId({ _index: 5 })).toBe(5);
  });
});
