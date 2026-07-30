import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.js';
import { parseCSV, parseJSON } from '../src/data/Parsers.js';
import { categoricalColor, numericColor, normalize, inferEncodings } from '../src/data/Encodings.js';
import {
  makeFinancialSeries,
  makeGeoCities,
  makeFlowProcess,
} from '../src/data/SyntheticData.js';
import { allSampleDatasets } from '../src/data/SampleDatasets.js';

describe('Dataset', () => {
  it('stores typed columns and rows', () => {
    const ds = new Dataset('Test', [
      { name: 'a', type: ColumnType.NUMERIC },
      { name: 'b', type: ColumnType.CATEGORICAL },
    ], [{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);

    expect(ds.rowCount).toBe(2);
    expect(ds.numericColumns.length).toBe(1);
    expect(ds.categoricalColumns.length).toBe(1);
    expect(ds.rangeOf('a')).toEqual({ min: 1, max: 2 });
  });

  it('computes cardinality', () => {
    const ds = new Dataset('Test', [
      { name: 'b', type: ColumnType.CATEGORICAL },
    ], [{ b: 'x' }, { b: 'x' }, { b: 'y' }]);
    expect(ds.cardinalityOf('b')).toBe(2);
  });

  it('produces a stable fingerprint', () => {
    const ds = new Dataset('Test', [{ name: 'a', type: ColumnType.NUMERIC }], [{ a: 1 }]);
    expect(typeof ds.fingerprint).toBe('number');
    expect(ds.fingerprint).toBe(ds.fingerprint);
  });
});

describe('Parsers', () => {
  it('parses CSV and infers numeric types', () => {
    const csv = 'name,score\nAlice,92\nBob,87';
    const ds = parseCSV(csv, { name: 'scores' });
    expect(ds.rowCount).toBe(2);
    expect(ds.getColumn('score').type).toBe(ColumnType.NUMERIC);
    expect(ds.rows[0].score).toBe(92);
  });

  it('parses JSON arrays', () => {
    const json = JSON.stringify([
      { city: 'Berlin', temp: 22 },
      { city: 'Paris', temp: 24 },
    ]);
    const ds = parseJSON(json);
    expect(ds.rowCount).toBe(2);
    expect(ds.getColumn('temp').type).toBe(ColumnType.NUMERIC);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseJSON('not json')).toThrow();
  });
});

describe('Encodings', () => {
  it('normalizes values to [0, 1]', () => {
    expect(normalize(50, 0, 100)).toBe(0.5);
    expect(normalize(-10, 0, 100)).toBe(0);
    expect(normalize(110, 0, 100)).toBe(1);
  });

  it('generates categorical colors deterministically by index', () => {
    const c1 = categoricalColor('A', 0);
    const c2 = categoricalColor('B', 1);
    expect(typeof c1).toBe('number');
    expect(c1).not.toBe(c2);
  });

  it('generates numeric colors between low and high', () => {
    const low = numericColor(0, 0, 100, 0x000000, 0xffffff);
    const high = numericColor(100, 0, 100, 0x000000, 0xffffff);
    expect(low).toBe(0x000000);
    expect(high).toBe(0xffffff);
  });

  it('infers default encodings from column types', () => {
    const ds = new Dataset('Demo', [
      { name: 'cat', type: ColumnType.CATEGORICAL },
      { name: 'val', type: ColumnType.NUMERIC },
      { name: 'ts', type: ColumnType.TEMPORAL },
    ], [{ cat: 'A', val: 10, ts: '2026-01-01' }]);
    const enc = inferEncodings(ds);
    expect(enc.color).toBe('cat');
    expect(enc.size).toBe('val');
    expect(enc.time).toBe('ts');
  });
});

describe('Synthetic datasets', () => {
  it('creates a financial candle series', () => {
    const ds = makeFinancialSeries(24, 'MEMO');
    expect(ds.rowCount).toBe(24);
    expect(ds.columns.map((c) => c.name)).toContain('close');
    expect(ds.columns.map((c) => c.name)).toContain('volume');
    expect(ds.rows[0].symbol).toBe('MEMO');
  });

  it('creates geospatial city data', () => {
    const ds = makeGeoCities(10);
    expect(ds.rowCount).toBe(10);
    expect(ds.columns.map((c) => c.name)).toContain('lat');
    expect(ds.columns.map((c) => c.name)).toContain('lon');
    expect(ds.rows[0].lat).toBeDefined();
    expect(ds.rows[0].lon).toBeDefined();
  });

  it('creates a process-flow graph with edges', () => {
    const ds = makeFlowProcess(5);
    expect(ds.rowCount).toBe(5);
    expect(ds.edges.length).toBeGreaterThan(0);
    expect(ds.edges[0].weight).toBeDefined();
  });

  it('registers new samples in allSampleDatasets', () => {
    const keys = allSampleDatasets.map((d) => d.key);
    expect(keys).toContain('financial-series');
    expect(keys).toContain('geo-cities');
    expect(keys).toContain('flow-process');
  });
});
