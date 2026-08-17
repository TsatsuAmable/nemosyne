/**
 * Integration tests for the Rust/WASM RuntimeBridge.
 *
 * These tests exercise the wasm-pack output directly in the Vitest/jsdom
 * environment. They are skipped when `wasm/pkg/` has not been built, which is
 * the default in a fresh clone. Run `npm run wasm:dev` first to produce the
 * module, or rely on CI where `npm test` can build it.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { OperationSpec } from '../src/data/types.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

async function loadBridge() {
  try {
    await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    return bridge;
  } catch {
    return null;
  }
}

const maybeDescribe = (await loadBridge()) ? describe : describe.skip;

maybeDescribe('RuntimeBridge integration', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
  });

  it('initialises the runtime and reports Phase 1 capabilities', () => {
    expect(bridge.isReady()).toBe(true);
    const caps = bridge.capabilities();
    // Phase-1 implemented subsystems are advertised.
    expect(caps & (1 << 0)).not.toBe(0); // DATASET_RUST
    expect(caps & (1 << 1)).not.toBe(0); // PARSER_RUST
    expect(caps & (1 << 2)).not.toBe(0); // OPERATIONS_RUST
    // Wave 1 analytical subsystems are implemented + exported.
    expect(caps & (1 << 10)).not.toBe(0); // TOPOLOGY_RUST
    expect(caps & (1 << 11)).not.toBe(0); // TDA_RUST
    expect(caps & (1 << 12)).not.toBe(0); // ENCODINGS_RUST
    expect(caps & (1 << 13)).not.toBe(0); // STATS_RUST
    // Honesty lock (mirrors the Rust test): reserved / unimplemented bits are
    // NOT advertised. Spec bitfield: DRACO=1<<3, SCENE=1<<4, COMMAND_BUFFER=1<<7.
    expect(caps & (1 << 3)).toBe(0); // DRACO_RUST (layouts only; not the full subsystem)
    expect(caps & (1 << 4)).toBe(0); // SCENE_RUST (scene graph still JS)
    expect(caps & (1 << 7)).toBe(0); // COMMAND_BUFFER (dormant stub)
  });

  it('reports the canonical kernel version', () => {
    expect(bridge.kernelVersion()).toBe('0.2.0');
  });

  it('loads a built-in sample dataset from Rust', () => {
    const handle = bridge.loadSample('supply-chain');
    expect(handle).toBeGreaterThan(0);
    expect(bridge.datasetRowCount(handle)).toBe(12);
    expect(bridge.datasetColumnCount(handle)).toBe(5);
    bridge.destroyDataset(handle);
  });

  it('round-trips a dataset through JSON export', () => {
    const handle = bridge.loadSample('fraud-graph');
    expect(handle).toBeGreaterThan(0);
    const json = bridge.getDatasetJson(handle);
    expect(json).not.toBeNull();
    expect(json!.name).toBe('Transaction Fraud Graph');
    expect(json!.rows.length).toBe(8);
    expect(json!.edges).toBeDefined();
    bridge.destroyDataset(handle);
  });

  it('parses CSV bytes through the Rust parser', () => {
    const csv = new TextEncoder().encode('name,age,city\nAlice,30,NYC\nBob,25,LA\n');
    const json = bridge.parseDatasetBytes(csv, 'csv');
    expect(json).not.toBeNull();
    expect(json!.name).toBe('csv');
    expect(json!.rows.length).toBe(2);
    expect(json!.columns.length).toBe(3);
  });

  it('parses JSON bytes through the Rust parser', () => {
    const jsonBytes = new TextEncoder().encode('[{"x":1,"y":2},{"x":3,"y":4}]');
    const json = bridge.parseDatasetBytes(jsonBytes, 'json');
    expect(json).not.toBeNull();
    expect(json!.rows.length).toBe(2);
    expect(json!.columns.length).toBe(2);
  });

  it('executes a sort operation through the Rust data layer', () => {
    const dataset = {
      name: 'numbers',
      columns: [
        { name: 'id', type: 'CATEGORICAL' as const },
        { name: 'value', type: 'NUMERIC' as const },
      ],
      rows: [
        { id: 'a', value: 3 },
        { id: 'b', value: 1 },
        { id: 'c', value: 2 },
      ],
    };
    const result = bridge.executeOperation(dataset, {
      op: 'sort',
      column: 'value',
      ascending: true,
    } as OperationSpec);
    expect(result).not.toBeNull();
    expect(result!.rows.length).toBe(3);
    expect(result!.rows[0].value).toBe(1);
    expect(result!.rows[2].value).toBe(3);
  });

  it('executes a k_means operation through the Rust data layer', () => {
    const dataset = {
      name: 'points',
      columns: [
        { name: 'x', type: 'NUMERIC' as const },
        { name: 'y', type: 'NUMERIC' as const },
      ],
      rows: [
        { x: 0, y: 0 },
        { x: 0.1, y: 0.1 },
        { x: 10, y: 10 },
        { x: 10.1, y: 10.1 },
      ],
    };
    const result = bridge.executeOperation(dataset, {
      op: 'k_means',
      k: 2,
    } as OperationSpec);
    expect(result).not.toBeNull();
    expect(result!.rows.length).toBe(4);
    expect(result!.columns.some((c) => c.name === '_cluster')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Wave 1 analytical-kernel parity cases
  // -------------------------------------------------------------------------

  const peopleDataset = {
    name: 'people',
    columns: [
      { name: 'name', type: 'CATEGORICAL' as const },
      { name: 'age', type: 'NUMERIC' as const },
      { name: 'team', type: 'CATEGORICAL' as const },
    ],
    rows: [
      { name: 'Alice', age: 30, team: 'A' },
      { name: 'Bob', age: 25, team: 'B' },
      { name: 'Carol', age: 40, team: 'A' },
      { name: 'Dave', age: 35, team: 'B' },
    ],
  };

  it('filters via the predicate DSL (and / gte)', () => {
    const result = bridge.executeOperation(peopleDataset, {
      op: 'filter',
      predicate: {
        op: 'and',
        children: [
          { op: 'eq', column: 'team', value: 'A' },
          { op: 'gte', column: 'age', value: 35 },
        ],
      },
    } as OperationSpec);
    expect(result).not.toBeNull();
    expect(result!.rows.length).toBe(1);
    expect(result!.rows[0].name).toBe('Carol');
  });

  it('filters via the legacy numeric range form', () => {
    const result = bridge.executeOperation(peopleDataset, {
      op: 'filter',
      column: 'age',
      min: 30,
    } as OperationSpec);
    expect(result).not.toBeNull();
    expect(result!.rows.length).toBe(3);
  });

  it('aggregates with named aggregators (mean / max / count)', () => {
    const result = bridge.executeOperation(peopleDataset, {
      op: 'aggregate',
      group_by: 'team',
      aggregators: [
        { column: 'age', function: 'mean', as: 'avgAge' },
        { column: 'age', function: 'max', as: 'maxAge' },
        { column: 'name', function: 'count', as: 'n' },
      ],
    } as OperationSpec);
    expect(result).not.toBeNull();
    expect(result!.rows.length).toBe(2);
    const a = result!.rows.find((r) => r.team === 'A')!;
    expect(a.avgAge).toBeCloseTo(35, 6);
    expect(a.maxAge).toBe(40);
    expect(a.n).toBe(2);
  });

  it('aggregates with the legacy sum-all-numeric default', () => {
    const result = bridge.executeOperation(peopleDataset, {
      op: 'aggregate',
      group_by: 'team',
    } as OperationSpec);
    expect(result).not.toBeNull();
    expect(result!.rows.length).toBe(2);
    const a = result!.rows.find((r) => r.team === 'A')!;
    expect(a.age).toBe(70);
  });

  it('compares two groups across measures', () => {
    const result = bridge.executeOperation(peopleDataset, {
      op: 'compare',
      group_by: 'team',
      group_a: 'A',
      group_b: 'B',
      measures: ['age'],
    } as OperationSpec);
    expect(result).not.toBeNull();
    expect(result!.rows.length).toBe(1);
    const r = result!.rows[0];
    expect(r._measure).toBe('age');
    expect(r._meanA).toBe(35);
    expect(r._meanB).toBe(30);
    expect(r._difference).toBe(5);
    expect(r._countA).toBe(2);
  });

  it('detects anomalies with z-score and a sensitivity threshold', () => {
    const dataset = {
      name: 'z',
      columns: [{ name: 'v', type: 'NUMERIC' as const }],
      rows: [
        { v: 30 },
        { v: 30 },
        { v: 30 },
        { v: 1000 },
      ],
    };
    const result = bridge.executeOperation(dataset, {
      op: 'anomaly_zscore',
      column: 'v',
      sensitivity: 1.5,
    } as OperationSpec);
    expect(result).not.toBeNull();
    const flags = result!.rows.map((r) => r._anomaly);
    expect(flags).toEqual([false, false, false, true]);
  });

  it('detects anomalies with the anomaly_iqr op name', () => {
    const result = bridge.executeOperation(peopleDataset, {
      op: 'anomaly_iqr',
      column: 'age',
    } as OperationSpec);
    expect(result).not.toBeNull();
    expect(result!.columns.some((c) => c.name === '_anomaly')).toBe(true);
  });

  it('computes Facts statistics with correlation', () => {
    const handle = bridge.loadDatasetJson({
      name: 'stats',
      columns: [
        { name: 'g', type: 'CATEGORICAL' },
        { name: 'x', type: 'NUMERIC' },
        { name: 'y', type: 'NUMERIC' },
      ],
      rows: [
        { g: 'A', x: 1, y: 2 },
        { g: 'A', x: 2, y: 4 },
        { g: 'B', x: 3, y: 6 },
        { g: 'B', x: 4, y: 8 },
      ],
    });
    expect(handle).toBeGreaterThan(0);
    try {
      const facts = bridge.statistics(handle);
      expect(facts).not.toBeNull();
      expect(facts!.rowCount).toBe(4);
      const x = facts!.numeric.find((c) => c.name === 'x')!;
      expect(x.mean).toBeCloseTo(2.5, 6);
      // x and y are perfectly linearly correlated.
      const xy = facts!.correlation.find(
        (p) => (p.a === 'x' && p.b === 'y') || (p.a === 'y' && p.b === 'x'),
      )!;
      expect(xy.value).toBeCloseTo(1, 6);
      const g = facts!.categorical.find((c) => c.name === 'g')!;
      expect(g.cardinality).toBe(2);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('infers topology (graph from source/target hints)', () => {
    const handle = bridge.loadDatasetJson({
      name: 'g',
      columns: [
        { name: 'source', type: 'CATEGORICAL' },
        { name: 'target', type: 'CATEGORICAL' },
      ],
      rows: [],
    });
    expect(handle).toBeGreaterThan(0);
    try {
      expect(bridge.inferTopology(handle)).toBe('GRAPH');
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('infers encodings (topology-unaware default)', () => {
    const handle = bridge.loadDatasetJson({
      name: 'enc',
      columns: [
        { name: 'region', type: 'CATEGORICAL' },
        { name: 'revenue', type: 'NUMERIC' },
      ],
      rows: [],
    });
    expect(handle).toBeGreaterThan(0);
    try {
      const enc = bridge.inferEncodings(handle);
      expect(enc).not.toBeNull();
      expect(enc!.color).toBe('region');
      expect(enc!.size).toBe('revenue');
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('infers encodings for a GEO topology (adds label)', () => {
    const handle = bridge.loadDatasetJson({
      name: 'geo',
      columns: [
        { name: 'name', type: 'CATEGORICAL' },
        { name: 'lat', type: 'NUMERIC' },
        { name: 'lon', type: 'NUMERIC' },
      ],
      rows: [],
    });
    expect(handle).toBeGreaterThan(0);
    try {
      const enc = bridge.inferEncodings(handle, 'GEO');
      expect(enc).not.toBeNull();
      expect(enc!.label).toBe('name');
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('infers schema with NUMERIC type strings', () => {
    const handle = bridge.loadDatasetJson({
      name: 's',
      columns: [
        { name: 'x', type: 'NUMERIC' },
        { name: 'name', type: 'CATEGORICAL' },
      ],
      rows: [],
    });
    expect(handle).toBeGreaterThan(0);
    try {
      const schema = bridge.inferSchema(handle);
      expect(schema).not.toBeNull();
      expect(schema!.find((c) => c.name === 'x')!.type).toBe('NUMERIC');
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('returns a stable canonical fingerprint', () => {
    const a = bridge.loadDatasetJson(peopleDataset);
    const b = bridge.loadDatasetJson(peopleDataset);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    try {
      const fa = bridge.datasetFingerprint(a);
      const fb = bridge.datasetFingerprint(b);
      expect(fa).toMatch(/^[0-9a-f]{8}$/);
      expect(fa).toBe(fb);
    } finally {
      bridge.destroyDataset(a);
      bridge.destroyDataset(b);
    }
  });

  it('records a provenance envelope on an analytical result', () => {
    const handle = bridge.loadDatasetJson(peopleDataset);
    expect(handle).toBeGreaterThan(0);
    const outHandle = bridge.runOperation(handle, { op: 'sort', column: 'age', ascending: true } as OperationSpec);
    expect(outHandle).toBeGreaterThan(0);
    try {
      const prov = bridge.kernelProvenance();
      expect(prov).not.toBeNull();
      expect(prov!.kernel).toBe('nemosyne-wasm');
      expect(prov!.kernelVersion).toBe('0.2.0');
      expect(prov!.operation).toBe('sort');
      expect(prov!.inputFingerprint).toMatch(/^[0-9a-f]{8}$/);
      expect(prov!.outputFingerprint).toMatch(/^[0-9a-f]{8}$/);
      expect(prov!.timestamp).toBeGreaterThan(0);
    } finally {
      bridge.destroyDataset(handle);
      bridge.destroyDataset(outHandle);
    }
  });

  it('parses an Arrow payload into a dataset handle', () => {
    // 6 little-endian f64s -> 2 rows of (x,y,z).
    const bytes = new Float64Array([0, 1, 2, 3, 4, 5]);
    const handle = bridge.parseArrow(new Uint8Array(bytes.buffer));
    expect(handle).toBeGreaterThan(0);
    try {
      expect(bridge.datasetRowCount(handle)).toBe(2);
      expect(bridge.datasetColumnCount(handle)).toBe(3);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('computes a TDA Mapper graph', () => {
    const handle = bridge.loadDatasetJson({
      name: 'tda',
      columns: [{ name: 'val', type: 'NUMERIC' }],
      rows: [{ val: 1 }, { val: 2 }],
    });
    expect(handle).toBeGreaterThan(0);
    try {
      const graph = bridge.computeMapperGraph(handle, {
        featureColumns: ['val'],
        filterValues: [1, 2],
        bins: 3,
        overlap: 0.3,
      });
      expect(graph).not.toBeNull();
      expect(graph!.nodes.length).toBeGreaterThan(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('computes a Betti-0 curve', () => {
    const handle = bridge.loadDatasetJson({
      name: 'tda',
      columns: [{ name: 'val', type: 'NUMERIC' }],
      rows: [{ val: 0 }, { val: 5 }, { val: 10 }],
    });
    expect(handle).toBeGreaterThan(0);
    try {
      const curve = bridge.computeBetti0Curve(handle, { featureColumns: ['val'], steps: 4 });
      expect(curve).not.toBeNull();
      expect(curve!.length).toBeGreaterThan(0);
      // At radius 0 each point is its own component (betti0 == row count).
      expect(curve![0].betti0).toBe(3);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('computes 3D radial-tree positions', () => {
    const positions = bridge.computeRadialTree3d([0, 1, 1, 2], 1.8, 0.8, 1.2);
    expect(positions).not.toBeNull();
    expect(positions!.length).toBe(12); // 4 nodes * 3 floats
    // Level-0 node sits at the origin (x=0,z=0), y = y_offset.
    expect(positions![0]).toBeCloseTo(0, 6);
    expect(positions![1]).toBeCloseTo(1.2, 6);
    expect(positions![2]).toBeCloseTo(0, 6);
  });
});
