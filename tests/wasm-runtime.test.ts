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
    // Honesty lock (mirrors the Rust test): reserved / unimplemented bits are
    // NOT advertised. Spec bitfield: DRACO=1<<3, SCENE=1<<4, COMMAND_BUFFER=1<<7.
    expect(caps & (1 << 3)).toBe(0); // DRACO_RUST (layouts only; not the full subsystem)
    expect(caps & (1 << 4)).toBe(0); // SCENE_RUST (scene graph still JS)
    expect(caps & (1 << 7)).toBe(0); // COMMAND_BUFFER (dormant stub)
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
});
