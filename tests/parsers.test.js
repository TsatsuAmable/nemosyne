// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { parseCSV, parseJSON, detectDelimiter, tokenizeCSVLine } from '../src/data/Parsers.ts';

describe('parseCSV', () => {
  it('parses a simple comma-delimited CSV', () => {
    const ds = parseCSV('a,b\n1,hello\n2,world');
    expect(ds.rowCount).toBe(2);
    expect(ds.columns.map((c) => c.name)).toEqual(['a', 'b']);
    expect(ds.rows[0]).toEqual({ a: 1, b: 'hello' });
  });

  it('handles quoted fields with embedded commas', () => {
    const ds = parseCSV('name,description\nA,"hello, world"\nB,"foo, bar"');
    expect(ds.rows[0].description).toBe('hello, world');
    expect(ds.rows[1].description).toBe('foo, bar');
  });

  it('handles escaped quotes inside quoted fields', () => {
    const ds = parseCSV('name,note\nA,"He said ""hi"""');
    expect(ds.rows[0].note).toBe('He said "hi"');
  });

  it('handles quoted fields that span multiple lines', () => {
    const ds = parseCSV('name,description\nA,"line one\nline two"\nB,"single"');
    expect(ds.rowCount).toBe(2);
    expect(ds.rows[0].description).toBe('line one\nline two');
  });

  it('auto-detects semicolon delimiter', () => {
    const ds = parseCSV('a;b\n1;hello\n2;world');
    expect(ds.columns.map((c) => c.name)).toEqual(['a', 'b']);
    expect(ds.rows[0]).toEqual({ a: 1, b: 'hello' });
  });

  it('auto-detects tab delimiter', () => {
    const ds = parseCSV('a\tb\n1\thello\n2\tworld');
    expect(ds.columns.map((c) => c.name)).toEqual(['a', 'b']);
    expect(ds.rows[0]).toEqual({ a: 1, b: 'hello' });
  });

  it('auto-detects pipe delimiter', () => {
    const ds = parseCSV('a|b\n1|hello\n2|world');
    expect(ds.columns.map((c) => c.name)).toEqual(['a', 'b']);
    expect(ds.rows[0]).toEqual({ a: 1, b: 'hello' });
  });

  it('respects an explicit delimiter override', () => {
    const ds = parseCSV('a;b\n1;hello', { delimiter: ',' });
    expect(ds.columns.map((c) => c.name)).toEqual(['a;b']);
    expect(ds.rows[0]['a;b']).toBe('1;hello');
  });

  it('returns an empty dataset for empty text', () => {
    const ds = parseCSV('');
    expect(ds.rowCount).toBe(0);
    expect(ds.columnCount).toBe(0);
  });

  it('returns an empty dataset when only a header is present', () => {
    const ds = parseCSV('a,b,c');
    expect(ds.rowCount).toBe(0);
    expect(ds.columns.map((c) => c.name)).toEqual(['a', 'b', 'c']);
  });

  it('skips blank lines', () => {
    const ds = parseCSV('a,b\n1,hello\n\n\n2,world\n');
    expect(ds.rowCount).toBe(2);
  });

  it('handles CRLF line endings', () => {
    const ds = parseCSV('a,b\r\n1,hello\r\n2,world');
    expect(ds.rowCount).toBe(2);
    expect(ds.rows[0]).toEqual({ a: 1, b: 'hello' });
  });

  it('enforces maxRows', () => {
    const ds = parseCSV('a\n1\n2\n3\n4\n5', { maxRows: 3 });
    expect(ds.rowCount).toBe(3);
  });

  it('throws when maxColumns is exceeded', () => {
    expect(() => parseCSV('a,b,c,d\n1,2,3,4', { maxColumns: 2 })).toThrow(/maximum allowed/);
  });

  it('infers numeric, categorical, and temporal types', () => {
    const ds = parseCSV('amount,category,time\n10,A,2026-07-28T00:00:00\n20,B,2026-07-28T01:00:00');
    expect(ds.getColumn('amount').type).toBe('NUMERIC');
    expect(ds.getColumn('category').type).toBe('CATEGORICAL');
    expect(ds.getColumn('time').type).toBe('TEMPORAL');
  });

  it('keeps missing trailing cells as empty strings', () => {
    const ds = parseCSV('a,b,c\n1,2\n3,4,5');
    expect(ds.rows[0]).toEqual({ a: 1, b: 2, c: '' });
  });

  it('drops prototype-polluting CSV headers while preserving value alignment', () => {
    const ds = parseCSV('__proto__,safe,constructor\nignored,1,ignored\nignored,2,ignored');

    expect(ds.columns.map((column) => column.name)).toEqual(['safe']);
    expect(ds.rows).toEqual([{ safe: 1 }, { safe: 2 }]);
  });
});

describe('tokenizeCSVLine', () => {
  it('splits on the delimiter outside quotes', () => {
    expect(tokenizeCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps quoted delimiters inside fields', () => {
    expect(tokenizeCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('unescapes doubled quotes', () => {
    expect(tokenizeCSVLine('a,"b""c",d')).toEqual(['a', 'b"c', 'd']);
  });
});

describe('detectDelimiter', () => {
  it('returns comma for comma-delimited text', () => {
    expect(detectDelimiter('a,b\n1,2')).toBe(',');
  });

  it('returns semicolon for semicolon-delimited text', () => {
    expect(detectDelimiter('a;b\n1;2')).toBe(';');
  });

  it('prefers the delimiter with consistent column counts', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });
});

describe('parseJSON', () => {
  it('parses an array of objects', () => {
    const ds = parseJSON('[{"a":1,"b":"x"},{"a":2,"b":"y"}]');
    expect(ds.rowCount).toBe(2);
    expect(ds.rows[0]).toEqual({ a: 1, b: 'x' });
  });

  it('throws for non-array JSON', () => {
    expect(() => parseJSON('{"a":1}')).toThrow(/must be an array/);
  });
});
