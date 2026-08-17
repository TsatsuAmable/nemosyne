/**
 * Test-only mock of the Rust analytical kernel.
 *
 * Wave 2 makes the Rust kernel the ONLY analytical path in production. This
 * helper exists so World / controller / FileLoader integration tests can
 * exercise orchestration (history, events, UI wiring) in plain jsdom, where the
 * real wasm/pkg is not served. The mock delegates to the still-present JS
 * analytical modules (`DatasetOperations`, `Parsers`, `TopologyInference`) to
 * produce canned, kernel-shaped results. Exact analytical parity is covered by
 * Rust #[test]s + wasm-runtime.test.ts (skipped in plain jsdom by design).
 *
 * This is NOT production code — no `src/` code ever imports this.
 */
import { Dataset } from '../../src/data/Dataset.ts';
import {
  filter,
  sort,
  aggregate,
  compare,
  cluster,
  hierarchical,
  dbscan,
  anomaly,
  slice,
} from '../../src/data/DatasetOperations.ts';
import { parseCSV, parseJSON } from '../../src/data/Parsers.ts';
import {
  inferTopology,
  inferEncodingsForTopology,
} from '../../src/data/TopologyInference.ts';

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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
    return {
      name: c.name,
      count: vals.length,
      sum,
      mean,
      median: med,
      std: Math.sqrt(variance),
      var: variance,
      min: vals.length ? Math.min(...vals) : 0,
      max: vals.length ? Math.max(...vals) : 0,
    };
  });
  return {
    rowCount: ds.rowCount,
    columnCount: ds.columns.length,
    numeric,
    correlation: [],
    categorical: [],
    temporal: ds.temporalColumns.map((c) => c.name),
  };
}

function applyOp(ds, op) {
  switch (op.op) {
    case 'filter': {
      const p = op.predicate;
      if (!p) return ds.clone();
      switch (p.op) {
        case 'gt': return filter(ds, (r) => Number(r[p.column]) > Number(p.value));
        case 'gte': return filter(ds, (r) => Number(r[p.column]) >= Number(p.value));
        case 'lt': return filter(ds, (r) => Number(r[p.column]) < Number(p.value));
        case 'lte': return filter(ds, (r) => Number(r[p.column]) <= Number(p.value));
        case 'eq': return filter(ds, (r) => r[p.column] === p.value);
        case 'ne': return filter(ds, (r) => r[p.column] !== p.value);
        case 'in': return filter(ds, (r) => p.values.includes(r[p.column]));
        case 'between': return filter(ds, (r) => {
          const v = Number(r[p.column]);
          return v >= p.lo && v <= p.hi;
        });
        case 'isnull': return filter(ds, (r) => r[p.column] == null);
        default: return ds.clone();
      }
    }
    case 'sort':
      return sort(ds, op.column, op.ascending === false ? 'desc' : 'asc');
    case 'aggregate': {
      const groupBy = op.group_by || (op.group_by_columns || [])[0];
      if (!groupBy) return ds.clone();
      if (op.aggregators) {
        return aggregate(ds, groupBy, (groupRows) => {
          const first = { ...groupRows[0] };
          for (const ag of op.aggregators) {
            const vals = groupRows.map((r) => Number(r[ag.column])).filter((v) => !Number.isNaN(v));
            const fn = ag.function;
            const out = ag.as || `${ag.column}_${fn}`;
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
          first._count = groupRows.length;
          return first;
        });
      }
      return aggregate(ds, groupBy, (groupRows) => {
        const first = { ...groupRows[0] };
        for (const col of ds.numericColumns) {
          first[col.name] = groupRows.reduce((s, r) => s + (Number(r[col.name]) || 0), 0);
        }
        first._count = groupRows.length;
        return first;
      });
    }
    case 'compare':
      return compare(ds, op.group_by, op.group_a, op.group_b, op.measures);
    case 'k_means':
      return cluster(ds, op.k, op.features || null);
    case 'hierarchical':
      return hierarchical(ds, op.features || ds.numericColumns.map((c) => c.name), op.linkage || 'average', op.k);
    case 'dbscan':
      return dbscan(ds, op.eps, op.min_points, op.features || ds.numericColumns.map((c) => c.name));
    case 'anomaly_zscore':
      return anomaly(ds, op.column, 'zscore', op.sensitivity ?? null);
    case 'anomaly_iqr':
      return anomaly(ds, op.column, 'iqr', op.sensitivity ?? null);
    case 'slice':
      return slice(ds, op.start, op.end);
    default:
      return ds.clone();
  }
}

/**
 * Build a mock `WasmRuntimeBridge` whose `runOperation` maps the kernel
 * `OperationSpec` back to the JS analytical functions and returns canned
 * DatasetJSON via the handle protocol.
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
        const text = new TextDecoder().decode(bytes);
        return alloc(parseCSV(text, { maxRows: 100_000 }).toJSON());
      } catch {
        return 0;
      }
    },
    loadJson: (bytes) => {
      try {
        const text = new TextDecoder().decode(bytes);
        return alloc(parseJSON(text, { maxRows: 100_000 }).toJSON());
      } catch {
        return 0;
      }
    },
    loadSample: () => 0,
    sampleKeys: () => [],
    getDatasetJson: (handle) => store.get(handle) ?? null,
    destroyDataset: () => {},
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
      return inferTopology(Dataset.fromJSON(obj), null);
    },
    inferEncodings: (handle, topology) => {
      const obj = store.get(handle);
      if (!obj) return null;
      const ds = Dataset.fromJSON(obj);
      const topo = topology ?? inferTopology(ds, null);
      return inferEncodingsForTopology(ds, topo);
    },
    inferSchema: (handle) => store.get(handle)?.columns ?? null,
    datasetFingerprint: () => null,
    parseDatasetBytes: (bytes, ext) => {
      const handle = ext === 'csv'
        ? (() => {
            try {
              const text = new TextDecoder().decode(bytes);
              return alloc(parseCSV(text, { maxRows: 100_000 }).toJSON());
            } catch {
              return 0;
            }
          })()
        : (() => {
            try {
              const text = new TextDecoder().decode(bytes);
              return alloc(parseJSON(text, { maxRows: 100_000 }).toJSON());
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