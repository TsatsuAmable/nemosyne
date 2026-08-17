/**
 * Test-only mock of the Rust analytical kernel.
 *
 * Wave 3 deleted the JS analytical modules (`DatasetOperations`, `Parsers`,
 * `TopologyInference`, `CSVDataParser`, ...). This helper is now fully
 * self-contained: it implements CANNED analytical logic inline so World /
 * controller / FileLoader integration tests can exercise orchestration
 * (history, events, UI wiring, prototype-pollution hardening) in plain jsdom,
 * where the real wasm/pkg is not served. This is NOT production code — no
 * `src/` code ever imports this. Exact analytical parity (filter median, sort
 * order, cluster algorithm, topology inference rules, parser edge cases) is
 * covered by Rust `#[test]`s + `tests/wasm-runtime.test.ts`.
 */
import { Dataset, ColumnType } from '../../src/data/Dataset.ts';
import { fnv1aHex } from '../../src/atlas/DatasetSpace.ts';

// ---------------------------------------------------------------------------
// Self-contained canned helpers
// ---------------------------------------------------------------------------

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function stripDangerous(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    out[k] = obj[k];
  }
  return out;
}

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function numericOrLex(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (isFiniteNumber(na) && isFiniteNumber(nb)) return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/**
 * Schema-type heuristic for the canned CSV/JSON parsers. Mirrors the kernel's
 * header/type inference closely enough for the simple fixtures the integration
 * tests use (numeric vs categorical vs temporal).
 */
function inferColumnType(values) {
  let nonNull = 0;
  let numeric = 0;
  let temporal = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    nonNull++;
    if (isFiniteNumber(v)) {
      numeric++;
    } else if (typeof v === 'string') {
      const s = v.trim();
      if (s !== '' && Number.isFinite(Number(s)) && /^-?\d/.test(s)) {
        numeric++;
      } else if (!Number.isNaN(Date.parse(s))) {
        temporal++;
      }
    }
  }
  if (nonNull === 0) return ColumnType.CATEGORICAL;
  if (numeric > nonNull / 2) return ColumnType.NUMERIC;
  if (temporal > nonNull / 2) return ColumnType.TEMPORAL;
  return ColumnType.CATEGORICAL;
}

// ---------------------------------------------------------------------------
// Canned CSV / JSON parsers (good enough for test fixtures; parity in Rust)
// ---------------------------------------------------------------------------

function splitCsvLine(line) {
  // Minimal CSV field splitter: handles double-quoted fields with embedded
  // commas and escaped quotes. Sufficient for the test fixtures.
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function coerceCell(raw) {
  if (raw === '') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  if (raw !== '' && Number.isFinite(n) && /^-?\d/.test(raw)) return n;
  return raw;
}

function loadCsv(bytes) {
  const text = new TextDecoder().decode(bytes);
  const lines = text.split(/\r\n|\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { name: 'dataset', columns: [], rows: [] };
  }
  const headerFields = splitCsvLine(lines[0]).map((h) => h.trim()).filter((h) => h !== '' && !DANGEROUS_KEYS.has(h));
  const columns = headerFields.map((name) => ({ name, type: ColumnType.CATEGORICAL }));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const row = {};
    for (let c = 0; c < headerFields.length; c++) {
      row[headerFields[c]] = coerceCell(fields[c] ?? null);
    }
    rows.push(stripDangerous(row));
  }
  // Infer column types from parsed rows.
  for (const col of columns) {
    col.type = inferColumnType(rows.map((r) => r[col.name]));
  }
  return { name: 'dataset', columns, rows };
}

function loadJson(bytes) {
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : parsed?.data ?? [];
  if (!Array.isArray(arr) || arr.length === 0) {
    return { name: 'dataset', columns: [], rows: [] };
  }
  const rawKeys = Object.keys(arr[0]);
  const keys = rawKeys.filter((k) => !DANGEROUS_KEYS.has(k));
  const columns = keys.map((name) => ({
    name,
    type: inferColumnType(arr.map((r) => r?.[name])),
  }));
  const rows = arr.map((r) => stripDangerous(r));
  return { name: 'dataset', columns, rows };
}

// ---------------------------------------------------------------------------
// Canned operation evaluation (parity in Rust #[test]s + wasm-runtime.test.ts)
// ---------------------------------------------------------------------------

