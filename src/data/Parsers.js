import { Dataset, ColumnType } from './Dataset.js';

const DEFAULT_CSV_OPTIONS = {
  delimiter: null, // null = auto-detect
  name: 'csv',
  maxRows: 100_000,
  maxColumns: 1_000,
};

export function inferType(values) {
  let numeric = 0;
  let temporal = 0;
  let total = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    total++;
    if (!Number.isNaN(Number(v))) numeric++;
    else if (!Number.isNaN(Date.parse(v))) temporal++;
  }
  if (total === 0) return ColumnType.TEXT;
  if (numeric / total > 0.8) return ColumnType.NUMERIC;
  if (temporal / total > 0.8) return ColumnType.TEMPORAL;
  const unique = new Set(values).size;
  if (unique <= Math.max(12, values.length * 0.1)) return ColumnType.CATEGORICAL;
  return ColumnType.TEXT;
}

export function parseJSON(text) {
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) throw new Error('JSON dataset must be an array of objects');
  if (raw.length === 0) return new Dataset('json', [], []);
  const columns = Object.keys(raw[0]).map((name) => {
    const type = inferType(raw.map((r) => r[name]));
    return { name, type };
  });
  return new Dataset('json', columns, raw);
}

/**
 * Detect the most likely delimiter for a CSV-ish text by scoring the
 * consistency of field counts across the first few non-empty lines.
 */
export function detectDelimiter(text, candidates = [',', ';', '\t', '|']) {
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
export function tokenizeCSVLine(line, delimiter = ',') {
  const values = [];
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
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {string|null} [options.delimiter] Delimiter; null to auto-detect.
 * @param {string} [options.name] Dataset name.
 * @param {number} [options.maxRows] Maximum rows to read (excluding header).
 * @param {number} [options.maxColumns] Maximum columns to accept.
 * @returns {Dataset}
 */
export function parseCSV(text, options = {}) {
  const opts = { ...DEFAULT_CSV_OPTIONS, ...options };
  const delimiter = opts.delimiter || detectDelimiter(text);

  // Normalize newlines so multi-line quoted records can be parsed line-by-line.
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (normalized.length === 0) return new Dataset(opts.name, [], []);

  const rawLines = normalized.split('\n');
  if (rawLines.length === 0) return new Dataset(opts.name, [], []);

  const headers = tokenizeCSVLine(rawLines[0], delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  if (opts.maxColumns > 0 && headers.length > opts.maxColumns) {
    throw new Error(`CSV has ${headers.length} columns; maximum allowed is ${opts.maxColumns}`);
  }

  const rows = [];
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

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      let v = values[j];
      if (v === undefined) v = '';
      v = v.trim();
      // Strip surrounding quotes and unescape doubled quotes.
      if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') {
        v = v.slice(1, -1).replace(/""/g, '"');
      }
      const n = Number(v);
      row[headers[j]] = (!Number.isNaN(n) && v !== '') ? n : v;
    }
    rows.push(row);
    buffer = '';
  }

  const columns = headers.map((name) => ({
    name,
    type: inferType(rows.map((r) => r[name])),
  }));

  return new Dataset(opts.name, columns, rows);
}

function _tokenizeLine(line, delimiter) {
  return tokenizeCSVLine(line, delimiter);
}
