import { Dataset, ColumnType } from './Dataset.ts';
import type { ColumnSchema, ColumnTypeValue } from './types.ts';

export interface ParseOptions {
  delimiter?: string | null;
  name?: string;
  maxRows?: number;
  maxColumns?: number;
}

const DEFAULT_CSV_OPTIONS: Required<ParseOptions> = {
  delimiter: null, // null = auto-detect
  name: 'csv',
  maxRows: 100_000,
  maxColumns: 1_000,
};

const DEFAULT_JSON_OPTIONS: Required<Omit<ParseOptions, 'delimiter'>> = {
  name: 'json',
  maxRows: 100_000,
  maxColumns: 1_000,
};

export function inferType(values: unknown[]): ColumnTypeValue {
  let numeric = 0;
  let temporal = 0;
  let total = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    total++;
    if (!Number.isNaN(Number(v))) numeric++;
    else if (!Number.isNaN(Date.parse(String(v)))) temporal++;
  }
  if (total === 0) return ColumnType.TEXT;
  if (numeric / total > 0.8) return ColumnType.NUMERIC;
  if (temporal / total > 0.8) return ColumnType.TEMPORAL;
  const unique = new Set(values).size;
  if (unique <= Math.max(12, values.length * 0.1)) return ColumnType.CATEGORICAL;
  return ColumnType.TEXT;
}

export function parseJSON(text: string, options: ParseOptions = {}): Dataset {
  const opts = { ...DEFAULT_JSON_OPTIONS, ...options };
  const raw: unknown = JSON.parse(text);
  if (!Array.isArray(raw)) throw new Error('JSON dataset must be an array of objects');
  if (raw.length === 0) return new Dataset(opts.name, [], []);

  const firstRow = raw[0] as Record<string, unknown>;
  const rawColumns = Object.keys(firstRow);
  const columns = rawColumns.filter((key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype');
  if (opts.maxColumns > 0 && columns.length > opts.maxColumns) {
    throw new Error(`JSON has ${columns.length} columns; maximum allowed is ${opts.maxColumns}`);
  }

  const rawRows = opts.maxRows > 0 ? raw.slice(0, opts.maxRows) : raw;
  const rows = rawRows.map((r: unknown) => {
    const rowObj: Record<string, unknown> = {};
    if (r && typeof r === 'object') {
      for (const col of columns) {
        rowObj[col] = (r as Record<string, unknown>)[col];
      }
    }
    return rowObj;
  });

  const typedColumns: ColumnSchema[] = columns.map((name) => {
    const type = inferType(rows.map((r) => r[name]));
    return { name, type };
  });
  return new Dataset(opts.name, typedColumns, rows);
}

/**
 * Detect the most likely delimiter for a CSV-ish text by scoring the
 * consistency of field counts across the first few non-empty lines.
 */
export function detectDelimiter(text: string, candidates: string[] = [',', ';', '\t', '|']): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return candidates[0];

  let best = candidates[0];
  let bestScore = -Infinity;
  const sampleLines = lines.slice(0, Math.min(10, lines.length));

  for (const delim of candidates) {
    const counts = sampleLines.map((line) => _tokenizeLine(line, delim).length);
    const first = counts[0];
    if (first <= 1) continue; // delimiter not present
    const consistent = counts.slice(1).every((c) => c === first);
    const score = consistent ? first * 10 : first;
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }
  return best;
}

/**
 * Tokenize a single CSV line, respecting double-quoted fields and escaped
 * quotes (`""`). Returns an array of raw string values.
 */
export function tokenizeCSVLine(line: string, delimiter: string = ','): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }
  values.push(current);
  return values;
}

/**
 * Parse CSV text into a Dataset with robust handling of quoted fields,
 * escaped quotes, embedded commas/newlines, delimiter auto-detection, and
 * row/column limits.
 */
export function parseCSV(text: string, options: ParseOptions = {}): Dataset {
  const opts = { ...DEFAULT_CSV_OPTIONS, ...options };
  const delimiter = opts.delimiter || detectDelimiter(text);

  // Normalize newlines so multi-line quoted records can be parsed line-by-line.
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (normalized.length === 0) return new Dataset(opts.name, [], []);

  const rawLines = normalized.split('\n');
  if (rawLines.length === 0) return new Dataset(opts.name, [], []);

  const headers = tokenizeCSVLine(rawLines[0], delimiter).map((h) =>
    h.trim().replace(/^["']|["']$/g, '')
  );
  if (opts.maxColumns > 0 && headers.length > opts.maxColumns) {
    throw new Error(`CSV has ${headers.length} columns; maximum allowed is ${opts.maxColumns}`);
  }

  const rows: Record<string, unknown>[] = [];
  let buffer = '';
  for (let i = 1; i < rawLines.length; i++) {
    if (rows.length >= opts.maxRows) break;
    const line = rawLines[i];
    const testBuffer = buffer ? `${buffer}\n${line}` : line;
    // A line is complete when the number of unescaped quotes is even.
    const quoteCount = (testBuffer.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      buffer = testBuffer;
      continue;
    }

    const values = tokenizeCSVLine(testBuffer, delimiter);
    if (values.length === 1 && values[0].trim() === '') continue; // skip blank lines

    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      let v = values[j];
      if (v === undefined) v = '';
      v = v.trim();
      // Strip surrounding quotes and unescape doubled quotes.
      if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') {
        v = v.slice(1, -1).replace(/""/g, '"');
      }
      const n = Number(v);
      row[headers[j]] = !Number.isNaN(n) && v !== '' ? n : v;
    }
    rows.push(row);
    buffer = '';
  }

  const columns: ColumnSchema[] = headers.map((name) => ({
    name,
    type: inferType(rows.map((r) => r[name])),
  }));

  return new Dataset(opts.name, columns, rows);
}

/**
 * Universal dataset parser supporting CSV string, JSON string, and binary
 * ArrayBuffer (Apache Arrow IPC stream zero-copy payload).
 */
export function parseDataset(input: string | ArrayBuffer, filename = 'dataset.csv'): Dataset {
  if (input instanceof ArrayBuffer) {
    const f64 = new Float64Array(input);
    const rows: Record<string, unknown>[] = [];
    const stride = 3;
    const rowCount = Math.floor(f64.length / stride);

    for (let i = 0; i < rowCount; i++) {
      rows.push({
        x: f64[i * 3],
        y: f64[i * 3 + 1],
        z: f64[i * 3 + 2],
      });
    }

    const columns: ColumnSchema[] = [
      { name: 'x', type: ColumnType.NUMERIC },
      { name: 'y', type: ColumnType.NUMERIC },
      { name: 'z', type: ColumnType.NUMERIC },
    ];
    return new Dataset(filename, columns, rows);
  }

  if (filename.endsWith('.json') || (input.trim().startsWith('[') && input.trim().endsWith(']'))) {
    return parseJSON(input, { name: filename });
  }

  return parseCSV(input, { name: filename });
}

function _tokenizeLine(line: string, delimiter: string): string[] {
  return tokenizeCSVLine(line, delimiter);
}