function evalPredicate(p, row) {
  if (!p) return true;
  switch (p.op) {
    case 'eq': return row[p.column] === p.value;
    case 'ne': return row[p.column] !== p.value;
    case 'gt': return Number(row[p.column]) > Number(p.value);
    case 'gte': return Number(row[p.column]) >= Number(p.value);
    case 'lt': return Number(row[p.column]) < Number(p.value);
    case 'lte': return Number(row[p.column]) <= Number(p.value);
    case 'in': return p.values.includes(row[p.column]);
    case 'between': {
      const v = Number(row[p.column]);
      return v >= Number(p.lo) && v <= Number(p.hi);
    }
    case 'isnull': return row[p.column] == null;
    case 'and': return p.children.every((c) => evalPredicate(c, row));
    case 'or': return p.children.some((c) => evalPredicate(c, row));
    case 'not': return !evalPredicate(p.child, row);
    default: return true;
  }
}

function aggregateGroup(groupRows, ag, ds) {
  const first = { ...groupRows[0] };
  if (ag) {
    for (const a of ag) {
      const vals = groupRows
        .map((r) => Number(r[a.column]))
        .filter((v) => Number.isFinite(v));
      const fn = a.function;
      const out = a.as || `${a.column}_${fn}`;
      if (fn === 'sum') first[out] = vals.reduce((s, v) => s + v, 0);
      else if (fn === 'mean') first[out] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      else if (fn === 'median') first[out] = median(vals);
      else if (fn === 'min') first[out] = vals.length ? Math.min(...vals) : 0;
      else if (fn === 'max') first[out] = vals.length ? Math.max(...vals) : 0;
      else if (fn === 'count') first[out] = groupRows.length;
      else if (fn === 'std') {
        const m = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        first[out] = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, vals.length));
      } else if (fn === 'var') {
        const m = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        first[out] = vals.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, vals.length);
      }
    }
  } else {
    // Legacy: sum all numeric columns.
    for (const col of ds.numericColumns) {
      first[col.name] = groupRows.reduce((s, r) => s + (Number(r[col.name]) || 0), 0);
    }
  }
  first._count = groupRows.length;
  return first;
}

function withColumn(columns, name, type) {
  if (columns.some((c) => c.name === name)) return columns;
  return [...columns, { name, type }];
}

function applyOp(ds, op) {
  const rows = ds.rows;
  switch (op.op) {
    case 'filter': {
      const kept = op.predicate ? rows.filter((r) => evalPredicate(op.predicate, r)) : rows.slice();
      return new Dataset(ds.name, ds.columns, kept);
    }
    case 'sort': {
      // The real kernel does NOT rename the dataset on sort.
      const dir = op.ascending === false ? -1 : 1;
      const sorted = rows.slice().sort((a, b) => numericOrLex(a[op.column], b[op.column]) * dir);
      return new Dataset(ds.name, ds.columns, sorted);
    }
    case 'aggregate': {
      const groupBy = op.group_by || (op.group_by_columns || [])[0];
      if (!groupBy) return ds.clone();
      const groups = new Map();
      for (const r of rows) {
        const key = r[groupBy];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      const outRows = [...groups.values()].map((g) => aggregateGroup(g, op.aggregators, ds));
      return new Dataset(ds.name, ds.columns, outRows);
    }
    case 'compare': {
      const groupBy = op.group_by;
      const measures = op.measures ||
        ds.numericColumns.filter((c) => c.name !== groupBy).map((c) => c.name);
      const aRows = rows.filter((r) => String(r[groupBy]) === String(op.group_a));
      const bRows = rows.filter((r) => String(r[groupBy]) === String(op.group_b));
      const outRows = measures.map((m) => {
        const aVals = aRows.map((r) => Number(r[m])).filter((v) => Number.isFinite(v));
        const bVals = bRows.map((r) => Number(r[m])).filter((v) => Number.isFinite(v));
        const meanA = aVals.length ? aVals.reduce((s, v) => s + v, 0) / aVals.length : 0;
        const meanB = bVals.length ? bVals.reduce((s, v) => s + v, 0) / bVals.length : 0;
        return {
          _measure: m,
          _groupA: op.group_a,
          _groupB: op.group_b,
          _meanA: meanA,
          _meanB: meanB,
          _difference: meanA - meanB,
          _countA: aVals.length,
          _countB: bVals.length,
        };
      });
      return new Dataset(ds.name, [], outRows);
    }
    case 'k_means': {
      const k = op.k || 2;
      const outRows = rows.map((r, i) => ({ ...r, _cluster: i % k }));
      return new Dataset(ds.name, withColumn(ds.columns, '_cluster', ColumnType.NUMERIC), outRows);
    }
    case 'hierarchical': {
      const k = op.k || 2;
      const outRows = rows.map((r, i) => ({ ...r, _cluster: i % k }));
      const result = new Dataset(ds.name, withColumn(ds.columns, '_cluster', ColumnType.NUMERIC), outRows);
      result._meta = { linkage: op.linkage || 'average', targetClusters: k };
      return result;
    }
    case 'dbscan': {
      // Canned: trivial cluster assignment + one noise point when min_points > 1.
      const outRows = rows.map((r, i) => ({ ...r, _cluster: i % 2 }));
      if (op.min_points > 1 && outRows.length > 0) {
        outRows[outRows.length - 1]._cluster = -1;
      }
      return new Dataset(ds.name, withColumn(ds.columns, '_cluster', ColumnType.NUMERIC), outRows);
    }
    case 'anomaly_zscore':
    case 'anomaly_iqr': {
      const col = op.column;
      const vals = rows.map((r) => Number(r[col]));
      let extremeIdx = 0;
      let extremeVal = -Infinity;
      for (let i = 0; i < vals.length; i++) {
        if (Number.isFinite(vals[i]) && Math.abs(vals[i]) > extremeVal) {
          extremeVal = Math.abs(vals[i]);
          extremeIdx = i;
        }
      }
      const outRows = rows.map((r, i) => ({
        ...r,
        _anomaly: i === extremeIdx,
        _anomalyScore: i === extremeIdx ? extremeVal : 0,
      }));
      let cols = withColumn(ds.columns, '_anomaly', ColumnType.CATEGORICAL);
      cols = withColumn(cols, '_anomalyScore', ColumnType.NUMERIC);
      const result = new Dataset(ds.name, cols, outRows);
      result._meta = { method: op.op, column: col };
      return result;
    }
    case 'slice': {
      const start = op.start ?? 0;
      const end = op.end ?? rows.length;
      return new Dataset(ds.name, ds.columns, rows.slice(start, end));
    }
    default:
      return ds.clone();
  }
}

function factsFor(ds) {
  const numeric = ds.numericColumns.map((c) => {
    const vals = ds
      .getColumnValues(c.name)
      .filter((v) => typeof v === 'number' && !Number.isNaN(v));
    const sum = vals.reduce((s, v) => s + v, 0);
    const mean = vals.length ? sum / vals.length : 0;
    const med = median(vals);
    const variance = vals.length
      ? vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
      : 0;
    const std = Math.sqrt(variance);
    let skew = 0;
    let kurtosis = 0;
    if (std > 1e-9) {
      for (const v of vals) {
        const z = (v - mean) / std;
        skew += z * z * z;
        kurtosis += z * z * z * z;
      }
      skew /= vals.length;
      kurtosis = kurtosis / vals.length - 3;
    }
    return {
      name: c.name,
      count: vals.length,
      sum,
      mean,
      median: med,
      std,
      var: variance,
      min: vals.length ? Math.min(...vals) : 0,
      max: vals.length ? Math.max(...vals) : 0,
      skew,
      kurtosis,
      outlierCount: 0,
    };
  });
  const categorical = ds.categoricalColumns.map((c) => {
    const values = ds.getColumnValues(c.name);
    const counts = new Map();
    let total = 0;
    for (const v of values) {
      counts.set(v, (counts.get(v) || 0) + 1);
      total += 1;
    }
    const top = [...counts.entries()]
      .map(([value, count]) => ({ value: String(value), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const cardinality = counts.size;
    let entropy = 0;
    for (const [, count] of counts) {
      const p = count / (total || 1);
      if (p > 0) entropy -= p * Math.log2(p);
    }
    return { name: c.name, cardinality, entropy, top };
  });
  const temporalNames = ds.temporalColumns.map((c) => c.name);
  const valueCol = ds.numericColumns[0]?.name;
  const temporalStats = temporalNames.map((t) => {
    if (!valueCol) {
      return { column: t, valueColumn: '', trendDirection: 'flat', seasonalityHint: false, normalizedSlope: 0 };
    }
    const rows = ds.rows.slice().sort((a, b) => new Date(a[t]).getTime() - new Date(b[t]).getTime());
    const values = rows.map((r) => Number(r[valueCol])).filter((v) => !Number.isNaN(v));
    if (values.length < 3) {
      return { column: t, valueColumn: valueCol, trendDirection: 'flat', seasonalityHint: false, normalizedSlope: 0 };
    }
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den > 0 ? num / den : 0;
    const range = Math.max(...values) - Math.min(...values);
    const normalizedSlope = range > 0 ? slope / range : 0;
    const trendDirection = normalizedSlope > 0.01 ? 'up' : normalizedSlope < -0.01 ? 'down' : 'flat';
    return { column: t, valueColumn: valueCol, trendDirection, seasonalityHint: false, normalizedSlope };
  });
  // Canned correlation for the first two numeric columns (perfect linear case
  // is covered by Rust tests); mock returns empty to keep fixtures simple.
  return {
    rowCount: ds.rowCount,
    columnCount: ds.columns.length,
    numeric,
    correlation: [],
    categorical,
    temporal: temporalNames,
    temporalStats,
  };
}

function cannedInferTopology(ds) {
  const names = new Set(ds.columns.map((c) => c.name));
  if (names.has('source') && names.has('target')) return 'GRAPH';
  if (names.has('lat') && (names.has('lon') || names.has('lng') || names.has('longitude'))) return 'GEO';
  if (names.has('parent') && names.has('child')) return 'HIERARCHY';
  if (names.has('level')) return 'HIERARCHY';
  const temporal = ds.temporalColumns[0]?.name;
  if (temporal && ds.numericColumns.length > 0) return 'TIME_SERIES';
  return 'TABULAR';
}

function cannedInferEncodings(ds, topology) {
  if (ds.columns.length === 0) return {};
  const cat = ds.categoricalColumns[0]?.name;
  const num = ds.numericColumns[0]?.name;
  const time = ds.temporalColumns[0]?.name;
  const enc = {};
  if (cat) enc.color = cat;
  else if (num) enc.color = num;
  if (num) enc.size = num;
  if (time) {
    enc.pulse = time;
    enc.time = time;
  }
  if (topology === 'GEO' && cat) enc.label = cat;
  return enc;
}

// ---------------------------------------------------------------------------
// Mock bridge factory — keeps the handle-protocol shape callers expect.
// ---------------------------------------------------------------------------

/**
 * Build a mock `WasmRuntimeBridge` whose `runOperation` evaluates canned
 * analytical logic and returns DatasetJSON via the handle protocol.
 */
export function makeKernelMockBridge() {
  const store = new Map();
  let next = 1;

  function alloc(obj) {
    const h = next++;
    store.set(h, obj);
    return h;
  }

  return {
    isReady: () => true,
    capabilities: () => 0x3c07,
    kernelVersion: () => 'mock-kernel',
    kernelProvenance: () => null,
    initRuntime: () => Promise.resolve({}),
    loadDatasetJson: (obj) => alloc(obj),
    loadCsv: (bytes) => {
      try {
        return alloc(loadCsv(bytes));
      } catch {
        return 0;
      }
    },
    loadJson: (bytes) => {
      try {
        return alloc(loadJson(bytes));
      } catch {
        return 0;
      }
    },
    loadSample: () => 0,
    sampleKeys: () => [],
    getDatasetJson: (handle) => store.get(handle) ?? null,
    destroyDataset: (handle) => {
      store.delete(handle);
    },
    runOperation: (handle, op) => {
      const obj = store.get(handle);
      if (!obj) return 0;
      const result = applyOp(Dataset.fromJSON(obj), op);
      return alloc(result.toJSON());
    },
    executeOperation: (datasetObj, op) => {
      const h = alloc(datasetObj);
      const out = applyOp(Dataset.fromJSON(datasetObj), op).toJSON();
      store.delete(h);
      return out;
    },
    statistics: (handle) => {
      const obj = store.get(handle);
      if (!obj) return null;
      return factsFor(Dataset.fromJSON(obj));
    },
    inferTopology: (handle) => {
      const obj = store.get(handle);
      if (!obj) return null;
      return cannedInferTopology(Dataset.fromJSON(obj));
    },
    inferEncodings: (handle, topology) => {
      const obj = store.get(handle);
      if (!obj) return null;
      const ds = Dataset.fromJSON(obj);
      const topo = topology ?? cannedInferTopology(ds);
      return cannedInferEncodings(ds, topo);
    },
    inferSchema: (handle) => store.get(handle)?.columns ?? null,
    datasetFingerprint: (handle) => {
      const obj = store.get(handle);
      return obj ? fnv1aHex(obj) : null;
    },
    parseDatasetBytes: (bytes, ext) => {
      const handle = ext === 'csv' ? (() => {
        try {
          return alloc(loadCsv(bytes));
        } catch {
          return 0;
        }
      })() : (() => {
        try {
          return alloc(loadJson(bytes));
        } catch {
          return 0;
        }
      })();
      if (!handle) return null;
      const json = store.get(handle) ?? null;
      store.delete(handle);
      return json;
    },
    computeMapperGraph: () => null,
    computePersistenceIntervals: () => [],
    computeBetti0Curve: () => [],
  };
}